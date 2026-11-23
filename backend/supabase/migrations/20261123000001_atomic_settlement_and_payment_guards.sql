-- Migration: audit fixes — atomic settlement and server-side money guards.
--
-- 1. verify_payment_transactional(): one locking RPC for approving AND
--    rejecting a payment, partial or full. The JS read→compute→write branch
--    in PaymentService is deleted: two concurrent approvals can no longer
--    both pre-read the same payments and diverge the balance. The RPC
--    returns the actual payment/invoice rows (no fabricated client object).
--    mark_invoice_paid_transactional() becomes a thin alias so already
--    deployed bundles keep working during the frontend rollout.
-- 2. validate_payment_mutation(): completed payments can never exceed the
--    invoice total (server-side, not just client JS), and terminal payments
--    are fully frozen — no re-verification overwriting verifier attribution.
-- 3. reconcile_gateway_payment(): the cross-invoice replay check is scoped
--    to the workspace (UTR uniqueness is workspace-scoped since
--    20261114184606), and an invoice with a pending UPI claim blocks gateway
--    settlement so a card session cannot double-settle it.
-- 4. submit_portal_payment(): UPI requires a 12-digit UTR (one shared rule
--    with the UI), amounts are paise-precise, and the 7-arg signature gets
--    the explicit REVOKE/GRANT the dropped 5-arg one used to carry.
-- 5. submit_portal_signature(): the signature IP is derived from the
--    request headers server-side; the client-supplied value is ignored.

