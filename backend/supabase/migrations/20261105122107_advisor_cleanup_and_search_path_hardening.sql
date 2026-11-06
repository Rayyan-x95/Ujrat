-- Migration: Advisor cleanup - duplicate indexes, function search_path, internal RLS
--
-- Remote advisors reported:
-- 1. Four pairs of semantically duplicate indexes. In each pair, the non-partial
--    index is a superset of the soft-delete partial index. The partial index is
--    the one the app's reads use, so drop the superset copies.
--    - idx_payments_transaction_reference vs constraint
--      payments_transaction_reference_key (unique, non-partial). Dropping the
--      non-unique copy keeps the unique constraint for duplicate-UTR checks.
--    - idx_projects_client vs idx_projects_client_id (partial).
--    - idx_workspaces_profile vs idx_workspaces_profile_id (partial).
--    - idx_deliverables_ws_proj vs idx_deliverables_workspace_project (partial).
-- 2. Twenty-one trigger/helper functions with a mutable search_path. Every body
--    is already fully-qualified or built-in, so pinning `SET search_path = public`
--    preserves behavior while removing the caller-controlled path lookup.
-- 3. edge_function_rate_limits has RLS enabled with no policy. It is internal
--    state reached only through consume_edge_rate_limit (SECURITY DEFINER) and
--    direct service-role/Edge reads, never through the Data API. State the
--    deny-all policy explicitly instead of relying on zero policies; the
--    existing service-role full-access policy used by the rate-limit helpers
--    during baseline is retained.

-- ---------------------------------------------------------------------------
-- 1. Duplicate indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_payments_transaction_reference;
DROP INDEX IF EXISTS public.idx_projects_client;
DROP INDEX IF EXISTS public.idx_workspaces_profile;
DROP INDEX IF EXISTS public.idx_deliverables_ws_proj;

