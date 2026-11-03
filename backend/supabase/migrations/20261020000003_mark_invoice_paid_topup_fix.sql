-- Migration: Fix the "Mark paid" top-up path in mark_invoice_paid_transactional()
-- The dashboard "Mark paid" RPC could never record a top-up payment:
--
-- 1. It inserted the top-up with status 'completed'. The payments integrity
--    trigger (validate_payment_mutation) only allows interactive callers
--    (auth.uid() IS NOT NULL) to INSERT a payment as 'pending' or
--    'pending_verification':
--      IF NEW.status NOT IN ('pending', 'pending_verification') AND auth.uid() IS NOT NULL
--        THEN RAISE EXCEPTION 'Payments must be created as pending for interactive callers';
--    The dashboard is interactive, so the insert always raised.
--
-- 2. It reused v_latest_utr as the transaction reference. That UTR already
--    exists in payments (it came from the portal submission), so the
--    transaction_reference UNIQUE constraint raised a second time.
--
-- 3. The invoice row was read without a lock, so two concurrent calls could
--    both decide a top-up is needed and double-insert.
--
-- Fix: insert the top-up as 'pending' and promote it to 'completed' with
-- verifier attribution (the forward-only pending -> completed transition is
-- allowed by the same trigger), always mint a unique reference, and lock the
-- invoice row before computing the outstanding amount.

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
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id AND status = 'pending_verification';

  IF v_attempt_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_verifications
      WHERE payment_attempt_id = v_attempt_id
    ) THEN
      INSERT INTO public.payment_verifications (
        payment_attempt_id,
        workspace_id,
        invoice_id,
        verifier_id,
        verification_status,
        bank_reference,
        notes,
        verified_at
      ) VALUES (
        v_attempt_id,
        p_workspace_id,
        p_invoice_id,
        auth.uid(),
        'approved',
        v_latest_utr,
        'Verified via dashboard',
        now()
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
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id AND status IN ('pending', 'pending_verification');

  SELECT COALESCE(SUM(amount), 0), jsonb_agg(to_jsonb(p.*)) INTO v_completed_sum, v_payment
  FROM public.payments p
  WHERE p.invoice_id = p_invoice_id AND p.workspace_id = p_workspace_id AND p.status = 'completed';

  IF v_completed_sum < v_invoice_total THEN
    -- Created as 'pending' because the payments integrity trigger forbids
    -- interactive callers from inserting an already-completed payment.
    INSERT INTO public.payments (
      workspace_id,
      invoice_id,
      amount,
      payment_method,
      transaction_reference,
      payment_date,
      status,
      notes
    ) VALUES (
      p_workspace_id,
      p_invoice_id,
      v_invoice_total - v_completed_sum,
      'UPI',
      'MANUAL-' || gen_random_uuid()::text,
      now(),
      'pending',
      'Payment verified directly via dashboard'
    ) RETURNING id INTO v_topup_payment_id;

    UPDATE public.payments
    SET status = 'completed',
        verifier_id = auth.uid(),
        verified_at = now()
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
