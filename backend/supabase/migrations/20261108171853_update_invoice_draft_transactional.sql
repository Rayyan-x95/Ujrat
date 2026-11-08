-- Migration: atomic draft-invoice edit.
--
-- InvoiceService.editInvoiceDraft used to update the invoice header and then
-- delete/re-insert invoice_items as two separate PostgREST calls. A failure
-- between them left a draft with new totals and no line items. This RPC does
-- both in one transaction and refuses to touch non-draft invoices.

CREATE OR REPLACE FUNCTION public.update_invoice_draft_transactional(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_invoice_data jsonb,
  p_invoice_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice jsonb;
  v_items jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  UPDATE public.invoices SET
    invoice_date = (p_invoice_data->>'invoice_date')::date,
    due_date = (p_invoice_data->>'due_date')::date,
    notes = p_invoice_data->>'notes',
    subtotal = COALESCE((p_invoice_data->>'subtotal')::numeric, subtotal),
    taxable_amount = COALESCE((p_invoice_data->>'taxable_amount')::numeric, taxable_amount),
    discount_amount = COALESCE((p_invoice_data->>'discount_amount')::numeric, discount_amount),
    discount_type = COALESCE(p_invoice_data->>'discount_type', discount_type),
    discount_scope = COALESCE(p_invoice_data->>'discount_scope', discount_scope),
    cess_amount = COALESCE((p_invoice_data->>'cess_amount')::numeric, cess_amount),
    cgst = COALESCE((p_invoice_data->>'cgst')::numeric, cgst),
    sgst = COALESCE((p_invoice_data->>'sgst')::numeric, sgst),
    igst = COALESCE((p_invoice_data->>'igst')::numeric, igst),
    tds_section = p_invoice_data->>'tds_section',
    tds_rate = COALESCE((p_invoice_data->>'tds_rate')::numeric, tds_rate),
    tds_amount = COALESCE((p_invoice_data->>'tds_amount')::numeric, tds_amount),
    net_receivable = COALESCE((p_invoice_data->>'net_receivable')::numeric, net_receivable),
    round_off = COALESCE((p_invoice_data->>'round_off')::numeric, round_off),
    inr_total = COALESCE((p_invoice_data->>'inr_total')::numeric, inr_total),
    supply_type = COALESCE(p_invoice_data->>'supply_type', supply_type),
    tax_scheme = COALESCE(p_invoice_data->>'tax_scheme', tax_scheme),
    total = COALESCE((p_invoice_data->>'total')::numeric, total),
    outstanding_balance = COALESCE((p_invoice_data->>'outstanding_balance')::numeric, outstanding_balance),
    is_interstate = COALESCE((p_invoice_data->>'is_interstate')::boolean, is_interstate),
    is_zero_rated = COALESCE((p_invoice_data->>'is_zero_rated')::boolean, is_zero_rated),
    is_reverse_charge = COALESCE((p_invoice_data->>'is_reverse_charge')::boolean, is_reverse_charge)
  WHERE id = p_invoice_id
    AND workspace_id = p_workspace_id
    AND deleted_at IS NULL
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only draft invoices can be edited';
  END IF;

  DELETE FROM public.invoice_items
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id;

  IF p_invoice_items IS NOT NULL AND jsonb_array_length(p_invoice_items) > 0 THEN
    INSERT INTO public.invoice_items (
      id, workspace_id, invoice_id, description, quantity, rate,
      gst_rate, hsn_code, unit, sac_code, discount_amount, taxable_amount,
      cess_rate, cess_amount, cgst_amount, sgst_amount, igst_amount, line_total, amount
    )
    SELECT
      COALESCE((item->>'id')::uuid, gen_random_uuid()),
      p_workspace_id,
      p_invoice_id,
      item->>'description',
      COALESCE((item->>'quantity')::numeric, 1),
      COALESCE((item->>'rate')::numeric, 0),
      COALESCE((item->>'gst_rate')::numeric, 0),
      item->>'hsn_code',
      COALESCE(item->>'unit', 'NOS'),
      item->>'sac_code',
      COALESCE((item->>'discount_amount')::numeric, 0),
      COALESCE((item->>'taxable_amount')::numeric, 0),
      COALESCE((item->>'cess_rate')::numeric, 0),
      COALESCE((item->>'cess_amount')::numeric, 0),
      COALESCE((item->>'cgst_amount')::numeric, 0),
      COALESCE((item->>'sgst_amount')::numeric, 0),
      COALESCE((item->>'igst_amount')::numeric, 0),
      COALESCE((item->>'line_total')::numeric, 0),
      COALESCE((item->>'amount')::numeric, 0)
    FROM jsonb_array_elements(p_invoice_items) AS item;
  END IF;

  SELECT to_jsonb(i.*) INTO v_invoice
  FROM public.invoices i WHERE i.id = p_invoice_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(ii.*)), '[]'::jsonb) INTO v_items
  FROM public.invoice_items ii WHERE ii.invoice_id = p_invoice_id;

  RETURN jsonb_build_object('invoice', v_invoice, 'invoice_items', v_items);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_invoice_draft_transactional(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_invoice_draft_transactional(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
