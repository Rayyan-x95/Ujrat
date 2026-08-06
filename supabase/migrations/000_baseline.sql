-- Migration 000: Ujrat Baseline Schema
-- This is the consolidated baseline migration combining all previous migrations
-- Run this for fresh installs instead of migrations 001-025 + date-based migrations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- PROFILES TABLE (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- WORKSPACES TABLE (Multi-Workspace Capability)
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- WORKSPACE SETTINGS TABLE
CREATE TABLE public.workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE NOT NULL,
    company_name TEXT,
    gstin TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    upi_id TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    state TEXT,
    is_gst_registered BOOLEAN DEFAULT false
);

-- CLIENTS TABLE
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    state TEXT,
    gstin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (workspace_id, email)
);

-- PROJECTS TABLE
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    budget NUMERIC(12, 2) DEFAULT 0.00,
    timeline_start DATE,
    timeline_end DATE,
    deliverables JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'proposal', 'approved', 'contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent', 'paid', 'archived')),
    portal_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    portal_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE public.projects IS 'Portal access MUST go through get_portal_project() function. Direct table access is blocked for security.';

-- PROJECT BRIEFS TABLE
CREATE TABLE public.project_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
    description TEXT,
    goals TEXT,
    deadline DATE,
    budget NUMERIC(12, 2),
    "references" TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- PROPOSALS TABLE
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
    introduction TEXT,
    scope TEXT,
    deliverables JSONB DEFAULT '[]'::jsonb,
    timeline TEXT,
    pricing NUMERIC(12, 2) DEFAULT 0.00,
    revision_policy TEXT,
    terms TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'revision_requested')),
    client_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE public.proposals IS 'Portal access MUST go through get_portal_proposal() function. Direct table access is blocked for security.';

-- PROPOSAL SECTIONS TABLE
CREATE TABLE public.proposal_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- CONTRACTS TABLE
CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
    introduction TEXT,
    payment_schedule TEXT,
    terms TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE public.contracts IS 'Portal access MUST go through get_portal_contract() function. Direct table access is blocked for security.';

-- CONTRACT SIGNATURES TABLE
CREATE TABLE public.contract_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE UNIQUE NOT NULL,
    signature_name TEXT NOT NULL,
    signature_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INVOICES TABLE
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    notes TEXT,
    gstin TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'pending_verification', 'paid', 'overdue', 'cancelled')),
    pdf_url TEXT,
    freelancer_gstin TEXT,
    client_gstin TEXT,
    freelancer_state TEXT,
    client_state TEXT,
    is_interstate BOOLEAN DEFAULT false,
    is_zero_rated BOOLEAN DEFAULT false,
    is_reverse_charge BOOLEAN DEFAULT false,
    outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    prefix TEXT,
    year INTEGER,
    serial_number INTEGER,
    revision_number INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (workspace_id, invoice_number)
);

COMMENT ON TABLE public.invoices IS 'Portal access MUST go through get_portal_invoices() function. Direct table access is blocked for security.';

-- INVOICE ITEMS TABLE
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    hsn_code TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- INVOICE VERSIONS TABLE (Audit trail for invoice revisions)
CREATE TABLE public.invoice_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    version INT NOT NULL,
    invoice_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENTS TABLE
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CONSTRAINT payments_amount_positive CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    transaction_reference TEXT UNIQUE,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'completed', 'failed')),
    verifier_id UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- DELIVERABLES TABLE
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE public.deliverables IS 'Portal access MUST go through get_portal_deliverables() function. Direct table access is blocked for security.';

-- FILE UPLOADS TABLE
CREATE TABLE public.file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ACTIVITY LOGS TABLE
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- EMAIL LOGS TABLE
CREATE TABLE public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    resend_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- EDGE FUNCTION RATE LIMITS
-- Counters are only consumed by a service-role RPC invoked from Edge Functions.
CREATE TABLE public.edge_function_rate_limits (
    scope TEXT NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 256),
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (scope, window_started_at)
);

-- FINANCIAL AUDIT TRAIL TABLE
CREATE TABLE public.financial_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    amount NUMERIC(12, 2),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PORTAL VERIFICATIONS TABLE (OTP Infrastructure)
CREATE TABLE public.portal_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,
    last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (Workspace-isolated ownership)
-- ============================================================

-- Profiles: Users can only access their own profile
CREATE POLICY "Select profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Workspaces: Users can only access their own workspaces
CREATE POLICY "All workspaces" ON public.workspaces FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Workspace Settings: Access via workspace ownership
CREATE POLICY "All workspace settings" ON public.workspace_settings FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = workspace_settings.workspace_id 
        AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = workspace_settings.workspace_id 
        AND profile_id = auth.uid()
    )
);

-- Clients: Workspace-scoped access
CREATE POLICY "Owner access to clients" ON public.clients FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = clients.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = clients.workspace_id AND profile_id = auth.uid()
    )
);

-- Projects: Workspace-scoped access
CREATE POLICY "Owner access to projects" ON public.projects FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = projects.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = projects.workspace_id AND profile_id = auth.uid()
    )
);

-- Project Briefs: Workspace-scoped (portal access via SECURITY DEFINER RPCs)
CREATE POLICY "Owner access to briefs" ON public.project_briefs FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = project_briefs.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = project_briefs.workspace_id AND profile_id = auth.uid()
    )
);

-- Proposals: Workspace-scoped (portal access via SECURITY DEFINER RPCs)
CREATE POLICY "Owner access to proposals" ON public.proposals FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = proposals.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = proposals.workspace_id AND profile_id = auth.uid()
    )
);

-- Proposal Sections
CREATE POLICY "Owner access to proposal sections" ON public.proposal_sections FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = proposal_sections.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = proposal_sections.workspace_id AND profile_id = auth.uid()
    )
);

-- Contracts
CREATE POLICY "Owner access to contracts" ON public.contracts FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = contracts.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = contracts.workspace_id AND profile_id = auth.uid()
    )
);

-- Contract Signatures
CREATE POLICY "Owner access to contract signatures" ON public.contract_signatures FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = contract_signatures.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = contract_signatures.workspace_id AND profile_id = auth.uid()
    )
);

-- Invoices
CREATE POLICY "Owner access to invoices" ON public.invoices FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = invoices.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = invoices.workspace_id AND profile_id = auth.uid()
    )
);

-- Invoice Items
CREATE POLICY "Owner access to invoice items" ON public.invoice_items FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = invoice_items.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = invoice_items.workspace_id AND profile_id = auth.uid()
    )
);

-- Invoice Versions
CREATE POLICY "Owner access to invoice versions" ON public.invoice_versions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces w 
        WHERE w.id = invoice_versions.workspace_id AND w.profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces w 
        WHERE w.id = invoice_versions.workspace_id AND w.profile_id = auth.uid()
    )
);

