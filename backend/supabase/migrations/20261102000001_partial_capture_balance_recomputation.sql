-- Migration: Fix the partial-capture invariant deadlock in enforce_invoice_immutability()
--
-- reconcile_gateway_payment (20261020000002) recomputes the invoice balance on
-- every capture. The SECOND partial capture on a partially_paid invoice keeps
-- the status (partially_paid -> partially_paid) while moving outstanding_balance,
-- and the immutability trigger rejected exactly that:
--   'Invoice balance cannot be modified without a status transition'
-- Every gateway retry re-raises forever.
--
-- The invariant that the original branch was defending against silent drift is
-- preserved, sharpened: in the same status, outstanding_balance may only move
-- when it is a faithful settlement recomputation, i.e.
--   NEW.outstanding_balance = total - SUM(completed payments, not deleted).
-- Gateway reconciliation (and any correct recomputing writer) passes; a writer
-- that just nudges the balance without touching payments still raises, with
-- the same error text as before.

CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger AS $fn$
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
       OR OLD.tds_rate <> NEW.tds_rate
       OR OLD.tds_amount <> NEW.tds_amount
       OR OLD.net_receivable <> NEW.net_receivable
       OR OLD.round_off <> NEW.round_off
       OR OLD.currency IS DISTINCT FROM NEW.currency
       OR OLD.exchange_rate <> NEW.exchange_rate
       OR OLD.inr_total <> NEW.inr_total
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
    -- (settlement recomputation), never silently on its own. A balance move
    -- staying in the same status is accepted only when it is a faithful
    -- recomputation: total minus completed (non-deleted) payments.
    IF OLD.outstanding_balance <> NEW.outstanding_balance AND OLD.status = NEW.status THEN
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
$fn$ LANGUAGE plpgsql;
