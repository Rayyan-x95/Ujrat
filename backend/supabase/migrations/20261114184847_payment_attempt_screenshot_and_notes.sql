-- Migration: store the payment screenshot and notes a client submits.
--
-- The UTR form asks the client for a payment screenshot URL and notes, and
-- the freelancer-side submit wrote them to payment_attempts.screenshot_url /
-- .notes / .app_name - none of which existed, so the insert failed with
-- 42703 and the client saw "Database error recording payment attempt".
--
-- The portal path (submit_portal_payment) accepted neither field, so the
-- screenshot a client typed in the portal was silently dropped. Both lanes
-- now store the same two columns.

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS notes TEXT;

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

  IF tx_ref IS NULL OR btrim(tx_ref) = '' OR char_length(btrim(tx_ref)) > 64 THEN
    RAISE EXCEPTION 'A valid transaction reference is required';
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

-- The old five-argument entry point is replaced by the seven-argument one.
DROP FUNCTION IF EXISTS public.submit_portal_payment(text, uuid, numeric, text, text);
