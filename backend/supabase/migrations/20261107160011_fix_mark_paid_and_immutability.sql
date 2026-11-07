-- Migration: close money-layer holes found in the senior repo audit.
--
-- 1. mark_invoice_paid_transactional() fabricated a MANUAL-<uuid> completed
--    payment for the shortfall, so any dashboard click settled an invoice
--    with zero money received. The fabricated branch is deleted; the RPC now
--    RAISES unless existing completed payments cover the invoice total.
-- 2. reconcile_gateway_payment() used SET search_path = public, pg_temp and
--    an unscoped idempotency check: a replayed transaction id for a
--    DIFFERENT invoice silently returned idempotent-true. Scoped to
--    (invoice_id, transaction_reference); a transaction id bound to another
--    invoice now raises instead of silently no-op-ing.
-- 3. enforce_invoice_immutability() compared financial columns with <>
--    (NULL-safe FALSE), letting issued invoices change totals/dates/balances
--    from NULL to anything. All comparisons are IS DISTINCT FROM now.
-- 4. get_portal_bundle() returned to_jsonb(p.*) (portal_token echoed to the
--    anon caller) and to_jsonb(c.*) (full client PII incl. internal notes).
--    Replaced with explicit projections: no portal_token, no client notes.
--    Bank details are kept: the client needs the full account number/IFSC
--    to pay by NEFT (UPI QR uses upi_id).
-- 5. payment_attempts.utr_number was globally UNIQUE: one workspace's UTR
--    blocked any other workspace (and every test user) from reusing it.
--    Scoped to (workspace_id, utr_number).
-- 6. Child tables (invoice_items, proposal_sections, payment_attempts,
--    contract_signatures) had no workspace-alignment triggers, so a row in
--    workspace A could point at a parent in workspace B and RLS would pass.
--    Added the same BEFORE INSERT OR UPDATE triggers used by the parents.

