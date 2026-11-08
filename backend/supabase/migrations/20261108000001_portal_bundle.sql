-- Migration: single-RPC portal bundle with view tracking.
-- get_portal_bundle(token_val) returns the full portal payload in ONE call:
-- {project, client, settings, proposal, contract, invoices(with items),
--  deliverables, lastViewedAt, viewCount}.
-- Token validation is byte-identical to the get_portal_* siblings (live token,
-- project not soft-deleted, drafts excluded from invoices). Each successful
-- call records one activity_logs(action='portal_view') row fire-and-forget
-- (IP/UA unavailable from PostgREST; only the token is available server-side).
-- No new tables.

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
  WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), 'hex') OR p.portal_token = token_val)
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

  SELECT (to_jsonb(p.*) - 'portal_token_hash' - 'portal_token') INTO v_project FROM public.projects p WHERE p.id = v_project_id;

  SELECT to_jsonb(c.*) INTO v_client
  FROM public.clients c WHERE c.id = (SELECT client_id FROM public.projects WHERE id = v_project_id)
    AND c.deleted_at IS NULL;

  SELECT to_jsonb(s) INTO v_settings
  FROM (
    SELECT s.company_name, s.gstin, s.upi_id, s.logo_url, s.state,
           s.address, s.phone, s.bank_name, s.bank_account_no, s.bank_ifsc,
           s.is_gst_registered, s.tax_scheme, s.lut_number
    FROM public.workspace_settings s WHERE s.workspace_id = v_workspace_id
  ) s;

  SELECT to_jsonb(prop.*) INTO v_proposal
  FROM public.proposals prop
  WHERE prop.project_id = v_project_id AND prop.deleted_at IS NULL LIMIT 1;

  SELECT to_jsonb(contr.*) INTO v_contract
  FROM public.contracts contr
  WHERE contr.project_id = v_project_id AND contr.deleted_at IS NULL LIMIT 1;

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

REVOKE EXECUTE ON FUNCTION public.get_portal_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_bundle(text) TO anon, authenticated, service_role;
