-- Migration: Close the remaining portal/payment audit findings.
--
-- 1. Draft invoices were readable by portal clients and payable. Both read RPCs
--    now skip drafts and submit_portal_payment rejects them.
-- 2. submit_portal_payment allowed a second attempt while one was already
--    awaiting verification, so a client could queue several UTRs per invoice.
-- 3. portal_token_expires_at was never set, so portal_token_is_live fell back to
--    "created_at + 90 days": every link died forever 90 days after the project
--    was created, with no way to issue a new one. Expiry is now explicit,
--    backfilled and renewable by rotating the token.
-- 4. OTP verification was decorative: submit_portal_signature trusted an
--    email_verified boolean supplied by the browser. It now requires a verified,
--    unexpired portal_verifications row. The OTP email finally contains the code,
--    and the RPC returns the email_log id so send-email dispatches exactly that
--    message instead of "the newest pending log of this project".
-- 5. get_dashboard_data counted drafts as receivable, used invoice total instead
--    of outstanding_balance, and labelled all-time paid invoices "earned this
--    month". Money now comes from completed payments with real dates.
-- 6. Email bodies HTML-escape the user-controlled values interpolated into them.

-- ---------------------------------------------------------------------------
-- 6. HTML escaping helper (email bodies are sent as HTML)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.html_escape(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(COALESCE(p_value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- ---------------------------------------------------------------------------
-- 3. Portal token lifetime
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ALTER COLUMN portal_token_expires_at
  SET DEFAULT (now() + interval '90 days');

UPDATE public.projects
SET portal_token_expires_at = created_at + interval '90 days'
WHERE portal_token_expires_at IS NULL;

-- Explicit expiry is authoritative. NULL (a row inserted before the backfill
-- above commits) keeps the legacy 90-day window.
CREATE OR REPLACE FUNCTION public.portal_token_is_live(p_created_at timestamptz, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_expires_at, p_created_at + interval '90 days') > now();
$$;

-- ---------------------------------------------------------------------------
-- 1. Portal reads never expose drafts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_invoices(token_val text)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT inv.* FROM public.invoices inv
  JOIN public.projects p ON p.id = inv.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND inv.deleted_at IS NULL
    AND inv.status <> 'draft'
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

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
    AND p.deleted_at IS NULL
    AND inv.deleted_at IS NULL
    AND inv.status <> 'draft'
    -- public.invoice_items has no deleted_at column; do not filter it
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

-- ---------------------------------------------------------------------------
-- 1 + 2. Portal payment guards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_portal_payment(
  token_val text,
  invoice_id_val UUID,
  amt NUMERIC,
  pay_method text,
  tx_ref text
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
  SELECT id, workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects
  WHERE portal_token = token_val
    AND deleted_at IS NULL
    AND public.portal_token_is_live(created_at, portal_token_expires_at);

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

  -- IS NOT TRUE, not NOT: when the invoice row is missing the SELECT INTO leaves
  -- v_invoice_exists NULL, and "NOT NULL" does not fire, so every later guard
  -- (amount, status) would be skipped and the raw FK error would reach the client.
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
      AND deleted_at IS NULL
      AND status IN ('pending', 'pending_verification')
  ) THEN
    RAISE EXCEPTION 'A payment for this invoice is already awaiting verification';
  END IF;

  IF EXISTS(SELECT 1 FROM public.payments WHERE transaction_reference = tx_ref) OR
     EXISTS(SELECT 1 FROM public.payment_attempts WHERE utr_number = tx_ref) THEN
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
    gen_random_uuid(),
    v_workspace_id,
    v_project_id,
    'Payment Submitted',
    jsonb_build_object('invoice_id', invoice_id_val, 'amount', amt, 'transaction_reference', tx_ref)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. OTP generation: include the code and return the email log id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generate_portal_verification(text);

CREATE FUNCTION public.generate_portal_verification(token_val text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_client_email TEXT;
  v_workspace_id UUID;
  v_code TEXT;
  v_last_sent TIMESTAMP WITH TIME ZONE;
  v_generation_count INT;
  v_entropy BYTEA;
  v_log_id UUID;
BEGIN
  DELETE FROM public.portal_verifications WHERE expires_at < now();

  SELECT p.id, cl.email, p.workspace_id INTO v_project_id, v_client_email, v_workspace_id
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  SELECT MAX(last_sent_at) INTO v_last_sent
  FROM public.portal_verifications
  WHERE project_id = v_project_id AND email = v_client_email;

  IF v_last_sent IS NOT NULL AND v_last_sent + interval '60 seconds' > now() THEN
    RAISE EXCEPTION 'Please wait 60 seconds before requesting a new code';
  END IF;

  SELECT COUNT(*) INTO v_generation_count
  FROM public.portal_verifications
  WHERE email = v_client_email AND created_at + interval '24 hours' > now();

  IF v_generation_count >= 10 THEN
    RAISE EXCEPTION 'Too many verification attempts. Please try again tomorrow.';
  END IF;

  -- CSPRNG-derived 6-digit code (pgcrypto, seeded from OpenSSL).
  v_entropy := extensions.gen_random_bytes(4);
  v_code := (((get_byte(v_entropy, 0)::bigint << 22)
           | (get_byte(v_entropy, 1)::bigint << 14)
           | (get_byte(v_entropy, 2)::bigint << 6)
           | (get_byte(v_entropy, 3)::bigint >> 2)) % 900000 + 100000)::text;

  INSERT INTO public.portal_verifications (project_id, email, code_hash, attempts, max_attempts, expires_at, last_sent_at)
  VALUES (
    v_project_id,
    v_client_email,
    extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
    0,
    5,
    now() + interval '15 minutes',
    now()
  );

  INSERT INTO public.email_logs (
    id, workspace_id, project_id, recipient, subject, body, status, created_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    v_project_id,
    v_client_email,
    'Verification Code for Ujrat Contract Signature',
    '<p>Your Ujrat verification code is <strong>' || v_code || '</strong>.</p>'
      || '<p>It expires in 15 minutes. If you did not request this code, ignore this email.</p>',
    'pending',
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_portal_verification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_portal_verification(text) TO anon, authenticated, service_role;

-- Verification extends the signing window from the moment it succeeds.
CREATE OR REPLACE FUNCTION public.verify_portal_code(token_val text, entered_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  IF entered_code IS NULL OR char_length(btrim(entered_code)) <> 6 THEN
    RETURN false;
  END IF;

  SELECT pv.id, pv.code_hash, pv.attempts, pv.max_attempts
  INTO v_record
  FROM public.portal_verifications pv
  JOIN public.projects p ON p.id = pv.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at)
    AND pv.verified = false
    AND pv.expires_at > now()
  ORDER BY pv.created_at DESC
  LIMIT 1
  FOR UPDATE OF pv;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_record.attempts >= v_record.max_attempts THEN
    RETURN false;
  END IF;

  IF v_record.code_hash = extensions.crypt(entered_code, v_record.code_hash) THEN
    UPDATE public.portal_verifications
    SET verified = true, expires_at = now() + interval '15 minutes'
    WHERE id = v_record.id;
    RETURN true;
  ELSE
    UPDATE public.portal_verifications SET attempts = attempts + 1 WHERE id = v_record.id;
    RETURN false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Signature requires a server-side OTP verification; no client boolean.
--    Returns the email_log id of the freelancer notification (NULL when the
--    freelancer has no email).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_portal_signature(text, text, text, boolean, text, text);

CREATE FUNCTION public.submit_portal_signature(
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
BEGIN
  IF sig_name IS NULL OR char_length(btrim(sig_name)) < 2 THEN
    RAISE EXCEPTION 'Signature name is required';
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

  -- The only proof of email ownership is the row verify_portal_code marked
  -- verified; the browser cannot assert this for itself.
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_verifications
    WHERE project_id = v_project_id
      AND verified = true
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Email verification is required before signing';
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

-- ---------------------------------------------------------------------------
-- 5. Dashboard money
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
    v_monthly_revenue JSONB;
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

    -- Draft invoices are not receivables, and the remaining balance is the
    -- outstanding_balance after any partial payments.
    SELECT COALESCE(SUM(COALESCE(outstanding_balance, total)), 0)
      INTO v_outstanding
    FROM public.invoices
    WHERE workspace_id = p_workspace_id
      AND deleted_at IS NULL
      AND status NOT IN ('paid', 'cancelled', 'draft');

    -- "Earned" is cash received, not invoices issued.
    SELECT COALESCE(SUM(amount), 0)
      INTO v_earned_this_month
    FROM public.payments
    WHERE workspace_id = p_workspace_id
      AND deleted_at IS NULL
      AND status = 'completed'
      AND payment_date >= date_trunc('month', now());

    -- January..December of the current year, indexed by EXTRACT(MONTH).
    SELECT COALESCE(jsonb_agg(month_total ORDER BY month_index), '[]'::jsonb)
      INTO v_monthly_revenue
    FROM (
        SELECT g.month_index, COALESCE(SUM(pay.amount), 0) AS month_total
        FROM generate_series(1, 12) AS g(month_index)
        LEFT JOIN public.payments pay
          ON pay.workspace_id = p_workspace_id
         AND pay.deleted_at IS NULL
         AND pay.status = 'completed'
         AND EXTRACT(YEAR FROM pay.payment_date) = EXTRACT(YEAR FROM now())
         AND EXTRACT(MONTH FROM pay.payment_date) = g.month_index
        GROUP BY g.month_index
    ) months;

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
            'earned_this_month', v_earned_this_month,
            'monthly_revenue', v_monthly_revenue
        ),
        'recent_projects', v_projects,
        'recent_invoices', v_invoices,
        'recent_activities', v_activities
    );
END;
$$;