-- ---------------------------------------------------------------------------
-- 1. Atomic payment verification (approve / reject, partial / full).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_payment_transactional(
  p_workspace_id uuid,
  p_profile_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid DEFAULT NULL,
  p_approve boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
  v_latest_utr TEXT;
  v_attempt_id UUID;
  v_completed_sum NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
  v_is_overdue BOOLEAN;
  v_invoice_json jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  -- Lock the invoice first: every settlement writer (this RPC, reconcile,
  -- the amount-guard trigger) serializes on this row.
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found in workspace';
  END IF;

  IF v_invoice.status IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Invoice cannot be verified in its current status';
  END IF;

  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id AND invoice_id = p_invoice_id
      AND workspace_id = p_workspace_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment not found for invoice';
    END IF;
    -- Terminal payments cannot be re-verified (attribution overwrite).
    IF v_payment.status NOT IN ('pending', 'pending_verification') THEN
      RAISE EXCEPTION 'Payment is not awaiting verification';
    END IF;
  ELSE
    -- Legacy mark-paid entry point: promote the latest attempt's UTR.
    SELECT utr_number INTO v_latest_utr
    FROM public.payment_attempts
    WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
    ORDER BY attempted_at DESC
    LIMIT 1;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
      AND deleted_at IS NULL
      AND status IN ('pending', 'pending_verification')
      AND (v_latest_utr IS NULL OR transaction_reference = v_latest_utr)
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  v_is_overdue := v_invoice.due_date < CURRENT_DATE;

  IF p_approve THEN
    IF v_payment.id IS NULL THEN
      -- Idempotent mark-paid retry: nothing pending, require real coverage.
      SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
      FROM public.payments
      WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
        AND status = 'completed' AND deleted_at IS NULL;

      IF v_completed_sum < v_invoice.total THEN
        RAISE EXCEPTION 'Cannot mark paid: completed payments (%) do not cover invoice total (%)',
          v_completed_sum, v_invoice.total;
      END IF;

      UPDATE public.invoices
      SET status = 'paid', outstanding_balance = 0, updated_at = now()
      WHERE id = p_invoice_id AND workspace_id = p_workspace_id
      RETURNING to_jsonb(public.invoices.*) INTO v_invoice_json;

      RETURN jsonb_build_object('success', true, 'invoice', v_invoice_json, 'payment', NULL);
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.payments
      WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
        AND id <> v_payment.id AND deleted_at IS NULL
        AND status IN ('pending', 'pending_verification')
    ) THEN
      RAISE EXCEPTION 'Other payment attempts are still pending verification for this invoice.';
    END IF;

    -- Server-side balance cap (the client check is only a fast UX error).
    IF v_payment.amount > COALESCE(v_invoice.outstanding_balance, v_invoice.total) THEN
      RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
    END IF;

    UPDATE public.payments
    SET status = 'completed',
        verifier_id = auth.uid(),
        verified_at = now(),
        notes = COALESCE(p_notes, notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    UPDATE public.payment_attempts
    SET status = 'verified'
    WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
      AND status = 'pending_verification'
      AND utr_number = v_payment.transaction_reference;
  ELSE
    IF v_payment.id IS NULL THEN
      RAISE EXCEPTION 'No pending payment to reject';
    END IF;

    UPDATE public.payments
    SET status = 'failed',
        verifier_id = auth.uid(),
        verified_at = now(),
        notes = COALESCE(p_notes, notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    UPDATE public.payment_attempts
    SET status = 'rejected'
    WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
      AND status = 'pending_verification'
      AND utr_number = v_payment.transaction_reference;
  END IF;

  -- Verification audit trail for both decisions.
  SELECT id INTO v_attempt_id
  FROM public.payment_attempts
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
    AND utr_number = v_payment.transaction_reference
  ORDER BY attempted_at DESC
  LIMIT 1;

  IF v_attempt_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_verifications
      WHERE payment_attempt_id = v_attempt_id
    ) THEN
      INSERT INTO public.payment_verifications (
        payment_attempt_id, workspace_id, invoice_id, verifier_id,
        verification_status, bank_reference, notes, verified_at
      ) VALUES (
        v_attempt_id, p_workspace_id, p_invoice_id, auth.uid(),
        CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        v_payment.transaction_reference, p_notes, now()
      );
    ELSE
      UPDATE public.payment_verifications
      SET verification_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
          verifier_id = auth.uid(), verified_at = now()
      WHERE payment_attempt_id = v_attempt_id;
    END IF;
  END IF;

  -- Recompute settlement from the completed payments under the lock.
  SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
  FROM public.payments
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
    AND status = 'completed' AND deleted_at IS NULL;

  IF p_approve THEN
    -- The legacy mark-paid alias is full settlement only.
    IF p_payment_id IS NULL AND v_completed_sum < v_invoice.total THEN
      RAISE EXCEPTION 'Cannot mark paid: completed payments (%) do not cover invoice total (%)',
        v_completed_sum, v_invoice.total;
    END IF;

    v_new_balance := GREATEST(0, v_invoice.total - v_completed_sum);
    v_new_status := CASE
      WHEN v_completed_sum >= v_invoice.total THEN 'paid'
      WHEN v_is_overdue THEN 'overdue'
      ELSE 'partially_paid'
    END;
  ELSE
    -- A rejection restores the balance-implied status only when no other
    -- claim is still awaiting verification.
    IF v_invoice.status = 'pending_verification' AND NOT EXISTS (
      SELECT 1 FROM public.payments
      WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
        AND id <> v_payment.id AND deleted_at IS NULL
        AND status IN ('pending', 'pending_verification')
    ) THEN
      v_new_balance := GREATEST(0, v_invoice.total - v_completed_sum);
      v_new_status := CASE
        WHEN v_completed_sum >= v_invoice.total THEN 'paid'
        WHEN v_completed_sum > 0 THEN (CASE WHEN v_is_overdue THEN 'overdue' ELSE 'partially_paid' END)
        ELSE (CASE WHEN v_is_overdue THEN 'overdue' ELSE 'sent' END)
      END;
    ELSE
      v_new_balance := COALESCE(v_invoice.outstanding_balance, v_invoice.total);
      v_new_status := v_invoice.status;
    END IF;
  END IF;

  UPDATE public.invoices
  SET status = v_new_status, outstanding_balance = v_new_balance, updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  RETURNING to_jsonb(public.invoices.*) INTO v_invoice_json;

  RETURN jsonb_build_object(
    'success', true,
    'invoice', v_invoice_json,
    'payment', to_jsonb(v_payment)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_payment_transactional(uuid, uuid, uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_payment_transactional(uuid, uuid, uuid, uuid, boolean, text) TO authenticated, service_role;

-- Compatibility alias for bundles deployed before this migration. The new
-- frontend calls verify_payment_transactional directly.
-- shortcut: drop this alias once the frontend carrying verify_payment_transactional is live.
CREATE OR REPLACE FUNCTION public.mark_invoice_paid_transactional(
  p_workspace_id uuid,
  p_profile_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.verify_payment_transactional(p_workspace_id, p_profile_id, p_invoice_id);
$$;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Payment mutation guard: total cap + full terminal freeze.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_completed_sum NUMERIC;
  v_invoice_total NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Money is sacred: amount and reference can never change.
    IF OLD.amount <> NEW.amount THEN
      RAISE EXCEPTION 'Payment amount is immutable after creation';
    END IF;
    IF OLD.transaction_reference IS DISTINCT FROM NEW.transaction_reference THEN
      RAISE EXCEPTION 'Payment transaction reference is immutable after creation';
    END IF;
    IF OLD.invoice_id <> NEW.invoice_id OR OLD.workspace_id <> NEW.workspace_id THEN
      RAISE EXCEPTION 'Payment cannot be reassigned to another invoice or workspace';
    END IF;

    IF OLD.status <> NEW.status THEN
      -- Forward-only canonical transitions
      IF NOT (
           (OLD.status = 'pending' AND NEW.status IN ('pending_verification', 'completed', 'failed')) OR
           (OLD.status = 'pending_verification' AND NEW.status IN ('completed', 'failed'))
         ) THEN
        RAISE EXCEPTION 'Invalid payment status transition from % to %', OLD.status, NEW.status;
      END IF;

      -- Completion requires verifier attribution unless executed by a
      -- trusted server context (SECURITY DEFINER / webhook => auth.uid() IS NULL).
      IF NEW.status = 'completed' AND NEW.verifier_id IS NULL AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Completing a payment requires verifier attribution';
      END IF;
    END IF;

    -- Terminal states are fully frozen: no re-verification, no attribution
    -- overwrite, no soft-delete. A settled or failed payment is history.
    IF OLD.status IN ('completed', 'failed') THEN
      RAISE EXCEPTION 'Payments in terminal state % cannot be modified', OLD.status;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Interactive callers may only open a payment in a pre-completion state.
    IF NEW.status NOT IN ('pending', 'pending_verification') AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Payments must be created as pending for interactive callers';
    END IF;
  END IF;

  -- Completed money must never exceed the invoice total, whoever writes it.
  -- The invoice row lock serializes concurrent completions per invoice.
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    SELECT total INTO v_invoice_total
    FROM public.invoices
    WHERE id = NEW.invoice_id
    FOR UPDATE;

    SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
    FROM public.payments
    WHERE invoice_id = NEW.invoice_id AND status = 'completed' AND deleted_at IS NULL
      AND id <> NEW.id;

    IF v_completed_sum + NEW.amount > v_invoice_total THEN
      RAISE EXCEPTION 'Completed payments (%) would exceed invoice total (%)',
        v_completed_sum + NEW.amount, v_invoice_total;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. reconcile_gateway_payment: workspace-scoped replay check, pending guard.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_gateway_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_transaction_id TEXT,
  p_gateway TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_existing_payment_id UUID;
  v_payment_id UUID;
  v_new_balance NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'Transaction id is required';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice with ID % not found', p_invoice_id;
  END IF;

  -- Idempotency scoped to this invoice comes BEFORE the status guards: a
  -- replayed event for a transaction that already settled is a no-op no
  -- matter what happened to the invoice since (partial settlement, a later
  -- UPI claim). A transaction id bound to a DIFFERENT invoice in the same
  -- workspace is a replay/confusion and still fails below.
  SELECT id INTO v_existing_payment_id
  FROM public.payments
  WHERE invoice_id = p_invoice_id AND transaction_reference = p_transaction_id;

  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Transaction already reconciled',
      'payment_id', v_existing_payment_id
    );
  END IF;

  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Invoice is already fully settled';
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be reconciled';
  END IF;

  -- A UPI claim is awaiting manual review: settling here too would double-
  -- count the money. The webhook treats this as a business conflict (200).
  IF v_invoice.status = 'pending_verification' THEN
    RAISE EXCEPTION 'Invoice has a payment awaiting verification';
  END IF;

  -- UTR uniqueness is workspace-scoped (20261114184606): a reference reused
  -- in another workspace is legitimate, within this workspace it is a replay.
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE transaction_reference = p_transaction_id
      AND invoice_id <> p_invoice_id
      AND workspace_id = v_invoice.workspace_id
  ) THEN
    RAISE EXCEPTION 'Transaction id already reconciled against a different invoice';
  END IF;

  IF p_amount > COALESCE(v_invoice.outstanding_balance, v_invoice.total) THEN
    RAISE EXCEPTION 'Reconciliation amount (%) exceeds outstanding balance (%)',
      p_amount, COALESCE(v_invoice.outstanding_balance, v_invoice.total);
  END IF;

  BEGIN
    INSERT INTO public.payments (
      workspace_id,
      invoice_id,
      amount,
      payment_method,
      transaction_reference,
      status,
      notes
    ) VALUES (
      v_invoice.workspace_id,
      v_invoice.id,
      p_amount,
      COALESCE(p_gateway, 'gateway_webhook'),
      p_transaction_id,
      'completed',
      'Automated reconciliation via ' || COALESCE(p_gateway, 'webhook')
    ) RETURNING id INTO v_payment_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_payment_id
    FROM public.payments
    WHERE invoice_id = p_invoice_id AND transaction_reference = p_transaction_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Transaction already reconciled',
      'payment_id', v_existing_payment_id
    );
  END;

  v_new_balance := GREATEST(0, COALESCE(v_invoice.outstanding_balance, v_invoice.total) - p_amount);
  v_new_status := CASE WHEN v_new_balance = 0 THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.invoices
  SET outstanding_balance = v_new_balance,
      status = v_new_status,
      updated_at = now()
  WHERE id = v_invoice.id;

  INSERT INTO public.financial_audit_trail (
    workspace_id,
    invoice_id,
    payment_id,
    event_type,
    amount,
    details
  ) VALUES (
    v_invoice.workspace_id,
    v_invoice.id,
    v_payment_id,
    'gateway_reconcile',
    p_amount,
    jsonb_build_object(
      'gateway', p_gateway,
      'transaction_id', p_transaction_id,
      'new_balance', v_new_balance,
      'new_status', v_new_status,
      'metadata', p_metadata
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'reconciled_amount', p_amount,
    'new_balance', v_new_balance,
    'invoice_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. submit_portal_payment: one UTR rule, paise precision, explicit grants.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_portal_payment(
  token_val text,
  invoice_id_val uuid,
  amt numeric,
  pay_method text,
  tx_ref text,
  p_screenshot_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_invoice_exists BOOLEAN;
  v_invoice_status TEXT;
  v_invoice_total NUMERIC;
  v_outstanding_balance NUMERIC;
  v_recent_attempts INT;
BEGIN
  SELECT p.id, p.workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects p
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex')
         OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), 'hex')
             AND p.portal_token_prev_expires_at > now()))
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  IF amt IS NULL OR amt <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Paise precision: NUMERIC(12,2) would silently round sub-paise input.
  IF amt <> round(amt, 2) THEN
    RAISE EXCEPTION 'Payment amount must have at most 2 decimal places';
  END IF;

  IF tx_ref IS NULL OR btrim(tx_ref) = '' OR char_length(btrim(tx_ref)) > 64 THEN
    RAISE EXCEPTION 'A valid transaction reference is required';
  END IF;

  -- One shared UTR rule with the UI: UPI references are exactly 12 digits.
  IF pay_method = 'UPI' AND btrim(tx_ref) !~ '^\d{12}$' THEN
    RAISE EXCEPTION 'UPI payments require a 12-digit UTR number';
  END IF;

  SELECT total, COALESCE(outstanding_balance, total), status, EXISTS(
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id_val
      AND project_id = v_project_id
      AND deleted_at IS NULL
  ) INTO v_invoice_total, v_outstanding_balance, v_invoice_status, v_invoice_exists
  FROM public.invoices
  WHERE id = invoice_id_val
  FOR UPDATE;

  IF v_invoice_exists IS NOT TRUE THEN
    RAISE EXCEPTION 'Invoice does not belong to the verified project';
  END IF;

  IF amt > v_outstanding_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds outstanding balance (%)', amt, v_outstanding_balance;
  END IF;

  IF v_invoice_status = 'draft' THEN
    RAISE EXCEPTION 'Invoice has not been issued yet';
  ELSIF v_invoice_status = 'paid' THEN
    RAISE EXCEPTION 'Invoice is already paid';
  ELSIF v_invoice_status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice is cancelled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE invoice_id = invoice_id_val
      AND workspace_id = v_workspace_id
      AND deleted_at IS NULL
      AND status IN ('pending', 'pending_verification')
  ) THEN
    RAISE EXCEPTION 'A payment for this invoice is already awaiting verification';
  END IF;

  IF EXISTS(SELECT 1 FROM public.payments WHERE workspace_id = v_workspace_id AND transaction_reference = tx_ref) OR
     EXISTS(SELECT 1 FROM public.payment_attempts WHERE workspace_id = v_workspace_id AND utr_number = tx_ref) THEN
    RAISE EXCEPTION 'Duplicate transaction reference (UTR) already used';
  END IF;

  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.payment_attempts
  WHERE invoice_id = invoice_id_val
    AND workspace_id = v_workspace_id
    AND attempted_at > now() - interval '10 minutes';

  IF v_recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many payment submissions for this invoice. Please try again in a few minutes.';
  END IF;

  BEGIN
    INSERT INTO public.payments (id, workspace_id, invoice_id, amount, payment_method, transaction_reference, status, payment_date)
    VALUES (gen_random_uuid(), v_workspace_id, invoice_id_val, amt, pay_method, tx_ref, 'pending', now());

    INSERT INTO public.payment_attempts (id, workspace_id, invoice_id, utr_number, amount, status, attempted_at, screenshot_url, notes)
    VALUES (gen_random_uuid(), v_workspace_id, invoice_id_val, tx_ref, amt, 'pending_verification', now(),
            NULLIF(btrim(p_screenshot_url), ''), NULLIF(btrim(p_notes), ''));
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Duplicate transaction reference (UTR) already used';
  END;

  UPDATE public.invoices
  SET status = 'pending_verification', updated_at = now()
  WHERE id = invoice_id_val;

  INSERT INTO public.activity_logs (id, workspace_id, project_id, action, details)
  VALUES (
    gen_random_uuid(), v_workspace_id, v_project_id, 'Payment Submitted',
    jsonb_build_object('invoice_id', invoice_id_val, 'amount', amt, 'transaction_reference', tx_ref)
  );