-- ---------------------------------------------------------------------------
-- 3. Explicit internal deny-all policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Internal rate limits" ON public.edge_function_rate_limits;
CREATE POLICY "Internal rate limits"
  ON public.edge_function_rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. Function search_path hardening
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_invoice_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  -- When invoice transitions from draft to sent/paid/pending_verification, snapshot it
  IF (OLD.status = 'draft' AND NEW.status <> 'draft') OR (OLD.revision_number <> NEW.revision_number) THEN
    SELECT jsonb_agg(to_jsonb(items.*)) INTO v_items
    FROM public.invoice_items items
    WHERE items.invoice_id = NEW.id;

    INSERT INTO public.invoice_versions (
      invoice_id,
      workspace_id,
      version,
      invoice_data
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      COALESCE(NEW.revision_number, 1),
      jsonb_build_object(
        'invoice', to_jsonb(NEW.*),
        'items', COALESCE(v_items, '[]'::jsonb),
        'archived_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_brief_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to the same workspace as the brief';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_contract_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to the same workspace as the contract';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_deliverable_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to the same workspace as the deliverable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_invoice_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to the same workspace as the invoice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_payment_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = NEW.invoice_id AND i.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Invoice does not belong to the same workspace as the payment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_project_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = NEW.client_id AND c.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Client does not belong to the same workspace as the project';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_proposal_workspace_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to the same workspace as the proposal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' THEN
    NEW.status := 'draft';
  END IF;
  IF NEW.outstanding_balance IS NULL THEN
    NEW.outstanding_balance := COALESCE(NEW.total, 0);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_items_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_invoice_status FROM public.invoices WHERE id = OLD.invoice_id;
    IF v_invoice_status IS NOT NULL AND v_invoice_status <> 'draft' THEN
      RAISE EXCEPTION 'Cannot delete line items from an issued invoice';
    END IF;
    RETURN OLD;
  ELSE
    SELECT status INTO v_invoice_status FROM public.invoices WHERE id = NEW.invoice_id;
    IF v_invoice_status IS NOT NULL AND v_invoice_status <> 'draft' THEN
      RAISE EXCEPTION 'Cannot modify line items on an issued invoice';
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_workspace_name TEXT;
  v_workspace_slug TEXT;
  v_raw_meta JSONB;
BEGIN
  v_raw_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- 1. Create or ensure profile exists
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_raw_meta->>'full_name', v_raw_meta->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(v_raw_meta->>'avatar_url', v_raw_meta->>'picture', NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = timezone('utc'::text, now());

  -- 2. Create default workspace if none exists for this profile
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE profile_id = NEW.id) THEN
    v_workspace_name := COALESCE(
      v_raw_meta->>'workspace_name',
      CASE
        WHEN COALESCE(v_raw_meta->>'full_name', v_raw_meta->>'name') IS NOT NULL
          THEN (COALESCE(v_raw_meta->>'full_name', v_raw_meta->>'name') || '''s Workspace')
        ELSE 'My Workspace'
      END
    );

    v_workspace_slug := lower(regexp_replace(v_workspace_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

    INSERT INTO public.workspaces (id, profile_id, name, slug)
    VALUES (gen_random_uuid(), NEW.id, v_workspace_name, v_workspace_slug)
    RETURNING id INTO v_workspace_id;

    -- Initialize workspace settings
    INSERT INTO public.workspace_settings (workspace_id, company_name, email)
    VALUES (v_workspace_id, v_workspace_name, NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.html_escape(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT replace(replace(replace(replace(COALESCE(p_value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

CREATE OR REPLACE FUNCTION public.log_project_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs (
      workspace_id,
      project_id,
      action,
      details
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      'status_change',
      jsonb_build_object(
        'entity', 'project',
        'from', OLD.status,
        'to', NEW.status,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_token_is_live(p_created_at timestamptz, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_expires_at, p_created_at + interval '90 days') > now();
$$;

CREATE OR REPLACE FUNCTION public.sync_contracts_introduction_and_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.introduction IS NOT NULL AND (NEW.content IS NULL OR (TG_OP = 'UPDATE' AND NEW.content = OLD.content)) THEN
    NEW.content := NEW.introduction;
  ELSIF NEW.content IS NOT NULL AND (NEW.introduction IS NULL OR (TG_OP = 'UPDATE' AND NEW.introduction = OLD.introduction)) THEN
    NEW.introduction := NEW.content;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_invoice_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_completed_sum NUMERIC;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Disallow arbitrary moves out of terminal 'paid' or 'cancelled' status
  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Cannot change status of a paid invoice';
  END IF;

  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of a cancelled invoice';
  END IF;

  -- When status changes to paid, assert full settlement
  IF NEW.status = 'paid' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
    FROM public.payments
    WHERE invoice_id = NEW.id AND status = 'completed' AND deleted_at IS NULL;

    IF v_completed_sum < NEW.total THEN
      RAISE EXCEPTION 'Cannot mark invoice as paid: completed payments (%) do not cover total (%)',
        v_completed_sum, NEW.total;
    END IF;

    NEW.outstanding_balance := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_status TEXT;
  BEGIN
    SELECT status INTO v_invoice_status FROM public.invoices WHERE id = OLD.invoice_id;
    IF OLD.status = 'completed' OR v_invoice_status = 'paid' THEN
      RAISE EXCEPTION 'Settled payments are part of the financial record and cannot be deleted';
    END IF;
    RETURN OLD;
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Money is sacred: amount and reference can never change.
    IF OLD.amount <> NEW.amount THEN
      RAISE EXCEPTION 'Payment amount is immutable after creation';
    END IF;
    IF OLD.transaction_reference IS DISTINCT FROM NEW.transaction_reference THEN
      RAISE EXCEPTION 'Payment transaction reference is immutable after creation';
    END IF;
    IF OLD.invoice_id <> NEW.invoice_id OR OLD.workspace_id <> NEW.workspace_id THEN
      RAISE EXCEPTION 'Payment cannot be reassigned to another invoice or workspace';
    END IF;

    IF OLD.status <> NEW.status THEN
      -- Forward-only canonical transitions
      IF NOT (
           (OLD.status = 'pending' AND NEW.status IN ('pending_verification', 'completed', 'failed')) OR
           (OLD.status = 'pending_verification' AND NEW.status IN ('completed', 'failed'))
         ) THEN
        RAISE EXCEPTION 'Invalid payment status transition from % to %', OLD.status, NEW.status;
      END IF;

      -- Completion requires verifier attribution unless executed by a
      -- trusted server context (SECURITY DEFINER / webhook => auth.uid() IS NULL).
      IF NEW.status = 'completed' AND NEW.verifier_id IS NULL AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Completing a payment requires verifier attribution';
      END IF;
    END IF;

    -- Terminal states are frozen.
    IF OLD.status IN ('completed', 'failed') AND OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Payments in terminal state % cannot be modified', OLD.status;
    END IF;
    IF OLD.status = 'completed' THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Completed payments cannot be deleted';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    -- Interactive callers may only open a payment in a pre-completion state.
    IF NEW.status NOT IN ('pending', 'pending_verification') AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Payments must be created as pending for interactive callers';
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_project_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;
