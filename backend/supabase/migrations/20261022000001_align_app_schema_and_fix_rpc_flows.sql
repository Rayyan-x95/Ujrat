-- Migration: align schema with application layer and fix RPC flows
-- Fixes audit findings #1, #3, #5, #9, #10 (SQL-side); app-side column lists locked.
-- Preserves the fixes from 20261020000003 (Mark-paid top-up) and
-- 20261020000005 (portal signature hardening): email-verified + signable
-- contract + conditional project advance, pending-then-promote top-up with a
-- fresh MANUAL reference, and FOR UPDATE lock on the invoice.

-- ---------------------------------------------------------------------------
-- #1 Schema drift: ensure columns the app writes exist in baseline tables.
-- All ADD COLUMN IF NOT EXISTS so this is idempotent and safe on fresh DBs.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_audit_logs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;

-- #10 rate-limit housekeeping index
CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_window_started
  ON public.edge_function_rate_limits (window_started_at);

-- duplicate-UTR detection index
CREATE INDEX IF NOT EXISTS idx_payments_transaction_reference
  ON public.payments (transaction_reference);

-- ---------------------------------------------------------------------------
-- #3 Portal invoice print needs line items: expose invoice_items to anon via RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_portal_invoice_items(token_val text)
RETURNS SETOF public.invoice_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ii.* FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.projects p ON p.id = inv.project_id
  WHERE p.portal_token = token_val
    AND inv.deleted_at IS NULL
    -- public.invoice_items has no deleted_at column; do not filter it
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

-- ---------------------------------------------------------------------------
-- #9 Repeat portal signature must be idempotent (contract_signatures UNIQUE contract_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_portal_signature(
  token_val text,
  sig_name text,
  ip_addr text DEFAULT NULL,
  email_verified boolean DEFAULT false,
  sig_image text DEFAULT NULL,
  sig_type text DEFAULT 'drawn'
)
RETURNS void
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
BEGIN
  -- email_verified must mean what it says: no signature without verification.
  IF email_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Email verification is required before signing';
  END IF;

  SELECT p.id, p.workspace_id, p.name, cl.name INTO v_project_id, v_workspace_id, v_project_name, v_client_name
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
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

  SELECT w.profile_id, prof.email INTO v_freelancer_profile_id, v_freelancer_email
  FROM public.workspaces w
  JOIN public.profiles prof ON prof.id = w.profile_id
  WHERE w.id = v_workspace_id;

  INSERT INTO public.contract_signatures (
    id, workspace_id, contract_id, signature_name, signature_image,
    signature_type, ip_address, signature_date
  ) VALUES (
    gen_random_uuid(), v_workspace_id, v_contract_id, sig_name, sig_image,
    COALESCE(sig_type, 'drawn'), COALESCE(ip_addr, 'unknown'), now()
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
      'Agreement Signed: ' || v_project_name || ' by ' || COALESCE(v_client_name, 'Client'),
      'Hello, your client (' || COALESCE(v_client_name, 'Client') || ') has digitally signed the project agreement for "' || v_project_name || '". ' ||
      'Signature name: ' || sig_name || ' at ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS UTC') || '. ' ||
      'Your project is now in contract_signed status and ready for execution.',
      'pending', 0, 3
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- #5 mark_invoice_paid_transactional must promote only the verified UTR,
-- not every pending payment row for the invoice.
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
  v_topup_payment_id UUID;
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
  -- lock the invoice so two concurrent calls cannot both top-up
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

  IF v_completed_sum < v_invoice_total THEN
    -- The payments integrity trigger forbids interactive callers from
    -- inserting an already-completed payment, and the UTR already exists in
    -- payments (transaction_reference UNIQUE). Insert as pending with a fresh
    -- MANUAL reference, then promote with verifier attribution.
    INSERT INTO public.payments (
      workspace_id, invoice_id, amount, payment_method, transaction_reference,
      payment_date, status, notes
    ) VALUES (
      p_workspace_id, p_invoice_id, v_invoice_total - v_completed_sum, 'UPI',
      'MANUAL-' || gen_random_uuid()::text,
      now(), 'pending', 'Payment verified directly via dashboard'
    ) RETURNING id INTO v_topup_payment_id;

    UPDATE public.payments
    SET status = 'completed',
        verified_at = COALESCE(verified_at, now()),
        verifier_id = COALESCE(verifier_id, auth.uid())
    WHERE id = v_topup_payment_id;

    SELECT COALESCE(SUM(amount), 0), jsonb_agg(to_jsonb(p.*)) INTO v_completed_sum, v_payment
    FROM public.payments p
    WHERE p.invoice_id = p_invoice_id AND p.workspace_id = p_workspace_id AND p.status = 'completed';
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

-- ---------------------------------------------------------------------------
-- #4 Dashboard money must aggregate ALL invoices, not the 10 newest.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_profile UUID;
    v_profile_name TEXT;
    v_total_clients INT;
    v_projects JSONB;
    v_invoices JSONB;
    v_activities JSONB;
    v_outstanding NUMERIC;
    v_earned_this_month NUMERIC;
    v_monthly_revenue NUMERIC[];
BEGIN
    v_caller_profile := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = p_workspace_id
          AND profile_id = v_caller_profile
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id;
    END IF;

    SELECT full_name INTO v_profile_name
    FROM public.profiles
    WHERE id = v_caller_profile;

    SELECT COUNT(*) INTO v_total_clients
    FROM public.clients
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    SELECT COALESCE(SUM(CASE WHEN status <> 'paid' AND status <> 'cancelled' THEN total ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)
      INTO v_outstanding, v_earned_this_month
    FROM public.invoices
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb) INTO v_projects
    FROM (
        SELECT id, name, client_id, budget, status, timeline_start, timeline_end, portal_token, created_at, updated_at
        FROM public.projects
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) p;

    SELECT COALESCE(jsonb_agg(to_jsonb(i.*)), '[]'::jsonb) INTO v_invoices
    FROM (
        SELECT id, project_id, invoice_number, total, status, due_date, outstanding_balance, created_at
        FROM public.invoices
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) i;

    SELECT COALESCE(jsonb_agg(to_jsonb(a.*)), '[]'::jsonb) INTO v_activities
    FROM (
        SELECT id, project_id, action, details, created_at
        FROM public.activity_logs
        WHERE workspace_id = p_workspace_id
        ORDER BY created_at DESC
        LIMIT 20
    ) a;

    RETURN jsonb_build_object(
        'profile', jsonb_build_object('name', v_profile_name),
        'metrics', jsonb_build_object(
            'total_clients', v_total_clients,
            'outstanding', v_outstanding,
            'earned_this_month', v_earned_this_month
        ),
        'recent_projects', v_projects,
        'recent_invoices', v_invoices,
        'recent_activities', v_activities
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants for new/changed functions
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_portal_invoice_items(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_invoice_items(text) TO anon, authenticated, service_role;

-- submit_portal_signature and mark_invoice_paid_transactional grants already
-- exist in baseline; re-assert for safety.
REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean, text, text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;
