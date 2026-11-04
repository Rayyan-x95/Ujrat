-- Migration: Service-role twin of create_invoice_transactional.
--
-- The authenticated-lane RPC guards the insert with profile_id = auth.uid(),
-- which rejects the service-role key the operations backend uses. The backend
-- runs its own auth (workspace from JWT/app metadata), so it gets this twin:
-- same body, ownership check replaced with workspace existence, and EXECUTE
-- granted to service_role only.

CREATE OR REPLACE FUNCTION public.create_invoice_transactional_service(
  p_workspace_id uuid,
  p_invoice_data jsonb,
  p_invoice_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_inserted_invoice jsonb;
  v_inserted_items jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Unknown workspace';
  END IF;

  v_invoice_id := COALESCE((p_invoice_data->>'id')::uuid, gen_random_uuid());

  INSERT INTO public.invoices (
    id, workspace_id, project_id, invoice_number,
    invoice_date, due_date, subtotal, cgst, sgst, igst, total,
    status, notes, pdf_url,
    freelancer_gstin, client_gstin, freelancer_state, client_state,
    is_interstate, is_zero_rated, is_reverse_charge,
    outstanding_balance, prefix, year, serial_number, revision_number,
    taxable_amount, discount_amount, discount_type, discount_scope,
    cess_amount, tds_section, tds_rate, tds_amount, net_receivable,
    round_off, currency, exchange_rate, exchange_rate_date, inr_total,
    supply_type, tax_scheme, lut_number, lut_date
  ) VALUES (
    v_invoice_id,
    p_workspace_id,
    (p_invoice_data->>'project_id')::uuid,
    p_invoice_data->>'invoice_number',
    COALESCE((p_invoice_data->>'issue_date')::date, (p_invoice_data->>'invoice_date')::date, CURRENT_DATE),
    (p_invoice_data->>'due_date')::date,
    COALESCE((p_invoice_data->>'subtotal')::numeric, 0),
    COALESCE((p_invoice_data->>'cgst')::numeric, 0),
    COALESCE((p_invoice_data->>'sgst')::numeric, 0),
    COALESCE((p_invoice_data->>'igst')::numeric, 0),
    COALESCE((p_invoice_data->>'total')::numeric, 0),
    'draft', -- server-authoritative: invoices are born draft
    p_invoice_data->>'notes',
    p_invoice_data->>'pdf_url',
    p_invoice_data->>'freelancer_gstin',
    p_invoice_data->>'client_gstin',
    p_invoice_data->>'freelancer_state',
    p_invoice_data->>'client_state',
    COALESCE((p_invoice_data->>'is_interstate')::boolean, false),
    COALESCE((p_invoice_data->>'is_zero_rated')::boolean, false),
    COALESCE((p_invoice_data->>'is_reverse_charge')::boolean, false),
    COALESCE((p_invoice_data->>'outstanding_balance')::numeric, (p_invoice_data->>'total')::numeric, 0),
    p_invoice_data->>'prefix',
    (p_invoice_data->>'year')::integer,
    (p_invoice_data->>'serial_number')::integer,
    COALESCE((p_invoice_data->>'revision_number')::integer, 0),
    COALESCE((p_invoice_data->>'taxable_amount')::numeric, 0),
    COALESCE((p_invoice_data->>'discount_amount')::numeric, 0),
    COALESCE(p_invoice_data->>'discount_type', 'fixed'),
    COALESCE(p_invoice_data->>'discount_scope', 'before_tax'),
    COALESCE((p_invoice_data->>'cess_amount')::numeric, 0),
    p_invoice_data->>'tds_section',
    COALESCE((p_invoice_data->>'tds_rate')::numeric, 0),
    COALESCE((p_invoice_data->>'tds_amount')::numeric, 0),
    COALESCE((p_invoice_data->>'net_receivable')::numeric, 0),
    COALESCE((p_invoice_data->>'round_off')::numeric, 0),
    COALESCE(p_invoice_data->>'currency', 'INR'),
    COALESCE((p_invoice_data->>'exchange_rate')::numeric, 1.0),
    (p_invoice_data->>'exchange_rate_date')::date,
    COALESCE((p_invoice_data->>'inr_total')::numeric, 0),
    COALESCE(p_invoice_data->>'supply_type', 'taxable'),
    COALESCE(p_invoice_data->>'tax_scheme', 'regular'),
    p_invoice_data->>'lut_number',
    (p_invoice_data->>'lut_date')::date
  ) RETURNING to_jsonb(public.invoices.*) INTO v_inserted_invoice;

  IF p_invoice_items IS NOT NULL AND jsonb_array_length(p_invoice_items) > 0 THEN
    INSERT INTO public.invoice_items (
      id, workspace_id, invoice_id, description, quantity, rate,
      gst_rate, hsn_code, unit, sac_code, discount_amount, taxable_amount,
      cess_rate, cess_amount, cgst_amount, sgst_amount, igst_amount, line_total, amount
    )
    SELECT
      COALESCE((item->>'id')::uuid, gen_random_uuid()),
      p_workspace_id,
      v_invoice_id,
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

  SELECT jsonb_agg(to_jsonb(public.invoice_items.*)) INTO v_inserted_items
  FROM public.invoice_items
  WHERE invoice_id = v_invoice_id;

  RETURN jsonb_build_object(
    'invoice', v_inserted_invoice,
    'invoice_items', COALESCE(v_inserted_items, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_transactional_service(uuid, jsonb, jsonb)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_transactional_service(uuid, jsonb, jsonb)
  TO service_role;