-- Payments
CREATE POLICY "Owner access to payments" ON public.payments FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = payments.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = payments.workspace_id AND profile_id = auth.uid()
    )
);

-- Deliverables
CREATE POLICY "Owner access to deliverables" ON public.deliverables FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = deliverables.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = deliverables.workspace_id AND profile_id = auth.uid()
    )
);

-- File Uploads
CREATE POLICY "Owner access to file uploads" ON public.file_uploads FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = file_uploads.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = file_uploads.workspace_id AND profile_id = auth.uid()
    )
);

-- Activity Logs
CREATE POLICY "Owner access to activity logs" ON public.activity_logs FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = activity_logs.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = activity_logs.workspace_id AND profile_id = auth.uid()
    )
);

-- Email Logs
CREATE POLICY "Owner access to email logs" ON public.email_logs FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = email_logs.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = email_logs.workspace_id AND profile_id = auth.uid()
    )
);

-- Financial Audit Trail
CREATE POLICY "Owner access to financial audit trail" ON public.financial_audit_trail FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = financial_audit_trail.workspace_id AND profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = financial_audit_trail.workspace_id AND profile_id = auth.uid()
    )
);

-- Portal Verifications (no direct access - only via SECURITY DEFINER functions)
CREATE POLICY "RPC only" ON public.portal_verifications FOR ALL USING (false);

-- ============================================================
-- TRIGGER FUNCTIONS AND TRIGGERS
-- ============================================================

-- Auto-create Profile and Workspace on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    -- Insert profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        new.raw_user_meta_data->>'avatar_url'
    );
    
    -- Insert default workspace
    INSERT INTO public.workspaces (profile_id, name)
    VALUES (new.id, 'My Default Workspace')
    RETURNING id INTO new_workspace_id;
    
    -- Insert default workspace settings
    INSERT INTO public.workspace_settings (workspace_id, company_name)
    VALUES (new_workspace_id, 'Freelancer Payouts Workspace');
    
    RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Project State Machine Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_project_status_transition()
RETURNS trigger AS $$
BEGIN
  -- If status is not changing, allow it
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allow new project initialization
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Enforce valid transition paths. Allow archiving to 'archived' from any state.
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
  ELSIF OLD.status = 'invoice_sent' AND NEW.status NOT IN ('paid') THEN
    RAISE EXCEPTION 'Invalid transition from invoice_sent to %', NEW.status;
  ELSIF OLD.status = 'archived' AND NEW.status NOT IN ('lead', 'in_progress', 'proposal') THEN
    RAISE EXCEPTION 'Invalid transition from archived to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_status_transition_trigger ON public.projects;
CREATE TRIGGER projects_status_transition_trigger
  BEFORE UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_status_transition();

