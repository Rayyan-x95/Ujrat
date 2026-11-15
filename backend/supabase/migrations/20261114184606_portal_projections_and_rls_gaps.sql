-- Migration: portal projections, workspace-scoped UTR checks, and RLS gaps.
--
-- Fixes (verified against the live database):
--
-- 1. get_portal_project / get_portal_client returned whole rows to `anon`.
--    projects carries portal_token_hash, portal_token_prev_hash and the
--    freelancer's private notes; clients carries pan and notes. Both are
--    projected down to the fields the portal UI actually renders.
--
-- 2. The duplicate-UTR guard in submit_portal_payment was global, so one
--    workspace's UTR blocked another's. payments.transaction_reference is
--    UNIQUE globally as well, so the two are scoped per workspace here and
--    the global unique index is replaced by a per-workspace one.
--
-- 3. payment_attempts had no index on utr_number (the duplicate check did a
--    sequential scan) and no DELETE policy, so the app's compensating
--    cleanup silently failed and permanently consumed the client's UTR.
--
-- 4. profiles had no INSERT policy, so the profile self-heal upsert in
--    AuthService could never create a missing profile.
--
-- 5. invoices.outstanding_balance had DEFAULT 0.00, so the insert-defaults
--    trigger never saw NULL and left the balance at zero instead of total.
--
-- 6. get_portal_bundle (repo file 20261108000001) returned the whole
--    client row and re-introduced the raw-token comparison, and the grace
--    migration's literal replace could not match it. Both are corrected here
--    so a fresh database ends up with the same function the live database
--    has.

-- ---------------------------------------------------------------------------
-- 1. Portal projections (no token hashes, no internal notes, no PAN)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_portal_project(token_val text)
RETURNS SETOF projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.workspace_id, p.client_id, p.name, p.description, p.budget,
         p.timeline_start, p.timeline_end, p.status, p.created_at, p.updated_at
  FROM public.projects p
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex')
         OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), 'hex')
             AND p.portal_token_prev_expires_at > now()))
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_client(token_val text)
RETURNS SETOF clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.workspace_id, c.name, c.company, c.email, c.phone,
         c.whatsapp, c.address, c.state, c.gstin, c.currency,
         c.created_at, c.updated_at
  FROM public.clients c
  JOIN public.projects p ON p.client_id = c.id
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex')
         OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), 'hex')
             AND p.portal_token_prev_expires_at > now()))
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

-- get_portal_bundle: explicit projections on project and client, and the
-- grace-window lookup (the repo file's version leaked the whole client row
-- and kept the raw-token comparison).
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
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex')
         OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), 'hex')
             AND p.portal_token_prev_expires_at > now()))
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
    SELECT p.id, p.workspace_id, p.client_id, p.name, p.description, p.budget,
           p.timeline_start, p.timeline_end, p.status, p.created_at, p.updated_at
    FROM public.projects p WHERE p.id = v_project_id
  ) proj;

  SELECT to_jsonb(cli) INTO v_client
  FROM (
    SELECT c.id, c.workspace_id, c.name, c.company, c.email, c.phone,
           c.whatsapp, c.address, c.state, c.gstin, c.currency,
           c.created_at, c.updated_at
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

-- ---------------------------------------------------------------------------
-- 2. Workspace-scoped UTR uniqueness
-- ---------------------------------------------------------------------------

-- A UTR is only unique within the freelancer's own workspace; one
-- freelancer's reference must not block another's.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_transaction_reference_key;
DROP INDEX IF EXISTS public.payments_transaction_reference_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_workspace_transaction_reference_key'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_workspace_transaction_reference_key
      UNIQUE (workspace_id, transaction_reference);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. payment_attempts: index on utr_number, DELETE policy
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_attempts_utr_number
  ON public.payment_attempts (utr_number);

DROP POLICY IF EXISTS "Delete payment attempts" ON public.payment_attempts;
CREATE POLICY "Delete payment attempts" ON public.payment_attempts FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- The duplicate-UTR guard must look only inside the caller's workspace.
CREATE OR REPLACE FUNCTION public.submit_portal_payment(token_val text, invoice_id_val uuid, amt numeric, pay_method text, tx_ref text)
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

  -- IS NOT TRUE, not NOT: when the invoice row is missing the SELECT INTO
  -- leaves v_invoice_exists NULL, and "NOT NULL" does not fire, so every
  -- later guard (amount, status) would be skipped and the raw FK error
  -- would reach the client.
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

  -- One open attempt per invoice. Without this a client could queue several
  -- UTRs against the same balance before the freelancer reviews the first.
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE invoice_id = invoice_id_val
      AND workspace_id = v_workspace_id
      AND deleted_at IS NULL
      AND status IN ('pending', 'pending_verification')
  ) THEN
    RAISE EXCEPTION 'A payment for this invoice is already awaiting verification';
  END IF;

  -- Workspace-scoped: one freelancer's UTR must not block another's.
  IF EXISTS(SELECT 1 FROM public.payments WHERE workspace_id = v_workspace_id AND transaction_reference = tx_ref) OR
     EXISTS(SELECT 1 FROM public.payment_attempts WHERE workspace_id = v_workspace_id AND utr_number = tx_ref) THEN
    RAISE EXCEPTION 'Duplicate transaction reference (UTR) already used';
  END IF;

  -- Throttle: this RPC is called straight from the browser with the anon key,
  -- so there is no edge function in front of it to rate limit the caller.
  -- At most 5 submissions per invoice per 10 minutes, counted from the
  -- attempts already recorded (same pattern as the OTP throttle in
  -- generate_portal_verification).
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

    INSERT INTO public.payment_attempts (id, workspace_id, invoice_id, utr_number, amount, status, attempted_at)
    VALUES (gen_random_uuid(), v_workspace_id, invoice_id_val, tx_ref, amt, 'pending_verification', now());
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

-- ---------------------------------------------------------------------------
-- 4. profiles: allow a member to insert their own row
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Insert profile" ON public.profiles;
CREATE POLICY "Insert profile" ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 5. invoices.outstanding_balance must default to the invoice total
-- ---------------------------------------------------------------------------

-- The column default of 0.00 is applied before the BEFORE INSERT trigger
-- runs, so the trigger's "IF NEW.outstanding_balance IS NULL" branch never
-- fired and every insert that omitted the column stored a zero balance.
ALTER TABLE public.invoices ALTER COLUMN outstanding_balance DROP DEFAULT;