END;
$$;

-- The dropped 5-arg signature's lockdown never carried over to the 7-arg
-- replacement; re-apply it explicitly instead of relying on PUBLIC execute.
REVOKE EXECUTE ON FUNCTION public.submit_portal_payment(text, uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portal_payment(text, uuid, numeric, text, text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. submit_portal_signature: server-derived IP evidence.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_portal_signature(
  token_val text,
  sig_name text,
  ip_addr text DEFAULT NULL,
  sig_image text DEFAULT NULL,
  sig_type text DEFAULT 'drawn'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_contract_id UUID;
  v_freelancer_profile_id UUID;
  v_freelancer_email TEXT;
  v_project_name TEXT;
  v_client_name TEXT;
  v_email_log_id UUID;
  v_headers jsonb;
  v_xff_parts text[];
  v_server_ip TEXT;
BEGIN
  IF sig_name IS NULL OR char_length(btrim(sig_name)) < 2 THEN
    RAISE EXCEPTION 'Signature name is required';
  END IF;

  SELECT p.id, p.workspace_id, p.name, cl.name INTO v_project_id, v_workspace_id, v_project_name, v_client_name
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex')
         OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), 'hex')
             AND p.portal_token_prev_expires_at > now()))
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired portal token';
  END IF;

  -- A client can only sign a contract that was sent (or one already signed,
  -- for idempotent re-signing); draft/void contracts are not signable.
  SELECT c.id INTO v_contract_id
  FROM public.contracts c
  WHERE c.project_id = v_project_id
    AND c.deleted_at IS NULL
    AND c.status IN ('sent', 'signed');

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract is not available for signing';
  END IF;

  -- Legal-signature IP evidence must not be client-supplied. PostgREST
  -- exposes the request headers; the edge proxy appends the real client IP
  -- last, so the last x-forwarded-for entry is the unspoofable one. The
  -- ip_addr parameter is kept for cached clients but deliberately ignored.
  v_headers := COALESCE(current_setting('request.headers', true)::jsonb, '{}'::jsonb);
  v_xff_parts := regexp_split_to_array(COALESCE(v_headers->>'x-forwarded-for', ''), '\s*,\s*');
  v_server_ip := COALESCE(NULLIF(btrim(v_xff_parts[array_upper(v_xff_parts, 1)]), ''), 'unknown');

  SELECT w.profile_id, prof.email INTO v_freelancer_profile_id, v_freelancer_email
  FROM public.workspaces w
  JOIN public.profiles prof ON prof.id = w.profile_id
  WHERE w.id = v_workspace_id;

  INSERT INTO public.contract_signatures (
    id, workspace_id, contract_id, signature_name, signature_image,
    signature_type, ip_address, signature_date
  ) VALUES (
    gen_random_uuid(), v_workspace_id, v_contract_id, sig_name, sig_image,
    COALESCE(sig_type, 'drawn'), v_server_ip, now()
  )
  ON CONFLICT (contract_id) DO NOTHING;

  UPDATE public.contracts
  SET status = 'signed', updated_at = now()
  WHERE id = v_contract_id;

  -- Only advance the project from its valid predecessor. A project that has
  -- already moved on keeps its status instead of raising and rolling the
  -- signature insert away.
  UPDATE public.projects
  SET status = 'contract_signed', updated_at = now()
  WHERE id = v_project_id AND status = 'approved';

  INSERT INTO public.activity_logs (
    workspace_id, profile_id, project_id, action, details
  ) VALUES (
    v_workspace_id, v_freelancer_profile_id, v_project_id,
    'contract_signed_by_client',
    jsonb_build_object(
      'signature_name', sig_name,
      'signature_type', COALESCE(sig_type, 'drawn'),
      'contract_id', v_contract_id,
      'project_name', v_project_name,
      'client_name', v_client_name,
      'signed_at', now(),
      'has_signature_image', (sig_image IS NOT NULL)
    )
  );

  IF v_freelancer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (
      workspace_id, profile_id, project_id, recipient, subject, body,
      status, attempts, max_attempts
    ) VALUES (
      v_workspace_id, v_freelancer_profile_id, v_project_id, v_freelancer_email,
      'Agreement Signed: ' || COALESCE(v_project_name, 'Project') || ' by ' || COALESCE(v_client_name, 'Client'),
      'Hello, your client (' || public.html_escape(v_client_name) || ') has digitally signed the project agreement for "' || public.html_escape(v_project_name) || '". ' ||
      'Signature name: ' || public.html_escape(sig_name) || ' at ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS UTC') || '. ' ||
      'Your project is now in contract_signed status and ready for execution.',
      'pending', 0, 3
    )
    RETURNING id INTO v_email_log_id;
  END IF;

  RETURN v_email_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, text, text) TO anon, authenticated, service_role;