-- Project Transition History Logging Trigger
CREATE OR REPLACE FUNCTION public.log_project_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs (id, workspace_id, project_id, action, details)
    VALUES (
      gen_random_uuid(),
      NEW.workspace_id,
      NEW.id,
      'Project Status Updated',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_status_log_trigger ON public.projects;
CREATE TRIGGER projects_status_log_trigger
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_status_transition();

-- Invoice Content Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    -- Prevent altering anything other than status, pdf_url, updated_at, deleted_at
    IF OLD.project_id <> NEW.project_id OR
       OLD.invoice_number <> NEW.invoice_number OR
       OLD.invoice_date <> NEW.invoice_date OR
       OLD.due_date <> NEW.due_date OR
       OLD.notes IS DISTINCT FROM NEW.notes OR
       OLD.gstin IS DISTINCT FROM NEW.gstin OR
       OLD.subtotal <> NEW.subtotal OR
       OLD.cgst <> NEW.cgst OR
       OLD.sgst <> NEW.sgst OR
       OLD.igst <> NEW.igst OR
       OLD.total <> NEW.total
    THEN
      RAISE EXCEPTION 'Sent/Paid invoices are immutable and cannot be updated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_immutability_trigger ON public.invoices;
CREATE TRIGGER invoices_immutability_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_immutability();

-- Invoice Line Items Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_invoice_items_immutability()
RETURNS trigger AS $$
DECLARE
  v_status TEXT;
  v_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT status INTO v_status FROM public.invoices WHERE id = v_invoice_id;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Invoice line items are locked since invoice is not in draft state';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_items_immutability_trigger ON public.invoice_items;
CREATE TRIGGER invoice_items_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_items_immutability();

-- Invoice Versions Table Trigger (Archiving Revisions)
CREATE OR REPLACE FUNCTION public.archive_invoice_revision()
RETURNS trigger AS $$
DECLARE
  v_version INT;
  v_items JSONB;
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'sent' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version 
    FROM public.invoice_versions 
    WHERE invoice_id = NEW.id;

    SELECT json_agg(t) INTO v_items 
    FROM (SELECT * FROM public.invoice_items WHERE invoice_id = NEW.id) t;

    INSERT INTO public.invoice_versions (invoice_id, workspace_id, version, invoice_data)
    VALUES (
      NEW.id,
      NEW.workspace_id,
      v_version,
      jsonb_build_object(
        'invoice_number', NEW.invoice_number,
        'invoice_date', NEW.invoice_date,
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'gstin', NEW.gstin,
        'subtotal', NEW.subtotal,
        'cgst', NEW.cgst,
        'sgst', NEW.sgst,
        'igst', NEW.igst,
        'total', NEW.total,
        'items', v_items
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_revision_archive_trigger ON public.invoices;
CREATE TRIGGER invoice_revision_archive_trigger
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.archive_invoice_revision();

-- Enforce Client and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_project_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_client_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_client_workspace_id FROM public.clients WHERE id = NEW.client_id;
  IF v_client_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Client does not belong to the same workspace as the project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_project_workspace_alignment ON public.projects;
CREATE TRIGGER enforce_project_workspace_alignment
  BEFORE INSERT OR UPDATE OF client_id, workspace_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.check_project_workspace_alignment();

-- Enforce Invoice and Payment Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_payment_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_invoice_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_invoice_workspace_id FROM public.invoices WHERE id = NEW.invoice_id;
  IF v_invoice_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Payment workspace must match invoice workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_payment_workspace_alignment ON public.payments;
CREATE TRIGGER enforce_payment_workspace_alignment
  BEFORE INSERT OR UPDATE OF invoice_id, workspace_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_workspace_alignment();

-- Enforce Invoice and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_invoice_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_project_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_project_workspace_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Invoice workspace must match project workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_invoice_workspace_alignment ON public.invoices;
CREATE TRIGGER enforce_invoice_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_workspace_alignment();

-- Enforce Contract and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_contract_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_project_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_project_workspace_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Contract workspace must match project workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_contract_workspace_alignment ON public.contracts;
CREATE TRIGGER enforce_contract_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.check_contract_workspace_alignment();

-- Enforce Proposal and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_proposal_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_project_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_project_workspace_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Proposal workspace must match project workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_proposal_workspace_alignment ON public.proposals;
CREATE TRIGGER enforce_proposal_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.check_proposal_workspace_alignment();

-- Enforce Deliverable and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_deliverable_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_project_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_project_workspace_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Deliverable workspace must match project workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_deliverable_workspace_alignment ON public.deliverables;
CREATE TRIGGER enforce_deliverable_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.check_deliverable_workspace_alignment();

-- Enforce Project Brief and Project Workspace Alignment
CREATE OR REPLACE FUNCTION public.check_brief_workspace_alignment()
RETURNS trigger AS $$
DECLARE
  v_project_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_project_workspace_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Project brief workspace must match project workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_brief_workspace_alignment ON public.project_briefs;
CREATE TRIGGER enforce_brief_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.project_briefs
  FOR EACH ROW EXECUTE FUNCTION public.check_brief_workspace_alignment();

-- Invoice Status Transition & Payment Settlement Invariant Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_invoice_status_transition()
RETURNS trigger AS $$
DECLARE
  v_completed_sum NUMERIC;
BEGIN
  -- If status is not changing, allow it
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Disallow arbitrary status changes on settled invoices
  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Settled invoices cannot be transitioned back to %', NEW.status;
  END IF;

  IF OLD.status = 'cancelled' AND NEW.status = 'paid' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be transitioned directly to paid';
  END IF;

  -- When transitioning to paid, enforce at DB boundary that completed payments >= total
  IF NEW.status = 'paid' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_completed_sum
    FROM public.payments
    WHERE invoice_id = NEW.id 
      AND status = 'completed' 
      AND deleted_at IS NULL;

    IF v_completed_sum < NEW.total THEN
      RAISE EXCEPTION 'Cannot mark invoice paid: completed payments (%) do not cover invoice total (%)', v_completed_sum, NEW.total;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_status_transition_trigger ON public.invoices;
CREATE TRIGGER invoices_status_transition_trigger
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status_transition();

-- ============================================================
-- SECURITY DEFINER PORTAL RPC FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_portal_project(token_val text)
RETURNS SETOF public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.projects 
  WHERE portal_token = token_val 
    AND deleted_at IS NULL
    AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
END;
$$;

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
    AND c.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_settings(token_val text)
RETURNS SETOF public.workspace_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT s.* FROM public.workspace_settings s
  JOIN public.projects p ON p.workspace_id = s.workspace_id
  WHERE p.portal_token = token_val
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
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
    AND prop.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
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
    AND contr.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
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
  SELECT i.* FROM public.invoices i
  JOIN public.projects p ON p.id = i.project_id
  WHERE p.portal_token = token_val 
    AND i.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
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
  SELECT d.* FROM public.deliverables d
  JOIN public.projects p ON p.id = d.project_id
  WHERE p.portal_token = token_val 
    AND d.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
END;
$$;

-- OTP Verification Infrastructure
CREATE OR REPLACE FUNCTION public.generate_portal_verification(token_val text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_client_email TEXT;
  v_workspace_id UUID;
  v_code TEXT;
  v_last_sent TIMESTAMP WITH TIME ZONE;
  v_generation_count INT;
BEGIN
  -- Automatically clean up expired OTPs first
  DELETE FROM public.portal_verifications WHERE expires_at < now();

  SELECT p.id, cl.email, p.workspace_id INTO v_project_id, v_client_email, v_workspace_id
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  -- Enforce 60 seconds resend cooldown
  SELECT MAX(last_sent_at) INTO v_last_sent
  FROM public.portal_verifications
  WHERE project_id = v_project_id AND email = v_client_email;

  IF v_last_sent IS NOT NULL AND v_last_sent + interval '60 seconds' > now() THEN
    RAISE EXCEPTION 'Please wait 60 seconds before requesting a new code';
  END IF;

  -- Generation rate limiting (max 10 codes per email per 24 hours)
  SELECT COUNT(*) INTO v_generation_count
  FROM public.portal_verifications
  WHERE email = v_client_email AND created_at + interval '24 hours' > now();

  IF v_generation_count >= 10 THEN
    RAISE EXCEPTION 'Too many verification attempts. Please try again tomorrow.';
  END IF;

  -- Generate 6-digit random code
  v_code := floor(random() * 900000 + 100000)::text;

  INSERT INTO public.portal_verifications (project_id, email, code_hash, attempts, max_attempts, expires_at, last_sent_at)
  VALUES (
    v_project_id, 
    v_client_email, 
    crypt(v_code, gen_salt('bf', 8)), 
    0, 
    5, 
    now() + interval '15 minutes', 
    now()
  );

  -- Insert pending email log for notification / edge function dispatch (sanitized, zero-knowledge)
  INSERT INTO public.email_logs (
    id,
    workspace_id,
    project_id,
    recipient,
    subject,
    body,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    v_project_id,
    v_client_email,
    'Verification Code for Ujrat Contract Signature',
    '<p>A secure verification code has been dispatched to your email address.</p>',
    'pending',
    now()
  );

  RETURN v_client_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_portal_code(token_val text, input_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_client_email TEXT;
  v_verify_id UUID;
  v_attempts INT;
  v_max_attempts INT;
  v_code_hash TEXT;
BEGIN
  -- Validate portal token
  SELECT p.id, cl.email INTO v_project_id, v_client_email
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());

  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  -- Use row-level lock FOR UPDATE on the active verification code record
  SELECT id, attempts, max_attempts, code_hash INTO v_verify_id, v_attempts, v_max_attempts, v_code_hash
  FROM public.portal_verifications
  WHERE id = (
    SELECT id
    FROM public.portal_verifications
    WHERE project_id = v_project_id
      AND email = v_client_email
      AND verified = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  )
  FOR UPDATE;

  IF v_verify_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_attempts >= v_max_attempts THEN
    RETURN false;
  END IF;

  -- Increment attempt counter
  UPDATE public.portal_verifications
  SET attempts = attempts + 1
  WHERE id = v_verify_id;

  -- Timing-safe bcrypt comparison using pgcrypto
  IF v_code_hash = crypt(input_code, v_code_hash) THEN
    UPDATE public.portal_verifications
    SET verified = true
    WHERE id = v_verify_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_portal_signature(token_val text, sig_name text, ip_addr text, email_verified boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_contract_id UUID;
  v_client_email TEXT;
  v_is_verified BOOLEAN;
BEGIN
  SELECT p.id, p.workspace_id, cl.email INTO v_project_id, v_workspace_id, v_client_email
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val 
    AND p.deleted_at IS NULL
    AND (p.portal_token_expires_at IS NULL OR p.portal_token_expires_at > now());
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.portal_verifications
    WHERE project_id = v_project_id
      AND email = v_client_email
      AND verified = true
      AND expires_at + interval '15 minutes' > now()
  ) INTO v_is_verified;

  IF NOT v_is_verified THEN
    RAISE EXCEPTION 'Client identity not verified. Request and verify OTP code first.';
  END IF;

  SELECT c.id INTO v_contract_id
  FROM public.contracts c
  WHERE c.project_id = v_project_id 
    AND c.deleted_at IS NULL;
  
  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found for this project';
  END IF;

  INSERT INTO public.contract_signatures (id, workspace_id, contract_id, signature_name, ip_address, signature_date)
  VALUES (
    gen_random_uuid(), 
    v_workspace_id, 
    v_contract_id, 
    sig_name, 
    COALESCE(ip_addr, 'unknown'),
    now()
  );

  UPDATE public.contracts 
  SET status = 'signed', updated_at = now() 
  WHERE id = v_contract_id;

  UPDATE public.projects 
  SET status = 'contract_signed', updated_at = now() 
  WHERE id = v_project_id;
END;
$$;

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
BEGIN
  SELECT id, workspace_id INTO v_project_id, v_workspace_id 
  FROM public.projects 
  WHERE portal_token = token_val 
    AND deleted_at IS NULL
    AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  -- Lock invoice row FOR UPDATE to prevent race conditions during submission
  SELECT total, COALESCE(outstanding_balance, total), status, EXISTS(
    SELECT 1 FROM public.invoices 
    WHERE id = invoice_id_val 
      AND project_id = v_project_id 
      AND deleted_at IS NULL
  ) INTO v_invoice_total, v_outstanding_balance, v_invoice_status, v_invoice_exists
  FROM public.invoices
  WHERE id = invoice_id_val
  FOR UPDATE;
 
  IF NOT v_invoice_exists THEN
    RAISE EXCEPTION 'Invoice does not belong to the verified project';
  END IF;

  IF amt <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
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

  INSERT INTO public.payments (id, workspace_id, invoice_id, amount, payment_method, transaction_reference, status, payment_date)
  VALUES (gen_random_uuid(), v_workspace_id, invoice_id_val, amt, pay_method, tx_ref, 'pending', now());

  INSERT INTO public.payment_attempts (id, workspace_id, invoice_id, utr_number, amount, status, attempted_at)
  VALUES (gen_random_uuid(), v_workspace_id, invoice_id_val, tx_ref, amt, 'pending_verification', now())
  ON CONFLICT (utr_number) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.submit_portal_brief_feedback(token_val text, feedback_val text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_proposal_id UUID;
BEGIN
  SELECT id INTO v_project_id 
  FROM public.projects 
  WHERE portal_token = token_val 
    AND deleted_at IS NULL
    AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  SELECT id INTO v_proposal_id 
  FROM public.proposals 
  WHERE project_id = v_project_id 
    AND deleted_at IS NULL;
  
  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  UPDATE public.proposals 
  SET status = 'revision_requested', 
      client_feedback = feedback_val, 
      updated_at = now()
  WHERE id = v_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_portal_proposal(token_val text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_proposal_id UUID;
BEGIN
  SELECT id INTO v_project_id 
  FROM public.projects 
  WHERE portal_token = token_val 
    AND deleted_at IS NULL
    AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  SELECT id INTO v_proposal_id 
  FROM public.proposals 
  WHERE project_id = v_project_id 
    AND deleted_at IS NULL;
  
  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  UPDATE public.proposals 
  SET status = 'approved', updated_at = now() 
  WHERE id = v_proposal_id;

  UPDATE public.projects 
  SET status = 'approved', updated_at = now() 
  WHERE id = v_project_id;
END;
$$;

-- Revoke default PUBLIC execution and grant explicitly to anon, authenticated, service_role
REVOKE EXECUTE ON FUNCTION public.get_portal_project(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_client(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_settings(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_proposal(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_contract(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_deliverables(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_portal_verification(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_portal_code(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_portal_proposal(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_portal_project(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_client(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_settings(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_proposal(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_contract(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_deliverables(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_portal_verification(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_portal_code(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_portal_proposal(text) TO anon, authenticated, service_role;

-- Atomically consume a request from a fixed time window. The function is
-- intentionally service-role-only so public callers cannot manipulate counters.
CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
BEGIN
  IF char_length(p_scope) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'Rate limit scope must be between 1 and 256 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_max_requests NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Rate limit maximum must be between 1 and 1000'
      USING ERRCODE = '22023';
  END IF;

  IF p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Rate limit window must be between 1 and 86400 seconds'
      USING ERRCODE = '22023';
  END IF;

  v_window_started_at := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  DELETE FROM public.edge_function_rate_limits
  WHERE window_started_at < v_now - interval '2 days';

  INSERT INTO public.edge_function_rate_limits (
    scope,
    window_started_at,
    request_count
  ) VALUES (
    p_scope,
    v_window_started_at,
    1
  )
  ON CONFLICT (scope, window_started_at)
  DO UPDATE SET request_count = public.edge_function_rate_limits.request_count + 1
  RETURNING request_count INTO v_request_count;

  allowed := v_request_count <= p_max_requests;
  retry_after_seconds := GREATEST(
    1,
    CEIL(extract(epoch FROM v_window_started_at + make_interval(secs => p_window_seconds) - v_now))::integer
  );
  RETURN NEXT;
END;
$$;

REVOKE ALL ON TABLE public.edge_function_rate_limits FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) TO service_role;

-- Transactional RPC functions
CREATE OR REPLACE FUNCTION public.create_invoice_transactional(
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
  -- Verify caller owns the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  -- Generate uuid if not provided
  v_invoice_id := COALESCE((p_invoice_data->>'id')::uuid, gen_random_uuid());

  -- Insert invoice header
  INSERT INTO public.invoices (
    id,
    workspace_id,
    project_id,
    invoice_number,
    invoice_date,
    due_date,
    notes,
    gstin,
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    status,
    pdf_url,
    freelancer_gstin,
    client_gstin,
    freelancer_state,
    client_state,
    is_interstate,
    is_zero_rated,
    is_reverse_charge,
    outstanding_balance,
    prefix,
    year,
    serial_number,
    revision_number
  ) VALUES (
    v_invoice_id,
    p_workspace_id,
    (p_invoice_data->>'project_id')::uuid,
    p_invoice_data->>'invoice_number',
    (p_invoice_data->>'invoice_date')::date,
    (p_invoice_data->>'due_date')::date,
    p_invoice_data->>'notes',
    p_invoice_data->>'gstin',
    (p_invoice_data->>'subtotal')::numeric,
    (p_invoice_data->>'cgst')::numeric,
    (p_invoice_data->>'sgst')::numeric,
    (p_invoice_data->>'igst')::numeric,
    (p_invoice_data->>'total')::numeric,
    COALESCE(p_invoice_data->>'status', 'draft'),
    p_invoice_data->>'pdf_url',
    p_invoice_data->>'freelancer_gstin',
    p_invoice_data->>'client_gstin',
    p_invoice_data->>'freelancer_state',
    p_invoice_data->>'client_state',
    COALESCE((p_invoice_data->>'is_interstate')::boolean, false),
    COALESCE((p_invoice_data->>'is_zero_rated')::boolean, false),
    COALESCE((p_invoice_data->>'is_reverse_charge')::boolean, false),
    COALESCE((p_invoice_data->>'outstanding_balance')::numeric, (p_invoice_data->>'total')::numeric),
    p_invoice_data->>'prefix',
    p_invoice_data->>'year',
    (p_invoice_data->>'serial_number')::integer,
    COALESCE((p_invoice_data->>'revision_number')::integer, 0)
  )
  RETURNING to_jsonb(public.invoices.*) INTO v_inserted_invoice;

  -- Insert invoice items
  INSERT INTO public.invoice_items (
    workspace_id,
    invoice_id,
    description,
    quantity,
    rate,
    gst_rate,
    hsn_code,
    amount
  )
  SELECT
    p_workspace_id,
    v_invoice_id,
    (item->>'description')::text,
    (item->>'quantity')::numeric,
    (item->>'rate')::numeric,
    (item->>'gst_rate')::numeric,
    (item->>'hsn_code')::text,
    (item->>'amount')::numeric
  FROM jsonb_array_elements(p_invoice_items) AS item;

  -- Fetch and format items to return
  SELECT jsonb_agg(to_jsonb(ii.*)) INTO v_inserted_items
  FROM public.invoice_items ii
  WHERE ii.invoice_id = v_invoice_id AND ii.workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'invoice', v_inserted_invoice,
    'invoice_items', COALESCE(v_inserted_items, '[]'::jsonb)
  );
END;
$$;

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
BEGIN
  -- Verify caller owns the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  -- Verify invoice belongs to workspace
  SELECT total INTO v_invoice_total
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND deleted_at IS NULL;

  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in workspace';
  END IF;

  -- Get total completed payments for this invoice
  SELECT COALESCE(SUM(amount), 0), jsonb_agg(to_jsonb(p.*)) INTO v_completed_sum, v_payment
  FROM public.payments p
  WHERE p.invoice_id = p_invoice_id AND p.workspace_id = p_workspace_id AND p.status = 'completed';

  -- Enforce that completed payments satisfy the invoice balance
  IF v_completed_sum < v_invoice_total THEN
    RAISE EXCEPTION 'Cannot mark invoice paid: completed payments (%) are less than invoice total (%)', v_completed_sum, v_invoice_total;
  END IF;

  -- Update invoice status
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

-- Grant execute on transactional functions
REVOKE EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- STORAGE POLICIES (run via Supabase Dashboard SQL editor)
-- ============================================================
-- Note: Storage buckets must be created via Supabase Dashboard or API
-- Buckets: avatars, contracts, proposals, invoices, deliverables, branding
-- The following policies should be applied via Supabase Dashboard SQL editor

-- Drop the broken policies from migration 013 (if they exist)
DROP POLICY IF EXISTS "Allow portal client read access to deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow portal client read access to invoices" ON storage.objects;

-- Anonymous portal downloads are authorized by create-signed-url. Direct
-- storage SELECT policies must never infer portal access from object paths.

-- Also allow authenticated users (freelancers) to read their own portal files
CREATE POLICY "Allow authenticated portal read access to deliverables" ON storage.objects
FOR SELECT USING (
    bucket_id = 'deliverables' AND
    auth.role() = 'authenticated' AND
    (
        SELECT 1 FROM public.projects p
        JOIN public.workspaces w ON w.id = p.workspace_id
        WHERE p.id::text = (storage.foldername(name))[2]
          AND p.workspace_id::text = (storage.foldername(name))[1]
          AND w.profile_id = auth.uid()
          AND p.deleted_at IS NULL
        LIMIT 1
    ) IS NOT NULL
);

CREATE POLICY "Allow authenticated portal read access to invoices" ON storage.objects
FOR SELECT USING (
    bucket_id = 'invoices' AND
    auth.role() = 'authenticated' AND
    (
        SELECT 1 FROM public.projects p
        JOIN public.workspaces w ON w.id = p.workspace_id
        WHERE p.id::text = (storage.foldername(name))[2]
          AND p.workspace_id::text = (storage.foldername(name))[1]
          AND w.profile_id = auth.uid()
          AND p.deleted_at IS NULL
        LIMIT 1
    ) IS NOT NULL
);

-- Only authenticated workspace owners can read objects directly. Portal users
-- receive a short-lived signed URL from the Edge Function after authorization.
REVOKE SELECT ON storage.objects FROM anon;
GRANT SELECT ON storage.objects TO authenticated;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_profile ON public.workspaces(profile_id);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace ON public.workspace_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_portal_token ON public.projects(portal_token);
CREATE INDEX IF NOT EXISTS idx_briefs_workspace ON public.project_briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_briefs_project ON public.project_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_workspace ON public.proposals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_proposals_project ON public.proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal ON public.proposal_sections(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_workspace ON public.contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_workspace ON public.payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_workspace_invoice ON public.payments(workspace_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_workspace_invoice_status ON public.payments(workspace_id, invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_project_status ON public.invoices(workspace_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_created ON public.activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverables_workspace_project ON public.deliverables(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_edge_function_rate_limits_window ON public.edge_function_rate_limits(window_started_at);

-- ============================================================
-- SECURITY DEFINER FUNCTION FIXES
-- ============================================================

-- Fix SECURITY DEFINER warnings on any rls_auto_enable function
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
    ) THEN
        ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
END $$;

-- ============================================================
-- STORAGE BUCKETS & POLICIES (Applied via Supabase Dashboard / API)
-- ============================================================
-- Note: Storage buckets must be created via Supabase Dashboard or API
-- Buckets: avatars, contracts, proposals, invoices, deliverables, branding
-- Policies are handled by migration 011_storage.sql and 024_fix_portal_storage_access.sql


-- ============================================================
-- ADDITIONAL PRODUCTION CONSOLIDATED MIGRATIONS
-- ============================================================

-- 1. Add email_logs.project_id column
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Add FK indexes and performance improvements
CREATE INDEX IF NOT EXISTS idx_email_logs_project_id ON public.email_logs(project_id);
DROP POLICY IF EXISTS "Owner write to financial_audit_trail" ON public.financial_audit_trail;
DROP POLICY IF EXISTS "Read access to financial_audit_trail" ON public.financial_audit_trail;

CREATE INDEX IF NOT EXISTS idx_proposal_sections_workspace_id ON public.proposal_sections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_workspace_id ON public.contract_signatures(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_workspace_id ON public.invoice_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_workspace_id ON public.invoice_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_workspace_id ON public.email_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_profile_id ON public.email_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_portal_verifications_project_id ON public.portal_verifications(project_id);

-- 3. Security definer function hardening
-- 1. get_portal_project
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_project') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_project(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_project(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 2. get_portal_client
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_client') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_client(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_client(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 3. get_portal_settings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_settings') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_settings(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_settings(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 4. get_portal_proposal
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_proposal') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_proposal(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_proposal(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 5. get_portal_contract
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_contract') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_contract(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_contract(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 6. get_portal_invoices
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_invoices') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 7. get_portal_deliverables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_deliverables') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_deliverables(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_deliverables(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 8. generate_portal_verification
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_portal_verification') THEN
        REVOKE EXECUTE ON FUNCTION public.generate_portal_verification(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.generate_portal_verification(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 9. verify_portal_code
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'verify_portal_code') THEN
        REVOKE EXECUTE ON FUNCTION public.verify_portal_code(text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.verify_portal_code(text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 10. submit_portal_signature
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_signature') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 11. submit_portal_payment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_payment') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 12. submit_portal_brief_feedback
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_brief_feedback') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 13. approve_portal_proposal
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'approve_portal_proposal') THEN
        REVOKE EXECUTE ON FUNCTION public.approve_portal_proposal(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.approve_portal_proposal(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 14. create_invoice_transactional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_invoice_transactional') THEN
        REVOKE EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) TO authenticated, service_role;
    END IF;
END $$;

-- 15. mark_invoice_paid_transactional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'mark_invoice_paid_transactional') THEN
        REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;
    END IF;
END $$;

-- 16. get_next_invoice_serial
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_next_invoice_serial') THEN
        REVOKE EXECUTE ON FUNCTION public.get_next_invoice_serial(uuid, text, date) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_next_invoice_serial(uuid, text, date) TO authenticated, service_role;
    END IF;
END $$;

-- 17. handle_new_user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'handle_new_user') THEN
        REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
    END IF;
END $$;

-- 18. validate_project_status_transition
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'validate_project_status_transition') THEN
        REVOKE EXECUTE ON FUNCTION public.validate_project_status_transition() FROM PUBLIC;
    END IF;
END $$;

-- 19. log_project_status_transition
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'log_project_status_transition') THEN
        REVOKE EXECUTE ON FUNCTION public.log_project_status_transition() FROM PUBLIC;
    END IF;
END $$;

-- 20. enforce_invoice_immutability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'enforce_invoice_immutability') THEN
        REVOKE EXECUTE ON FUNCTION public.enforce_invoice_immutability() FROM PUBLIC;
    END IF;
END $$;

-- 21. enforce_invoice_items_immutability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'enforce_invoice_items_immutability') THEN
        REVOKE EXECUTE ON FUNCTION public.enforce_invoice_items_immutability() FROM PUBLIC;
    END IF;
END $$;

-- 22. archive_invoice_revision
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'archive_invoice_revision') THEN
        REVOKE EXECUTE ON FUNCTION public.archive_invoice_revision() FROM PUBLIC;
    END IF;
END $$;

-- 23. check_project_workspace_alignment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_project_workspace_alignment') THEN
        REVOKE EXECUTE ON FUNCTION public.check_project_workspace_alignment() FROM PUBLIC;
    END IF;
END $$;

-- 24. check_payment_workspace_alignment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_payment_workspace_alignment') THEN
        REVOKE EXECUTE ON FUNCTION public.check_payment_workspace_alignment() FROM PUBLIC;
    END IF;
END $$;

-- 4. Autovacuum Tuning for High-Volume Invoices & Activity Logs
ALTER TABLE public.invoices SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_limit = 1000
);
ALTER TABLE public.activity_logs SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_limit = 1000
);
ALTER TABLE public.email_logs SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_limit = 1000
);

-- 5. Scalable Partial Index for Dashboard Aggregation
CREATE INDEX IF NOT EXISTS idx_invoices_dashboard_aggregation 
ON public.invoices(workspace_id) 
WHERE deleted_at IS NULL;

-- 6. Additional performance indexes for workspace query routing
CREATE INDEX IF NOT EXISTS idx_projects_workspace_deleted 
ON public.projects(workspace_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_workspace_deleted 
ON public.clients(workspace_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_profile_created 
ON public.activity_logs(workspace_id, profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_profile_deleted 
ON public.workspaces(profile_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_workspace_deleted
ON public.payments(workspace_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_workspace_deleted
ON public.deliverables(workspace_id)
WHERE deleted_at IS NULL;

-- 7. Get Consolidated Dashboard Data RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_name TEXT;
  v_total_clients INT;
  v_activities JSON;
  v_invoices JSON;
  v_projects JSON;
BEGIN
  -- Verify workspace ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Profile name
  SELECT COALESCE(full_name, 'Freelancer') INTO v_profile_name 
  FROM public.profiles 
  WHERE id = p_profile_id AND deleted_at IS NULL;

  -- 2. Recent activities
  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_activities 
  FROM (
    SELECT id, workspace_id, profile_id, project_id, action, details, created_at 
    FROM public.activity_logs 
    WHERE workspace_id = p_workspace_id AND profile_id = p_profile_id 
    ORDER BY created_at DESC 
    LIMIT 5
  ) t;

  -- 3. Invoices
  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_invoices 
  FROM (
    SELECT total, status, created_at 
    FROM public.invoices 
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
  ) t;

  -- 4. Projects
  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_projects 
  FROM (
    SELECT status 
    FROM public.projects 
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
  ) t;

  -- 5. Clients count
  SELECT COUNT(*) INTO v_total_clients 
  FROM public.clients 
  WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

  RETURN json_build_object(
    'profile_name', v_profile_name,
    'activities', v_activities,
    'invoices', v_invoices,
    'projects', v_projects,
    'total_clients', v_total_clients
  );
END;
$$;

-- Grant execution permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_data') THEN
        REVOKE EXECUTE ON FUNCTION public.get_dashboard_data(uuid, uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_dashboard_data(uuid, uuid) TO authenticated, service_role;
    END IF;
END $$;


-- ============================================================
-- MIGRATION 026: TAX ENGINE 2.0 SCHEMA ENHANCEMENTS
-- ============================================================

-- 1. Enhance workspace_settings
ALTER TABLE public.workspace_settings 
ADD COLUMN IF NOT EXISTS tax_scheme TEXT DEFAULT 'regular' CHECK (tax_scheme IN ('regular', 'composition', 'non_gst')),
ADD COLUMN IF NOT EXISTS lut_number TEXT,
ADD COLUMN IF NOT EXISTS lut_expiry_date DATE,
ADD COLUMN IF NOT EXISTS default_tds_section TEXT,
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'INR';

-- 2. Enhance invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS discount_scope TEXT DEFAULT 'before_tax' CHECK (discount_scope IN ('before_tax', 'after_tax')),
ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tds_section TEXT,
ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS net_receivable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS round_off NUMERIC(6, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) DEFAULT 1.000000,
ADD COLUMN IF NOT EXISTS exchange_rate_date DATE,
ADD COLUMN IF NOT EXISTS inr_total NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS supply_type TEXT DEFAULT 'taxable' CHECK (supply_type IN ('taxable', 'exempt', 'nil_rated', 'zero_rated_lut', 'zero_rated_non_lut', 'sez_with_tax', 'sez_without_tax')),
ADD COLUMN IF NOT EXISTS tax_scheme TEXT DEFAULT 'regular' CHECK (tax_scheme IN ('regular', 'composition', 'non_gst')),
ADD COLUMN IF NOT EXISTS lut_number TEXT,
ADD COLUMN IF NOT EXISTS lut_date DATE;

-- 3. Enhance invoice_items table
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'NOS',
ADD COLUMN IF NOT EXISTS sac_code TEXT,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cess_rate NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2) DEFAULT 0.00;

-- 4. Reference table for standard HSN/SAC codes
CREATE TABLE IF NOT EXISTS public.hsn_sac_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('HSN', 'SAC')),
    default_gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed standard service SAC codes
INSERT INTO public.hsn_sac_codes (code, description, type, default_gst_rate)
VALUES 
    ('998311', 'IT Consulting and Support Services', 'SAC', 18.00),
    ('998313', 'Information Technology Design and Development', 'SAC', 18.00),
    ('998314', 'Web Design and Development Services', 'SAC', 18.00),
    ('998315', 'Software Development and Maintenance Services', 'SAC', 18.00),
    ('998399', 'Other Professional Technical & Business Services', 'SAC', 18.00),
    ('998413', 'Advertising & Marketing Services', 'SAC', 18.00),
    ('9983', 'General IT & Technical Services', 'SAC', 18.00)
ON CONFLICT (code) DO NOTHING;

-- 5. TDS Certificates tracking table
CREATE TABLE IF NOT EXISTS public.tds_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    financial_year TEXT NOT NULL,
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    certificate_number TEXT,
    deducted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deposit_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'verified')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tax Audit Logs table
CREATE TABLE IF NOT EXISTS public.tax_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Currency Exchange Rate Snapshots
CREATE TABLE IF NOT EXISTS public.exchange_rate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL DEFAULT 'USD',
    to_currency TEXT NOT NULL DEFAULT 'INR',
    rate NUMERIC(12, 6) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'RBI_MANUAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT exchange_rate_snapshots_from_to_date_key UNIQUE(from_currency, to_currency, effective_date)
);

-- RLS Security Policies for new tables
ALTER TABLE public.hsn_sac_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public readable HSN/SAC codes" ON public.hsn_sac_codes;
CREATE POLICY "Public readable HSN/SAC codes" ON public.hsn_sac_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Workspace isolated TDS certificates" ON public.tds_certificates;
CREATE POLICY "Workspace isolated TDS certificates" ON public.tds_certificates FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Workspace isolated Tax Audit Logs" ON public.tax_audit_logs;
DROP POLICY IF EXISTS "Workspace isolated Tax Audit Logs Select" ON public.tax_audit_logs;
DROP POLICY IF EXISTS "Workspace isolated Tax Audit Logs Insert" ON public.tax_audit_logs;
CREATE POLICY "Workspace isolated Tax Audit Logs Select" ON public.tax_audit_logs FOR SELECT USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated Tax Audit Logs Insert" ON public.tax_audit_logs FOR INSERT WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())) AND (performed_by IS NULL OR performed_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Public readable Exchange Rates" ON public.exchange_rate_snapshots;
CREATE POLICY "Public readable Exchange Rates" ON public.exchange_rate_snapshots FOR SELECT USING (true);


-- ============================================================
-- MIGRATION 027: UPI DEEP LINK PAYMENT SYSTEM SCHEMA
-- ============================================================

-- 1. PAYMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    provider_id TEXT NOT NULL DEFAULT 'upi_direct',
    upi_id TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CONSTRAINT payment_requests_amount_positive CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    deep_link_uri TEXT NOT NULL,
    transaction_note TEXT,
    reference_number TEXT NOT NULL,
    qr_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'initiated', 'awaiting_verification', 'verified', 'paid', 'cancelled', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PAYMENT ATTEMPTS TABLE (Client UTR Submissions)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    utr_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    screenshot_url TEXT,
    notes TEXT,
    app_name TEXT DEFAULT 'UPI_GENERIC',
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PAYMENT VERIFICATIONS TABLE (Freelancer Manual Approvals)
CREATE TABLE IF NOT EXISTS public.payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE CASCADE NOT NULL,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    verifier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('approved', 'rejected')),
    bank_reference TEXT,
    notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PAYMENT AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. PAYMENT RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    payment_verification_id UUID REFERENCES public.payment_verifications(id) ON DELETE SET NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    utr_number TEXT NOT NULL,
    client_name TEXT NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INDEXES FOR PERFORMANCE OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_payment_requests_ws_status ON public.payment_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ws_status ON public.payment_attempts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_ws_status ON public.payment_receipts(workspace_id);

-- RLS Security Policies
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace isolated payment requests" ON public.payment_requests;
CREATE POLICY "Workspace isolated payment requests" ON public.payment_requests FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Workspace isolated payment attempts" ON public.payment_attempts;
CREATE POLICY "Workspace isolated payment attempts" ON public.payment_attempts FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));


DROP POLICY IF EXISTS "Workspace isolated payment verifications" ON public.payment_verifications;
CREATE POLICY "Workspace isolated payment verifications" ON public.payment_verifications FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Workspace isolated payment audit logs" ON public.payment_audit_logs;
CREATE POLICY "Workspace isolated payment audit logs" ON public.payment_audit_logs FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Workspace isolated payment receipts" ON public.payment_receipts;
CREATE POLICY "Workspace isolated payment receipts" ON public.payment_receipts FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));


-- ============================================================
-- MIGRATION 028: DATABASE PERFORMANCE OPTIMIZATION & INDEXING
-- Ujrat High-Performance Indexing & Query Acceleration
-- ============================================================

-- 1. WORKSPACE MULTI-TENANCY & RLS EVALUATION INDEXES
-- Critical for speeding up RLS subqueries (SELECT id FROM workspaces WHERE profile_id = auth.uid())
CREATE INDEX IF NOT EXISTS idx_workspaces_profile_id 
    ON public.workspaces(profile_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id 
    ON public.workspace_settings(workspace_id);

-- 2. CLIENTS TABLE INDEXES
-- Optimizes CRM listing, status filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_clients_ws_status_created 
    ON public.clients(workspace_id, status, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_ws_email 
    ON public.clients(workspace_id, email) 
    WHERE deleted_at IS NULL;

-- 3. PROJECTS TABLE INDEXES
-- Optimizes pipeline state queries, client joins, and portal token lookups
CREATE INDEX IF NOT EXISTS idx_projects_portal_token 
    ON public.projects(portal_token) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_ws_status_created 
    ON public.projects(workspace_id, status, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client_id 
    ON public.projects(client_id) 
    WHERE deleted_at IS NULL;

-- 4. INVOICES & LINE ITEMS INDEXES
-- Optimizes revenue aggregations, milestone invoices, and tax calculations
CREATE INDEX IF NOT EXISTS idx_invoices_ws_status_created 
    ON public.invoices(workspace_id, status, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project_id 
    ON public.invoices(project_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_due_status 
    ON public.invoices(status, due_date) 
    WHERE deleted_at IS NULL AND status NOT IN ('paid', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id 
    ON public.invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id 
    ON public.invoice_versions(invoice_id, version DESC);

-- 5. PAYMENTS & RECONCILIATION INDEXES
-- Optimizes settlement queries, UTR lookups, and invoice associations
CREATE INDEX IF NOT EXISTS idx_payments_ws_status_date 
    ON public.payments(workspace_id, status, payment_date DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_ws_status_created 
    ON public.payments(workspace_id, status, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
    ON public.payments(invoice_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tx_ref 
    ON public.payments(transaction_reference) 
    WHERE transaction_reference IS NOT NULL AND deleted_at IS NULL;

-- 6. WORKSPACE SUBSIDIARY TABLES INDEXES (Proposals, Contracts, Briefs, Deliverables)
CREATE INDEX IF NOT EXISTS idx_project_briefs_project_id 
    ON public.project_briefs(project_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_project_id 
    ON public.proposals(project_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal_id 
    ON public.proposal_sections(proposal_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_project_id 
    ON public.contracts(project_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id 
    ON public.contract_signatures(contract_id);

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id 
    ON public.deliverables(project_id, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_ws_proj 
    ON public.deliverables(workspace_id, project_id);

-- 7. AUDIT LOGS, ACTIVITY LOGS & OTP VERIFICATIONS
CREATE INDEX IF NOT EXISTS idx_activity_logs_ws_prof_created 
    ON public.activity_logs(workspace_id, profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id 
    ON public.activity_logs(project_id, created_at DESC) 
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_project_id 
    ON public.email_logs(project_id, created_at DESC) 
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_ws_created 
    ON public.email_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_verifications_active 
    ON public.portal_verifications(project_id, email, verified, expires_at);

CREATE INDEX IF NOT EXISTS idx_financial_audit_ws_created 
    ON public.financial_audit_trail(workspace_id, created_at DESC);

-- 8. HIGH-PERFORMANCE DASHBOARD AGGREGATION RPC
-- Consolidates 5 independent network round-trips into a single atomic Postgres function
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_name TEXT;
    v_total_clients INT;
    v_projects JSONB;
    v_invoices JSONB;
    v_activities JSONB;
BEGIN
    -- Verify caller owns the workspace
    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = p_workspace_id AND profile_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized workspace access';
    END IF;

    -- 1. Profile Name
    SELECT full_name INTO v_profile_name
    FROM public.profiles
    WHERE id = p_profile_id;

    -- 2. Total active clients
    SELECT COUNT(*) INTO v_total_clients
    FROM public.clients
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    -- 3. Projects with status
    SELECT COALESCE(jsonb_agg(jsonb_build_object('status', p.status)), '[]'::jsonb) INTO v_projects
    FROM public.projects p
    WHERE p.workspace_id = p_workspace_id AND p.deleted_at IS NULL;

    -- 4. Invoices with status, total, created_at
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'total', i.total,
            'status', i.status,
            'created_at', i.created_at
        )
    ), '[]'::jsonb) INTO v_invoices
    FROM public.invoices i
    WHERE i.workspace_id = p_workspace_id AND i.deleted_at IS NULL;

    -- 5. Latest 5 activity logs
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'workspace_id', a.workspace_id,
            'profile_id', a.profile_id,
            'project_id', a.project_id,
            'action', a.action,
            'details', a.details,
            'created_at', a.created_at
        ) ORDER BY a.created_at DESC
    ), '[]'::jsonb) INTO v_activities
    FROM (
        SELECT * FROM public.activity_logs
        WHERE workspace_id = p_workspace_id AND profile_id = p_profile_id
        ORDER BY created_at DESC
        LIMIT 5
    ) a;

    -- Return consolidated payload
    RETURN jsonb_build_object(
        'profile_name', COALESCE(v_profile_name, 'Freelancer'),
        'total_clients', COALESCE(v_total_clients, 0),
        'projects', v_projects,
        'invoices', v_invoices,
        'activities', v_activities
    );
END;
$$;

-- 9. AUTOMATED GATEWAY PAYMENT RECONCILIATION RPC
-- Reconciles incoming webhook payments from payment gateways (Razorpay, Cashfree, Stripe)
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
SET search_path = public
AS $$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_new_balance NUMERIC;
    v_new_status TEXT;
BEGIN
    -- Idempotency check: check if transaction already reconciled
    SELECT id INTO v_payment_id 
    FROM public.payments 
    WHERE transaction_reference = p_transaction_id;

    IF v_payment_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Transaction already reconciled',
            'payment_id', v_payment_id
        );
    END IF;

    -- Fetch and lock invoice row
    SELECT * INTO v_invoice 
    FROM public.invoices 
    WHERE id = p_invoice_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % not found', p_invoice_id;
    END IF;

    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Insert reconciled payment record
    INSERT INTO public.payments (
        workspace_id,
        invoice_id,
        amount,
        currency,
        status,
        payment_method,
        transaction_reference,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_invoice.workspace_id,
        v_invoice.id,
        p_amount,
        COALESCE(v_invoice.currency, 'INR'),
        'completed',
        COALESCE(p_gateway, 'gateway_webhook'),
        p_transaction_id,
        'Automated reconciliation via ' || COALESCE(p_gateway, 'webhook'),
        NOW(),
        NOW()
    ) RETURNING id INTO v_payment_id;

    -- Calculate updated balance
    v_new_balance := GREATEST(0, COALESCE(v_invoice.outstanding_balance, v_invoice.total) - p_amount);
    v_new_status := CASE WHEN v_new_balance = 0 THEN 'paid' ELSE v_invoice.status END;

    -- Update invoice balance & status atomically
    UPDATE public.invoices 
    SET 
        outstanding_balance = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- Log financial audit trail
    INSERT INTO public.financial_audit_trail (
        workspace_id,
        invoice_id,
        payment_id,
        action,
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

-- Restrict execution of reconciliation to service_role (edge function / backend worker only)
REVOKE EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================
-- WAITLIST TABLE & RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON public.waitlist (lower(trim(email)));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to insert waitlist entry" ON public.waitlist;
CREATE POLICY "Allow public to insert waitlist entry"
    ON public.waitlist
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        char_length(trim(name)) >= 2 AND
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
        char_length(trim(service)) >= 2
    );

DROP POLICY IF EXISTS "Allow service role full access to waitlist" ON public.waitlist;
CREATE POLICY "Allow service role full access to waitlist"
    ON public.waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
