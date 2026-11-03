-- Migration: Portal read RPCs must respect project soft-delete
-- get_portal_project() filters on p.deleted_at IS NULL, but the six sibling
-- read RPCs (client, settings, proposal, contract, invoices, deliverables)
-- only validate the token. A freelancer who soft-deletes a project therefore
-- leaves a live public link: the old token keeps returning invoices, the
-- contract, deliverables and the workspace bank details (bank_account_no,
-- bank_ifsc, upi_id) until the 90-day portal token cap expires.
--
-- Fix: add "AND p.deleted_at IS NULL" to every portal read that joins projects.
-- Token lifetime checks are unchanged.

CREATE OR REPLACE FUNCTION public.get_portal_client(token_val text)
RETURNS SETOF public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.* FROM public.clients c
  JOIN public.projects p ON p.client_id = c.id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_settings(token_val text)
RETURNS TABLE (
  company_name text,
  gstin text,
  upi_id text,
  logo_url text,
  state text,
  address text,
  phone text,
  bank_name text,
  bank_account_no text,
  bank_ifsc text,
  is_gst_registered boolean,
  tax_scheme text,
  lut_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.company_name, s.gstin, s.upi_id, s.logo_url, s.state,
         s.address, s.phone, s.bank_name, s.bank_account_no, s.bank_ifsc,
         s.is_gst_registered, s.tax_scheme, s.lut_number
  FROM public.workspace_settings s
  JOIN public.projects p ON p.workspace_id = s.workspace_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_proposal(token_val text)
RETURNS SETOF public.proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT prop.* FROM public.proposals prop
  JOIN public.projects p ON p.id = prop.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND prop.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_contract(token_val text)
RETURNS SETOF public.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT contr.* FROM public.contracts contr
  JOIN public.projects p ON p.id = contr.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND contr.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

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
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_deliverables(token_val text)
RETURNS SETOF public.deliverables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT del.* FROM public.deliverables del
  JOIN public.projects p ON p.id = del.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND del.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;