-- ---------------------------------------------------------------------------
-- 1. mark_invoice_paid_transactional: require real completed payments.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_transactional(
  p_workspace_id uuid,
  p_profile_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment jsonb;
  v_invoice jsonb;
  v_completed_sum NUMERIC;
  v_invoice_total NUMERIC;
  v_latest_utr TEXT;
  v_attempt_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  SELECT total INTO v_invoice_total
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in workspace';
  END IF;

  SELECT id, utr_number INTO v_attempt_id, v_latest_utr
  FROM public.payment_attempts
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
  ORDER BY attempted_at DESC
  LIMIT 1;

  UPDATE public.payment_attempts
  SET status = 'verified'
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
    AND status = 'pending_verification'
    AND (v_latest_utr IS NULL OR utr_number = v_latest_utr);

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
        'approved', v_latest_utr, 'Verified via dashboard', now()
      );
    ELSE
      UPDATE public.payment_verifications
      SET verification_status = 'approved', verified_at = now()
      WHERE payment_attempt_id = v_attempt_id;
    END IF;
  END IF;

  UPDATE public.payments
  SET status = 'completed',
      verified_at = COALESCE(verified_at, now()),
      verifier_id = COALESCE(verifier_id, auth.uid())
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id
    AND status IN ('pending', 'pending_verification')
    AND (v_latest_utr IS NULL OR transaction_reference = v_latest_utr);

  SELECT COALESCE(SUM(amount), 0), jsonb_agg(to_jsonb(p.*)) INTO v_completed_sum, v_payment
  FROM public.payments p
  WHERE p.invoice_id = p_invoice_id AND p.workspace_id = p_workspace_id AND p.status = 'completed';

  -- No fabricated top-up: settlement requires completed payments covering the
  -- invoice total. A click without a real payment now fails loudly.
  IF v_completed_sum < v_invoice_total THEN
    RAISE EXCEPTION 'Cannot mark paid: completed payments (%) do not cover invoice total (%)',
      v_completed_sum, v_invoice_total;
  END IF;

  UPDATE public.invoices
  SET status = 'paid', outstanding_balance = 0, updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  RETURNING to_jsonb(public.invoices.*) INTO v_invoice;

  RETURN jsonb_build_object(
    'success', true,
    'invoice', v_invoice,
    'payments', COALESCE(v_payment, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. reconcile_gateway_payment: scoped idempotency, search_path = public.
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

  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Invoice is already fully settled';
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be reconciled';
  END IF;

  -- Idempotency scoped to this invoice: the same gateway transaction must
  -- never settle twice, but a transaction id bound to a DIFFERENT invoice is
  -- a replay/confusion and must fail, not silently no-op.
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

  -- Cross-invoice transaction id: transaction_reference is globally unique,
  -- so a hit here means the id settled another invoice already.
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE transaction_reference = p_transaction_id AND invoice_id <> p_invoice_id
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
-- 3. enforce_invoice_immutability: NULL-safe comparisons throughout.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_completed_sum NUMERIC;
BEGIN
  IF OLD.status <> 'draft' THEN
    IF OLD.project_id IS DISTINCT FROM NEW.project_id
       OR OLD.invoice_number IS DISTINCT FROM NEW.invoice_number
       OR OLD.invoice_date IS DISTINCT FROM NEW.invoice_date
       OR OLD.due_date IS DISTINCT FROM NEW.due_date
       OR OLD.notes IS DISTINCT FROM NEW.notes
       OR OLD.gstin IS DISTINCT FROM NEW.gstin
       OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
       OR OLD.cgst IS DISTINCT FROM NEW.cgst
       OR OLD.sgst IS DISTINCT FROM NEW.sgst
       OR OLD.igst IS DISTINCT FROM NEW.igst
       OR OLD.total IS DISTINCT FROM NEW.total
       OR OLD.taxable_amount IS DISTINCT FROM NEW.taxable_amount
       OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount
       OR OLD.discount_type IS DISTINCT FROM NEW.discount_type
       OR OLD.discount_scope IS DISTINCT FROM NEW.discount_scope
       OR OLD.cess_amount IS DISTINCT FROM NEW.cess_amount
       OR OLD.tds_section IS DISTINCT FROM NEW.tds_section
       OR OLD.tds_rate IS DISTINCT FROM NEW.tds_rate
       OR OLD.tds_amount IS DISTINCT FROM NEW.tds_amount
       OR OLD.net_receivable IS DISTINCT FROM NEW.net_receivable
       OR OLD.round_off IS DISTINCT FROM NEW.round_off
       OR OLD.currency IS DISTINCT FROM NEW.currency
       OR OLD.exchange_rate IS DISTINCT FROM NEW.exchange_rate
       OR OLD.inr_total IS DISTINCT FROM NEW.inr_total
       OR OLD.supply_type IS DISTINCT FROM NEW.supply_type
       OR OLD.tax_scheme IS DISTINCT FROM NEW.tax_scheme
       OR OLD.freelancer_gstin IS DISTINCT FROM NEW.freelancer_gstin
       OR OLD.client_gstin IS DISTINCT FROM NEW.client_gstin
       OR OLD.freelancer_state IS DISTINCT FROM NEW.freelancer_state
       OR OLD.client_state IS DISTINCT FROM NEW.client_state
       OR OLD.is_interstate IS DISTINCT FROM NEW.is_interstate
       OR OLD.is_zero_rated IS DISTINCT FROM NEW.is_zero_rated
       OR OLD.is_reverse_charge IS DISTINCT FROM NEW.is_reverse_charge
       OR OLD.prefix IS DISTINCT FROM NEW.prefix
       OR OLD.year IS DISTINCT FROM NEW.year
       OR OLD.serial_number IS DISTINCT FROM NEW.serial_number
       OR OLD.revision_number IS DISTINCT FROM NEW.revision_number
    THEN
      RAISE EXCEPTION 'Issued invoices are financially immutable and cannot be modified';
    END IF;

    -- outstanding_balance may only move together with a status change
    -- (settlement recomputation), never silently on its own. A balance move
    -- staying in the same status is accepted only when it is a faithful
    -- recomputation: total minus completed (non-deleted) payments.
    IF OLD.outstanding_balance IS DISTINCT FROM NEW.outstanding_balance AND OLD.status = NEW.status THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
      FROM public.payments
      WHERE invoice_id = NEW.id AND status = 'completed' AND deleted_at IS NULL;
      IF NEW.total - v_completed_sum <> NEW.outstanding_balance THEN
        RAISE EXCEPTION 'Invoice balance cannot be modified without a status transition';
      END IF;
    END IF;
  END IF;

  -- F19: settled invoices cannot be erased.
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF NEW.status = 'paid' THEN
      RAISE EXCEPTION 'Paid invoices cannot be deleted';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
    FROM public.payments
    WHERE invoice_id = NEW.id AND status = 'completed' AND deleted_at IS NULL;
    IF v_completed_sum > 0 THEN
      RAISE EXCEPTION 'Invoices with completed payments cannot be deleted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. get_portal_bundle: scoped projections (no portal_token echo, no notes).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_portal_bundle(token_val text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_project jsonb;
  v_client jsonb;
  v_settings jsonb;
  v_proposal jsonb;
  v_contract jsonb;
  v_invoices jsonb;
  v_deliverables jsonb;
  v_view_count bigint;
  v_last_viewed timestamptz;
BEGIN
  SELECT p.id, p.workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects p
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object(
      'project', NULL, 'client', NULL, 'settings', NULL,
      'proposal', NULL, 'contract', NULL, 'invoices', '[]'::jsonb,
      'deliverables', '[]'::jsonb, 'lastViewedAt', NULL, 'viewCount', 0
    );
  END IF;

  -- Fire-and-forget view tracking: a failed insert never fails the read.
  BEGIN
    INSERT INTO public.activity_logs (id, workspace_id, project_id, action, details)
    VALUES (gen_random_uuid(), v_workspace_id, v_project_id, 'portal_view', jsonb_build_object('via', 'get_portal_bundle'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT to_jsonb(proj) INTO v_project
  FROM (
    SELECT p.id, p.workspace_id, p.name, p.client_id, p.budget, p.status,
           p.timeline_start, p.timeline_end, p.notes,
           p.created_at, p.updated_at
    FROM public.projects p WHERE p.id = v_project_id
  ) proj;

  SELECT to_jsonb(cli) INTO v_client
  FROM (
    SELECT c.id, c.name, c.company, c.email, c.phone, c.gstin, c.state, c.address
    FROM public.clients c
    WHERE c.id = (SELECT client_id FROM public.projects WHERE id = v_project_id)
      AND c.deleted_at IS NULL
  ) cli;

  SELECT to_jsonb(s) INTO v_settings
  FROM (
    SELECT s.company_name, s.gstin, s.upi_id, s.logo_url, s.state,
           s.address, s.phone, s.bank_name, s.bank_account_no, s.bank_ifsc,
           s.is_gst_registered, s.tax_scheme, s.lut_number
    FROM public.workspace_settings s WHERE s.workspace_id = v_workspace_id
  ) s;

  SELECT to_jsonb(prop) INTO v_proposal
  FROM (
    SELECT prop.id, prop.workspace_id, prop.project_id, prop.introduction,
           prop.scope, prop.status, prop.created_at, prop.updated_at
    FROM public.proposals prop
    WHERE prop.project_id = v_project_id AND prop.deleted_at IS NULL
  ) prop LIMIT 1;

  SELECT to_jsonb(contr) INTO v_contract
  FROM (
    SELECT contr.id, contr.workspace_id, contr.project_id, contr.title,
           contr.introduction, contr.payment_schedule, contr.terms,
           contr.status, contr.created_at, contr.updated_at
    FROM public.contracts contr
    WHERE contr.project_id = v_project_id AND contr.deleted_at IS NULL
  ) contr LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(inv) || jsonb_build_object('invoice_items', COALESCE(items, '[]'::jsonb))), '[]'::jsonb)
  INTO v_invoices
  FROM (
    SELECT i.* FROM public.invoices i
    WHERE i.project_id = v_project_id AND i.deleted_at IS NULL AND i.status <> 'draft'
  ) inv,
  LATERAL (
    SELECT COALESCE(jsonb_agg(to_jsonb(ii.*)), '[]'::jsonb) AS items
    FROM public.invoice_items ii WHERE ii.invoice_id = inv.id
  ) items_holder;

  SELECT COALESCE(jsonb_agg(to_jsonb(d.*)), '[]'::jsonb) INTO v_deliverables
  FROM public.deliverables d
  WHERE d.project_id = v_project_id AND d.deleted_at IS NULL;

  SELECT COUNT(*)::bigint, MAX(created_at)
  INTO v_view_count, v_last_viewed
  FROM public.activity_logs
  WHERE project_id = v_project_id AND action = 'portal_view';

  RETURN jsonb_build_object(
    'project', v_project, 'client', v_client, 'settings', v_settings,
    'proposal', v_proposal, 'contract', v_contract, 'invoices', v_invoices,
    'deliverables', v_deliverables,
    'lastViewedAt', v_last_viewed, 'viewCount', v_view_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_portal_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_bundle(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. payment_attempts UTR uniqueness scoped to (workspace_id, utr_number).
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_utr_number_key;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_workspace_utr_key UNIQUE (workspace_id, utr_number);

-- ---------------------------------------------------------------------------
-- 6. Child-table workspace-alignment triggers (same pattern as parents).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_invoice_item_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = NEW.invoice_id AND i.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Invoice does not belong to the same workspace as the invoice item';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invoice_item_workspace_alignment ON public.invoice_items;
CREATE TRIGGER enforce_invoice_item_workspace_alignment
  BEFORE INSERT OR UPDATE OF invoice_id, workspace_id ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_item_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_proposal_section_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.proposal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = NEW.proposal_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Proposal does not belong to the same workspace as the proposal section';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_proposal_section_workspace_alignment ON public.proposal_sections;
CREATE TRIGGER enforce_proposal_section_workspace_alignment
  BEFORE INSERT OR UPDATE OF proposal_id, workspace_id ON public.proposal_sections
  FOR EACH ROW EXECUTE FUNCTION public.check_proposal_section_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_payment_attempt_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = NEW.invoice_id AND i.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Invoice does not belong to the same workspace as the payment attempt';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_attempt_workspace_alignment ON public.payment_attempts;
CREATE TRIGGER enforce_payment_attempt_workspace_alignment
  BEFORE INSERT OR UPDATE OF invoice_id, workspace_id ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_attempt_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_contract_signature_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = NEW.contract_id AND c.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Contract does not belong to the same workspace as the contract signature';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_contract_signature_workspace_alignment ON public.contract_signatures;
CREATE TRIGGER enforce_contract_signature_workspace_alignment
  BEFORE INSERT OR UPDATE OF contract_id, workspace_id ON public.contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.check_contract_signature_workspace_alignment();

-- ---------------------------------------------------------------------------
-- 7. approve_portal_proposal: only approve a proposal that was actually sent.
--    Previously any live portal token could approve a draft proposal (and
--    flip project status) before the freelancer ever shared it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_portal_proposal(token_val text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
BEGIN
  SELECT id, workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects
  WHERE portal_token = token_val
    AND deleted_at IS NULL
    AND public.portal_token_is_live(created_at, portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  UPDATE public.proposals
  SET status = 'approved',
      updated_at = timezone('utc'::text, now())
  WHERE project_id = v_project_id
    AND status = 'sent'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No sent proposal to approve for this project';
  END IF;

  UPDATE public.projects
  SET status = 'approved',
      updated_at = timezone('utc'::text, now())
  WHERE id = v_project_id;

  INSERT INTO public.activity_logs (workspace_id, project_id, action, details)
  VALUES (
    v_workspace_id,
    v_project_id,
    'proposal_approved',
    jsonb_build_object('approved_at', now())
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_portal_proposal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_portal_proposal(text) TO anon, authenticated, service_role;
