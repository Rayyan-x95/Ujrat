-- Migration: Trigger fixes - NULL-safe immutability comparison and project transition parity
--
-- 1. enforce_invoice_immutability() compared nullable money columns with "<>".
--    In SQL, NULL <> value is NULL, not TRUE, so the guard did not fire:
--      OLD.tds_rate <> NEW.tds_rate      (tds_rate is nullable)
--      OLD.tds_amount <> NEW.tds_amount
--      OLD.round_off <> NEW.round_off
--      OLD.exchange_rate <> NEW.exchange_rate
--      OLD.inr_total <> NEW.inr_total
--    An issued invoice could therefore have its TDS or FX figures changed from
--    NULL to a value without the "financially immutable" guard raising. Those
--    columns now use IS DISTINCT FROM, like the text columns already do.
--
-- 2. validate_project_status_transition() rejected invoice_sent -> delivered,
--    but ProjectStateMachine (frontend/src/shared/utils/StateMachine.ts) allows
--    it: invoice_sent: ['paid', 'archived', 'delivered']. The DB trigger now
--    accepts 'delivered' as well.

CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger AS $$
DECLARE
  v_completed_sum NUMERIC;
BEGIN
  IF OLD.status <> 'draft' THEN
    IF OLD.project_id <> NEW.project_id
       OR OLD.invoice_number <> NEW.invoice_number
       OR OLD.invoice_date <> NEW.invoice_date
       OR OLD.due_date <> NEW.due_date
       OR OLD.notes IS DISTINCT FROM NEW.notes
       OR OLD.gstin IS DISTINCT FROM NEW.gstin
       OR OLD.subtotal <> NEW.subtotal
       OR OLD.cgst <> NEW.cgst
       OR OLD.sgst <> NEW.sgst
       OR OLD.igst <> NEW.igst
       OR OLD.total <> NEW.total
       OR OLD.taxable_amount <> NEW.taxable_amount
       OR OLD.discount_amount <> NEW.discount_amount
       OR OLD.discount_type IS DISTINCT FROM NEW.discount_type
       OR OLD.discount_scope IS DISTINCT FROM NEW.discount_scope
       OR OLD.cess_amount <> NEW.cess_amount
       OR OLD.tds_section IS DISTINCT FROM NEW.tds_section
       OR OLD.tds_rate IS DISTINCT FROM NEW.tds_rate
       OR OLD.tds_amount IS DISTINCT FROM NEW.tds_amount
       OR OLD.net_receivable <> NEW.net_receivable
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
       OR OLD.revision_number <> NEW.revision_number
    THEN
      RAISE EXCEPTION 'Issued invoices are financially immutable and cannot be modified';
    END IF;

    -- outstanding_balance may only move together with a status change
    -- (settlement recomputation), never silently on its own.
    IF OLD.outstanding_balance <> NEW.outstanding_balance AND OLD.status = NEW.status THEN
      RAISE EXCEPTION 'Invoice balance cannot be modified without a status transition';
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.validate_project_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'archived' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'lead' AND NEW.status NOT IN ('proposal') THEN
    RAISE EXCEPTION 'Invalid transition from lead to %', NEW.status;
  ELSIF OLD.status = 'proposal' AND NEW.status NOT IN ('approved') THEN
    RAISE EXCEPTION 'Invalid transition from proposal to %', NEW.status;
  ELSIF OLD.status = 'approved' AND NEW.status NOT IN ('contract_signed') THEN
    RAISE EXCEPTION 'Invalid transition from approved to %', NEW.status;
  ELSIF OLD.status = 'contract_signed' AND NEW.status NOT IN ('advance_paid', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid transition from contract_signed to %', NEW.status;
  ELSIF OLD.status = 'advance_paid' AND NEW.status NOT IN ('in_progress') THEN
    RAISE EXCEPTION 'Invalid transition from advance_paid to %', NEW.status;
  ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('delivered') THEN
    RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
  ELSIF OLD.status = 'delivered' AND NEW.status NOT IN ('invoice_sent') THEN
    RAISE EXCEPTION 'Invalid transition from delivered to %', NEW.status;
  ELSIF OLD.status = 'invoice_sent' AND NEW.status NOT IN ('paid', 'delivered') THEN
    RAISE EXCEPTION 'Invalid transition from invoice_sent to %', NEW.status;
  ELSIF OLD.status = 'paid' AND NEW.status NOT IN ('completed') THEN
    RAISE EXCEPTION 'Invalid transition from paid to %', NEW.status;
  ELSIF OLD.status = 'completed' AND NEW.status NOT IN ('archived') THEN
    RAISE EXCEPTION 'Invalid transition from completed to %', NEW.status;
  ELSIF OLD.status = 'archived' AND NEW.status NOT IN ('lead', 'in_progress', 'proposal') THEN
    RAISE EXCEPTION 'Invalid transition from archived to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
