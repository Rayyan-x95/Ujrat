-- Migration: Gateway reconciliation must support partial payments and be race-safe
-- Two defects in reconcile_gateway_payment():
--
-- 1. Partial capture always failed. v_new_status kept the old status when the
--    invoice was not fully settled, but the invoice immutability trigger
--    (enforce_invoice_immutability) forbids changing outstanding_balance
--    without a status transition:
--      IF OLD.outstanding_balance <> NEW.outstanding_balance AND OLD.status = NEW.status
--        THEN RAISE EXCEPTION 'Invoice balance cannot be modified without a status transition';
--    A gateway capture of less than the invoice total therefore failed 100% of
--    the time and the gateway retried forever. invoices.status already allows
--    'partially_paid' (CHECK constraint), so the fix is to actually use it.
--
-- 2. Idempotency was check-then-insert. The "already reconciled?" SELECT ran
--    before the invoice row lock, so two concurrent deliveries of the same
--    capture both passed the check; the loser hit the payments
--    transaction_reference UNIQUE constraint and returned 500, keeping the
--    gateway in a retry loop. The insert now catches unique_violation and
--    returns the same idempotent payload as the serial path.

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
SET search_path = public, pg_temp
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

  -- Idempotency: same gateway transaction must never settle twice.
  SELECT id INTO v_existing_payment_id
  FROM public.payments
  WHERE transaction_reference = p_transaction_id;

  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Transaction already reconciled',
      'payment_id', v_existing_payment_id
    );
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

  IF p_amount > COALESCE(v_invoice.outstanding_balance, v_invoice.total) THEN
    RAISE EXCEPTION 'Reconciliation amount (%) exceeds outstanding balance (%)',
      p_amount, COALESCE(v_invoice.outstanding_balance, v_invoice.total);
  END IF;

  -- Concurrent deliveries of the same capture serialise on the invoice lock
  -- above; the loser must be told the transaction already settled instead of
  -- failing on the transaction_reference UNIQUE constraint.
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
    WHERE transaction_reference = p_transaction_id;

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
