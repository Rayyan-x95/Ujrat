-- Migration: Portal payment attempt guards (duplicate UTR + throttle)
-- The serial duplicate guard in submit_portal_payment() checks payments/payment_attempts
-- before inserting, but it is not race-safe: FOR UPDATE locks only the invoice row, so two
-- concurrent portal submissions for different invoices in the same workspace with the same
-- UTR both pass the guard. The loser then violates the payments.transaction_reference UNIQUE
-- constraint and leaks a raw unique_violation to the anon client. Wrap the payment inserts so
-- the loser raises the same user-facing error as the serial path.
--
-- This RPC is also called directly from the browser with the anon key, so nothing
-- rate limits the caller. A token holder could insert unlimited payment_attempts
-- rows and flood the freelancer's verification queue. The same function now
-- allows at most 5 submissions per invoice per 10 minutes.
--
-- Third fix: the "invoice belongs to this project" guard used "IF NOT v_invoice_exists".
-- A missing invoice leaves the variable NULL (SELECT INTO finds no row), and
-- "NOT NULL" is NULL, so the guard did not fire and every later check was skipped.
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

  IF v_invoice_status = 'paid' THEN
    RAISE EXCEPTION 'Invoice is already paid';
  ELSIF v_invoice_status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice is cancelled';
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
