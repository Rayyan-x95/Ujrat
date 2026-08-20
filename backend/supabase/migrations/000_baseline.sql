-- Migration 000: Ujrat Baseline Schema
-- This is the consolidated baseline migration combining all previous migrations.
-- Run this for fresh installs instead of migrations 001-025 + date-based migrations.

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
    slug TEXT NOT NULL,
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
    pan TEXT,
    state TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    upi_id TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_next_number INTEGER DEFAULT 1,
    is_gst_registered BOOLEAN DEFAULT false,
    tax_scheme TEXT DEFAULT 'regular' CHECK (tax_scheme IN ('regular', 'composition', 'non_gst')),
    lut_number TEXT,
    lut_expiry_date DATE,
    default_tds_section TEXT,
    preferred_currency TEXT DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'inactive')),
    state TEXT,
    gstin TEXT,
    pan TEXT,
    billing_address TEXT,
    currency TEXT DEFAULT 'INR',
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
    description TEXT,
    budget NUMERIC(12, 2) DEFAULT 0.00 CONSTRAINT projects_budget_nonnegative CHECK (budget >= 0),
    timeline_start DATE,
    timeline_end DATE,
    deliverables JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'lead' CONSTRAINT projects_status_check CHECK (status IN ('lead', 'proposal', 'approved', 'contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent', 'paid', 'completed', 'archived')),
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
    pricing NUMERIC(12, 2) DEFAULT 0.00 CONSTRAINT proposals_pricing_nonnegative CHECK (pricing >= 0),
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
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    introduction TEXT,
    payment_schedule TEXT,
    terms TEXT,
    scope TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CONSTRAINT contracts_status_check CHECK (status IN ('draft', 'sent', 'signed', 'void')),
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
    signature_image TEXT,
    signature_type TEXT DEFAULT 'typed',
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
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    notes TEXT,
    gstin TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_subtotal_nonnegative CHECK (subtotal >= 0),
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_cgst_nonnegative CHECK (cgst >= 0),
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_sgst_nonnegative CHECK (sgst >= 0),
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_igst_nonnegative CHECK (igst >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_total_nonnegative CHECK (total >= 0),
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_taxable_nonnegative CHECK (taxable_amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_scope TEXT DEFAULT 'before_tax' CHECK (discount_scope IN ('before_tax', 'after_tax')),
    cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tds_section TEXT,
    tds_rate NUMERIC(5, 2) DEFAULT 0.00,
    tds_amount NUMERIC(12, 2) DEFAULT 0.00,
    net_receivable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(6, 2) DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC(12, 6) DEFAULT 1.000000,
    exchange_rate_date DATE,
    inr_total NUMERIC(12, 2) DEFAULT 0.00,
    supply_type TEXT DEFAULT 'taxable' CHECK (supply_type IN ('taxable', 'exempt', 'nil_rated', 'zero_rated_lut', 'zero_rated_non_lut', 'sez_with_tax', 'sez_without_tax')),
    tax_scheme TEXT DEFAULT 'regular' CHECK (tax_scheme IN ('regular', 'composition', 'non_gst')),
    lut_number TEXT,
    lut_date DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'pending_verification', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    pdf_url TEXT,
    freelancer_gstin TEXT,
    client_gstin TEXT,
    freelancer_state TEXT,
    client_state TEXT,
    is_interstate BOOLEAN DEFAULT false,
    is_zero_rated BOOLEAN DEFAULT false,
    is_reverse_charge BOOLEAN DEFAULT false,
    outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoices_outstanding_nonnegative CHECK (outstanding_balance >= 0),
    prefix TEXT,
    year INTEGER,
    serial_number INTEGER,
    revision_number INTEGER NOT NULL DEFAULT 0,
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
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CONSTRAINT invoice_items_quantity_nonnegative CHECK (quantity >= 0),
    rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoice_items_rate_nonnegative CHECK (rate >= 0),
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    hsn_code TEXT,
    unit TEXT DEFAULT 'NOS',
    sac_code TEXT,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) DEFAULT 0.00,
    cess_rate NUMERIC(5, 2) DEFAULT 0.00,
    cess_amount NUMERIC(12, 2) DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    line_total NUMERIC(12, 2) DEFAULT 0.00,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT invoice_items_amount_nonnegative CHECK (amount >= 0)
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
    verifier_id UUID REFERENCES public.profiles(id),
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
    title TEXT,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    file_name TEXT,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revision_requested')),
    client_feedback TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
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
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
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
    action TEXT,
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

-- REFERENCE TABLE: HSN/SAC CODES
CREATE TABLE public.hsn_sac_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('HSN', 'SAC')),
    default_gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- TDS CERTIFICATES TABLE
CREATE TABLE public.tds_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    financial_year TEXT NOT NULL,
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    certificate_number TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    filing_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TAX AUDIT LOGS TABLE
CREATE TABLE public.tax_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    event_type TEXT NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENT REQUESTS TABLE
CREATE TABLE public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    payer_upi_id TEXT,
    payer_name TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    upi_uri TEXT NOT NULL,
    qr_data TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENT ATTEMPTS TABLE
CREATE TABLE public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    utr_number TEXT NOT NULL CONSTRAINT payment_attempts_utr_number_key UNIQUE,
    amount NUMERIC(12, 2) NOT NULL CONSTRAINT payment_attempts_amount_positive CHECK (amount > 0),
    status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    rejection_reason TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENT VERIFICATIONS TABLE
CREATE TABLE public.payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE CASCADE NOT NULL,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    verifier_id UUID REFERENCES public.profiles(id),
    verification_status TEXT NOT NULL CHECK (verification_status IN ('approved', 'rejected')),
    bank_reference TEXT,
    notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENT AUDIT LOGS TABLE
CREATE TABLE public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PAYMENT RECEIPTS TABLE
CREATE TABLE public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
    receipt_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL CONSTRAINT payment_receipts_amount_positive CHECK (amount > 0),
    receipt_url TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- WAITLIST TABLE
CREATE TABLE public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON public.waitlist (lower(trim(email)));

-- ============================================================
-- DOMAIN BOUNDARIES & SCHEMA COMMENTS
-- ============================================================

COMMENT ON TABLE public.profiles IS '@domain: Core - User authentication profile linked to auth.users';
COMMENT ON TABLE public.workspaces IS '@domain: Core - Multi-tenant workspace root isolation entity';
COMMENT ON TABLE public.workspace_settings IS '@domain: Core - Workspace business settings, GST registration, bank and UPI config';

COMMENT ON TABLE public.clients IS '@domain: CRM - Workspace client directory with GST and communication details';
COMMENT ON TABLE public.projects IS '@domain: Projects - Client project lifecycle root; access gated by get_portal_project';
COMMENT ON TABLE public.project_briefs IS '@domain: Projects - Client requirements and project scope briefing';
COMMENT ON TABLE public.deliverables IS '@domain: Projects - File deliveries and assets for client handover';

COMMENT ON TABLE public.proposals IS '@domain: Contracts - Proposal document and pricing scope';
COMMENT ON TABLE public.proposal_sections IS '@domain: Contracts - Modular custom content sections in proposals';
COMMENT ON TABLE public.contracts IS '@domain: Contracts - Legally binding client contracts';
COMMENT ON TABLE public.contract_signatures IS '@domain: Contracts - Cryptographic/audit client signature verification';

COMMENT ON TABLE public.invoices IS '@domain: Finance - Authoritative GST tax invoices with integer paise calculation';
COMMENT ON TABLE public.invoice_items IS '@domain: Finance - Itemized invoice line items with HSN/SAC and GST breakdown';
COMMENT ON TABLE public.invoice_versions IS '@domain: Finance - Immutable audit snapshots of issued invoice revisions';

COMMENT ON TABLE public.payments IS '@domain: Payments - Authoritative financial payment settlement ledger';
COMMENT ON TABLE public.payment_requests IS '@domain: Payments - NPCI UPI dynamic deep link intent requests';
COMMENT ON TABLE public.payment_attempts IS '@domain: Payments - Client UTR submission logs awaiting verification';
COMMENT ON TABLE public.payment_verifications IS '@domain: Payments - Freelancer verification approval events';
COMMENT ON TABLE public.payment_receipts IS '@domain: Payments - Generated official GST payment receipts';

COMMENT ON TABLE public.activity_logs IS '@domain: Telemetry - Freelancer workspace operation audit logs';
COMMENT ON TABLE public.email_logs IS '@domain: Telemetry - Transactional email dispatch history';
COMMENT ON TABLE public.financial_audit_trail IS '@domain: Telemetry - Immutable financial mutation ledger';
COMMENT ON TABLE public.portal_verifications IS '@domain: Security - Zero-auth OTP verification table (deny-all direct)';
COMMENT ON TABLE public.edge_function_rate_limits IS '@domain: Security - Sliding-window rate limit counters';

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
ALTER TABLE public.financial_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (Workspace-isolated ownership)
-- ============================================================

-- Profiles: Users can only access their own profile
CREATE POLICY "Select profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Workspaces: Users can only access their own workspaces
CREATE POLICY "Select workspaces" ON public.workspaces FOR SELECT USING (profile_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "Insert workspaces" ON public.workspaces FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Update workspaces" ON public.workspaces FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Delete workspaces" ON public.workspaces FOR DELETE USING (profile_id = auth.uid());

-- Workspace Settings: Access via workspace ownership
CREATE POLICY "Select workspace settings" ON public.workspace_settings FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert workspace settings" ON public.workspace_settings FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update workspace settings" ON public.workspace_settings FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Clients: Workspace-scoped access
CREATE POLICY "Select clients" ON public.clients FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert clients" ON public.clients FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update clients" ON public.clients FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete clients" ON public.clients FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Projects: Workspace-scoped access
CREATE POLICY "Select projects" ON public.projects FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert projects" ON public.projects FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update projects" ON public.projects FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete projects" ON public.projects FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Project Briefs
CREATE POLICY "Select briefs" ON public.project_briefs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert briefs" ON public.project_briefs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update briefs" ON public.project_briefs FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete briefs" ON public.project_briefs FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Proposals
CREATE POLICY "Select proposals" ON public.proposals FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert proposals" ON public.proposals FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update proposals" ON public.proposals FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete proposals" ON public.proposals FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Proposal Sections
CREATE POLICY "Select proposal sections" ON public.proposal_sections FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert proposal sections" ON public.proposal_sections FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update proposal sections" ON public.proposal_sections FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete proposal sections" ON public.proposal_sections FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Contracts
CREATE POLICY "Select contracts" ON public.contracts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert contracts" ON public.contracts FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update contracts" ON public.contracts FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete contracts" ON public.contracts FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Contract Signatures
CREATE POLICY "Select contract signatures" ON public.contract_signatures FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert contract signatures" ON public.contract_signatures FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update contract signatures" ON public.contract_signatures FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete contract signatures" ON public.contract_signatures FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Invoices
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Invoice Items
CREATE POLICY "Select invoice items" ON public.invoice_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert invoice items" ON public.invoice_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update invoice items" ON public.invoice_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete invoice items" ON public.invoice_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Invoice Versions
CREATE POLICY "Select invoice versions" ON public.invoice_versions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert invoice versions" ON public.invoice_versions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payments
CREATE POLICY "Select payments" ON public.payments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert payments" ON public.payments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update payments" ON public.payments FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete payments" ON public.payments FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Deliverables
CREATE POLICY "Select deliverables" ON public.deliverables FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "Insert deliverables" ON public.deliverables FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update deliverables" ON public.deliverables FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete deliverables" ON public.deliverables FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- File Uploads
CREATE POLICY "Select file uploads" ON public.file_uploads FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert file uploads" ON public.file_uploads FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update file uploads" ON public.file_uploads FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete file uploads" ON public.file_uploads FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Activity Logs
CREATE POLICY "Select activity logs" ON public.activity_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert activity logs" ON public.activity_logs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Email Logs
CREATE POLICY "Select email logs" ON public.email_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert email logs" ON public.email_logs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update email logs" ON public.email_logs FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Financial Audit Trail
CREATE POLICY "Select financial audit trail" ON public.financial_audit_trail FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert financial audit trail" ON public.financial_audit_trail FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Portal Verifications: Deny all direct access (RPC only)
CREATE POLICY "RPC only" ON public.portal_verifications FOR ALL USING (false);

-- TDS Certificates
CREATE POLICY "Select tds certificates" ON public.tds_certificates FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert tds certificates" ON public.tds_certificates FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update tds certificates" ON public.tds_certificates FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Delete tds certificates" ON public.tds_certificates FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Tax Audit Logs
CREATE POLICY "Select tax audit logs" ON public.tax_audit_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert tax audit logs" ON public.tax_audit_logs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payment Requests
CREATE POLICY "Select payment requests" ON public.payment_requests FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert payment requests" ON public.payment_requests FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update payment requests" ON public.payment_requests FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payment Attempts
CREATE POLICY "Select payment attempts" ON public.payment_attempts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert payment attempts" ON public.payment_attempts FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update payment attempts" ON public.payment_attempts FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payment Verifications
CREATE POLICY "Select payment verifications" ON public.payment_verifications FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert payment verifications" ON public.payment_verifications FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Update payment verifications" ON public.payment_verifications FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payment Audit Logs
CREATE POLICY "Select payment audit logs" ON public.payment_audit_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert payment audit logs" ON public.payment_audit_logs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Payment Receipts
CREATE POLICY "Select payment receipts" ON public.payment_receipts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "Insert payment receipts" ON public.payment_receipts FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL));

-- Waitlist Policies
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

-- ============================================================
-- INDEXES & PERFORMANCE OPTIMIZATION
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_profile ON public.workspaces(profile_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_profile_id ON public.workspaces(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace ON public.workspace_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON public.workspace_settings(workspace_id);

CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON public.clients(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_ws_status_created ON public.clients(workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_ws_email ON public.clients(workspace_id, email) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_client ON public.projects(workspace_id, client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_portal_token ON public.projects(portal_token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_ws_status_created ON public.projects(workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_briefs_project_id ON public.project_briefs(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON public.proposals(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal_id ON public.proposal_sections(proposal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_sections_workspace_id ON public.proposal_sections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON public.contracts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_workspace_id ON public.contract_signatures(workspace_id);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_project ON public.invoices(workspace_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_ws_status_created ON public.invoices(workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_status ON public.invoices(status, due_date) WHERE deleted_at IS NULL AND status NOT IN ('paid', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_workspace_id ON public.invoice_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id ON public.invoice_versions(invoice_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_workspace_id ON public.invoice_versions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_payments_workspace_invoice ON public.payments(workspace_id, invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_tx_ref ON public.payments(transaction_reference) WHERE transaction_reference IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_ws_status_date ON public.payments(workspace_id, status, payment_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_ws_status_created ON public.payments(workspace_id, status, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON public.deliverables(project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deliverables_workspace_project ON public.deliverables(workspace_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deliverables_ws_proj ON public.deliverables(workspace_id, project_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_ws_prof_created ON public.activity_logs(workspace_id, profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_workspace_id ON public.email_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_profile_id ON public.email_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_project_id ON public.email_logs(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_ws_created ON public.email_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_verifications_project_id ON public.portal_verifications(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_verifications_active ON public.portal_verifications(project_id, email, verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_ws_created ON public.financial_audit_trail(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_trail_project ON public.financial_audit_trail(project_id);

-- ============================================================
-- TRIGGER FUNCTIONS AND TRIGGERS
-- ============================================================

-- Auto-create Profile and Workspace on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Project State Machine Validation Trigger
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
  ELSIF OLD.status = 'invoice_sent' AND NEW.status NOT IN ('paid') THEN
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

DROP TRIGGER IF EXISTS projects_status_transition_trigger ON public.projects;
CREATE TRIGGER projects_status_transition_trigger
  BEFORE UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_status_transition();

-- Project Transition History Logging Trigger
CREATE OR REPLACE FUNCTION public.log_project_status_transition()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_status_log_trigger ON public.projects;
CREATE TRIGGER projects_status_log_trigger
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_status_transition();

-- F4: Invoices MUST be created as drafts.
CREATE OR REPLACE FUNCTION public.enforce_invoice_insert_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' THEN
    NEW.status := 'draft';
  END IF;
  IF NEW.outstanding_balance IS NULL THEN
    NEW.outstanding_balance := COALESCE(NEW.total, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_insert_defaults_trigger ON public.invoices;
CREATE TRIGGER invoices_insert_defaults_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_insert_defaults();

-- F3 + F19: Full financial immutability for issued invoices.
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

DROP TRIGGER IF EXISTS invoices_immutability_trigger ON public.invoices;
CREATE TRIGGER invoices_immutability_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_immutability();

-- ------------------------------------------------------------
-- F5: Payment integrity at the database boundary.
--  - amounts and transaction references are immutable
--  - status moves forward-only along the canonical machine
--    pending -> (pending_verification) -> completed | failed
--  - terminal states are frozen
--  - completion requires verifier attribution (or a server /
--    webhook context where auth.uid() is NULL)
--  - completed payments and payments of paid invoices cannot be
--    deleted or soft-deleted
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_payment_mutation()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_integrity_trigger ON public.payments;
CREATE TRIGGER payments_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_mutation();

CREATE OR REPLACE FUNCTION public.validate_payment_delete()
RETURNS trigger AS $$
DECLARE
  v_invoice_status TEXT;
  BEGIN
    SELECT status INTO v_invoice_status FROM public.invoices WHERE id = OLD.invoice_id;
    IF OLD.status = 'completed' OR v_invoice_status = 'paid' THEN
      RAISE EXCEPTION 'Settled payments are part of the financial record and cannot be deleted';
    END IF;
    RETURN OLD;
  END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_delete_guard_trigger ON public.payments;
CREATE TRIGGER payments_delete_guard_trigger
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_delete();

-- Invoice Line Items Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_invoice_items_immutability()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_items_immutability_trigger ON public.invoice_items;
CREATE TRIGGER invoice_items_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_items_immutability();

-- Invoice Versions Table Trigger (Archiving Revisions)
CREATE OR REPLACE FUNCTION public.archive_invoice_revision()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_revision_archive_trigger ON public.invoices;
CREATE TRIGGER invoice_revision_archive_trigger
  AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.archive_invoice_revision();

-- Workspace Alignment Triggers
CREATE OR REPLACE FUNCTION public.check_project_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_project_workspace_alignment ON public.projects;
CREATE TRIGGER enforce_project_workspace_alignment
  BEFORE INSERT OR UPDATE OF client_id, workspace_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.check_project_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_payment_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_payment_workspace_alignment ON public.payments;
CREATE TRIGGER enforce_payment_workspace_alignment
  BEFORE INSERT OR UPDATE OF invoice_id, workspace_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_invoice_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_invoice_workspace_alignment ON public.invoices;
CREATE TRIGGER enforce_invoice_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_contract_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_contract_workspace_alignment ON public.contracts;
CREATE TRIGGER enforce_contract_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.check_contract_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_proposal_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_proposal_workspace_alignment ON public.proposals;
CREATE TRIGGER enforce_proposal_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.check_proposal_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_deliverable_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_deliverable_workspace_alignment ON public.deliverables;
CREATE TRIGGER enforce_deliverable_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.check_deliverable_workspace_alignment();

CREATE OR REPLACE FUNCTION public.check_brief_workspace_alignment()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_brief_workspace_alignment ON public.project_briefs;
CREATE TRIGGER enforce_brief_workspace_alignment
  BEFORE INSERT OR UPDATE OF project_id, workspace_id ON public.project_briefs
  FOR EACH ROW EXECUTE FUNCTION public.check_brief_workspace_alignment();

-- Trigger to synchronize introduction and content across legacy and current consumers
CREATE OR REPLACE FUNCTION public.sync_contracts_introduction_and_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.introduction IS NOT NULL AND (NEW.content IS NULL OR (TG_OP = 'UPDATE' AND NEW.content = OLD.content)) THEN
    NEW.content := NEW.introduction;
  ELSIF NEW.content IS NOT NULL AND (NEW.introduction IS NULL OR (TG_OP = 'UPDATE' AND NEW.introduction = OLD.introduction)) THEN
    NEW.introduction := NEW.content;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contracts_content ON public.contracts;
CREATE TRIGGER trg_sync_contracts_content
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contracts_introduction_and_content();

-- Invoice Status Transition & Payment Settlement Invariant Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_invoice_status_transition()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_status_transition_trigger ON public.invoices;
CREATE TRIGGER invoices_status_transition_trigger
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status_transition();

-- ============================================================
-- SECURITY DEFINER PORTAL & SERVICE RPCS
-- ============================================================

-- ------------------------------------------------------------
-- F2: Gateway reconciliation rebuilt against the real schema
-- ------------------------------------------------------------

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

  v_new_balance := GREATEST(0, COALESCE(v_invoice.outstanding_balance, v_invoice.total) - p_amount);
  v_new_status := CASE WHEN v_new_balance = 0 THEN 'paid' ELSE v_invoice.status END;

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

-- ------------------------------------------------------------
-- F6: Cryptographically secure OTP codes.
-- Replaces random() (non-cryptographic) with pgcrypto entropy.
-- 30 bits are reduced modulo 900000; residual modulo bias is
-- negligible (<0.001%) and irrelevant given bcrypt hashing,
-- 15-minute expiry, 5-attempt caps and 10/day generation caps.
-- ------------------------------------------------------------

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
  v_entropy BYTEA;
BEGIN
  DELETE FROM public.portal_verifications WHERE expires_at < now();

  SELECT p.id, cl.email, p.workspace_id INTO v_project_id, v_client_email, v_workspace_id
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  SELECT MAX(last_sent_at) INTO v_last_sent
  FROM public.portal_verifications
  WHERE project_id = v_project_id AND email = v_client_email;

  IF v_last_sent IS NOT NULL AND v_last_sent + interval '60 seconds' > now() THEN
    RAISE EXCEPTION 'Please wait 60 seconds before requesting a new code';
  END IF;

  SELECT COUNT(*) INTO v_generation_count
  FROM public.portal_verifications
  WHERE email = v_client_email AND created_at + interval '24 hours' > now();

  IF v_generation_count >= 10 THEN
    RAISE EXCEPTION 'Too many verification attempts. Please try again tomorrow.';
  END IF;

  -- CSPRNG-derived 6-digit code (pgcrypto, seeded from OpenSSL).
  v_entropy := gen_random_bytes(4);
  v_code := (((get_byte(v_entropy, 0)::bigint << 22)
           | (get_byte(v_entropy, 1)::bigint << 14)
           | (get_byte(v_entropy, 2)::bigint << 6)
           | (get_byte(v_entropy, 3)::bigint >> 2)) % 900000 + 100000)::text;

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

  INSERT INTO public.email_logs (
    id, workspace_id, project_id, recipient, subject, body, status, created_at
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

CREATE OR REPLACE FUNCTION public.verify_portal_code(token_val text, entered_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  IF entered_code IS NULL OR char_length(btrim(entered_code)) <> 6 THEN
    RETURN false;
  END IF;

  SELECT pv.id, pv.code_hash, pv.attempts, pv.max_attempts
  INTO v_record
  FROM public.portal_verifications pv
  JOIN public.projects p ON p.id = pv.project_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at)
    AND pv.verified = false
    AND pv.expires_at > now()
  ORDER BY pv.created_at DESC
  LIMIT 1
  FOR UPDATE OF pv;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_record.attempts >= v_record.max_attempts THEN
    RETURN false;
  END IF;

  IF v_record.code_hash = crypt(entered_code, v_record.code_hash) THEN
    UPDATE public.portal_verifications SET verified = true WHERE id = v_record.id;
    RETURN true;
  ELSE
    UPDATE public.portal_verifications SET attempts = attempts + 1 WHERE id = v_record.id;
    RETURN false;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- F9: Absolute portal-token lifetime. Tokens issued more than
-- PORTAL_TOKEN_MAX_AGE days ago are dead regardless of
-- portal_token_expires_at, eliminating immortal portal links.
-- Freelancers rotate tokens to issue fresh links.
-- ------------------------------------------------------------

-- STABLE (not IMMUTABLE): depends on now().
CREATE OR REPLACE FUNCTION public.portal_token_is_live(p_created_at timestamptz, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (p_expires_at IS NULL OR p_expires_at > now())
     AND p_created_at > now() - interval '90 days';
$$;

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
    AND public.portal_token_is_live(created_at, portal_token_expires_at);
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
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

-- ------------------------------------------------------------
-- F7 (revised): Projection limited to what client-facing surfaces consume.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_portal_settings(text);
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
    AND del.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);
END;
$$;

DROP FUNCTION IF EXISTS public.submit_portal_signature(text, text, text, boolean);
DROP FUNCTION IF EXISTS public.submit_portal_signature(text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.submit_portal_signature(text, text, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.submit_portal_signature(
  token_val text,
  sig_name text,
  ip_addr text DEFAULT NULL,
  email_verified boolean DEFAULT true,
  sig_image text DEFAULT NULL,
  sig_type text DEFAULT 'drawn'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_contract_id UUID;
  v_freelancer_profile_id UUID;
  v_freelancer_email TEXT;
  v_project_name TEXT;
  v_client_name TEXT;
BEGIN
  SELECT p.id, p.workspace_id, p.name, cl.name INTO v_project_id, v_workspace_id, v_project_name, v_client_name
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired portal token';
  END IF;

  SELECT c.id INTO v_contract_id
  FROM public.contracts c
  WHERE c.project_id = v_project_id
    AND c.deleted_at IS NULL;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found for this project';
  END IF;

  SELECT w.profile_id, prof.email INTO v_freelancer_profile_id, v_freelancer_email
  FROM public.workspaces w
  JOIN public.profiles prof ON prof.id = w.profile_id
  WHERE w.id = v_workspace_id;

  INSERT INTO public.contract_signatures (
    id,
    workspace_id,
    contract_id,
    signature_name,
    signature_image,
    signature_type,
    ip_address,
    signature_date
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    v_contract_id,
    sig_name,
    sig_image,
    COALESCE(sig_type, 'drawn'),
    COALESCE(ip_addr, 'unknown'),
    now()
  );

  UPDATE public.contracts
  SET status = 'signed', updated_at = now()
  WHERE id = v_contract_id;

  UPDATE public.projects
  SET status = 'contract_signed', updated_at = now()
  WHERE id = v_project_id;

  INSERT INTO public.activity_logs (
    workspace_id,
    profile_id,
    project_id,
    action,
    details
  ) VALUES (
    v_workspace_id,
    v_freelancer_profile_id,
    v_project_id,
    'contract_signed_by_client',
    jsonb_build_object(
      'signature_name', sig_name,
      'signature_type', COALESCE(sig_type, 'drawn'),
      'contract_id', v_contract_id,
      'project_name', v_project_name,
      'client_name', v_client_name,
      'signed_at', now(),
      'has_signature_image', (sig_image IS NOT NULL)
    )
  );

  IF v_freelancer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (
      workspace_id,
      profile_id,
      project_id,
      recipient,
      subject,
      body,
      status,
      attempts,
      max_attempts
    ) VALUES (
      v_workspace_id,
      v_freelancer_profile_id,
      v_project_id,
      v_freelancer_email,
      'Agreement Signed: ' || v_project_name || ' by ' || COALESCE(v_client_name, 'Client'),
      'Hello, your client (' || COALESCE(v_client_name, 'Client') || ') has digitally signed the project agreement for "' || v_project_name || '". ' ||
      'Signature name: ' || sig_name || ' at ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS UTC') || '. ' ||
      'Your project is now in contract_signed status and ready for execution.',
      'pending',
      0,
      3
    );
  END IF;
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
    AND public.portal_token_is_live(created_at, portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  IF amt IS NULL OR amt <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF tx_ref IS NULL OR btrim(tx_ref) = '' OR char_length(btrim(tx_ref)) > 64 THEN
    RAISE EXCEPTION 'A valid transaction reference is required';
  END IF;

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
  v_workspace_id UUID;
BEGIN
  SELECT id, workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects
  WHERE portal_token = token_val
    AND deleted_at IS NULL
    AND public.portal_token_is_live(created_at, portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  UPDATE public.project_briefs
  SET client_feedback = feedback_val,
      client_feedback_at = timezone('utc'::text, now()),
      status = 'changes_requested',
      updated_at = timezone('utc'::text, now())
  WHERE project_id = v_project_id
    AND deleted_at IS NULL;

  INSERT INTO public.activity_logs (workspace_id, project_id, action, details)
  VALUES (
    v_workspace_id,
    v_project_id,
    'brief_feedback',
    jsonb_build_object('feedback', feedback_val)
  );
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
  v_workspace_id UUID;
BEGIN
  SELECT id, workspace_id INTO v_project_id, v_workspace_id
  FROM public.projects
  WHERE portal_token = token_val
    AND deleted_at IS NULL
    AND public.portal_token_is_live(created_at, portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  UPDATE public.proposals
  SET status = 'approved',
      updated_at = timezone('utc'::text, now())
  WHERE project_id = v_project_id
    AND deleted_at IS NULL;

  UPDATE public.projects
  SET status = 'approved',
      updated_at = timezone('utc'::text, now())
  WHERE id = v_project_id;

  INSERT INTO public.activity_logs (workspace_id, project_id, action, details)
  VALUES (
    v_workspace_id,
    v_project_id,
    'proposal_approved',
    jsonb_build_object('approved_at', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope TEXT,
  p_window_seconds INT,
  p_max_requests INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INT,
  window_reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INT;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) = 0 OR char_length(p_scope) > 256 THEN
    RAISE EXCEPTION 'Invalid rate limit scope';
  END IF;
  IF p_window_seconds <= 0 OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'Invalid window or max requests parameters';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.edge_function_rate_limits (scope, window_started_at, request_count)
  VALUES (p_scope, v_window_start, 1)
  ON CONFLICT (scope, window_started_at)
  DO UPDATE SET request_count = public.edge_function_rate_limits.request_count + 1
  RETURNING public.edge_function_rate_limits.request_count INTO v_current_count;

  RETURN QUERY SELECT
    (v_current_count <= p_max_requests) AS allowed,
    v_current_count AS current_count,
    v_window_start + (p_window_seconds || ' seconds')::interval AS window_reset_at;
END;
$$;

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
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  v_invoice_id := COALESCE((p_invoice_data->>'id')::uuid, gen_random_uuid());

  INSERT INTO public.invoices (
    id, workspace_id, project_id, invoice_number,
    issue_date, due_date, subtotal, cgst, sgst, igst, total,
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
    'draft', -- F4: server-authoritative
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
    'items', COALESCE(v_inserted_items, '[]'::jsonb)
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
  v_latest_utr TEXT;
  v_attempt_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access';
  END IF;

  SELECT total INTO v_invoice_total
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND deleted_at IS NULL;

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
    INSERT INTO public.payments (
      workspace_id,
      invoice_id,
      amount,
      payment_method,
      transaction_reference,
      payment_date,
      status,
      verifier_id,
      verified_at,
      notes
    ) VALUES (
      p_workspace_id,
      p_invoice_id,
      v_invoice_total - v_completed_sum,
      'UPI',
      COALESCE(v_latest_utr, 'MANUAL-' || floor(extract(epoch from now()))::text),
      now(),
      'completed',
      auth.uid(),
      now(),
      'Payment verified directly via dashboard'
    );

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

-- ------------------------------------------------------------
-- F10: Dashboard RPC derives identity from JWT
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_profile UUID;
    v_profile_name TEXT;
    v_total_clients INT;
    v_projects JSONB;
    v_invoices JSONB;
    v_activities JSONB;
BEGIN
    v_caller_profile := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = p_workspace_id 
          AND profile_id = v_caller_profile 
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id;
    END IF;

    SELECT full_name INTO v_profile_name
    FROM public.profiles
    WHERE id = v_caller_profile;

    SELECT COUNT(*) INTO v_total_clients
    FROM public.clients
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb) INTO v_projects
    FROM (
        SELECT id, name, client_id, budget, status, timeline_start, timeline_end, portal_token, created_at, updated_at
        FROM public.projects
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) p;

    SELECT COALESCE(jsonb_agg(to_jsonb(i.*)), '[]'::jsonb) INTO v_invoices
    FROM (
        SELECT id, project_id, invoice_number, total, status, due_date, outstanding_balance, created_at
        FROM public.invoices
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) i;

    SELECT COALESCE(jsonb_agg(to_jsonb(a.*)), '[]'::jsonb) INTO v_activities
    FROM (
        SELECT id, project_id, action, details, created_at
        FROM public.activity_logs
        WHERE workspace_id = p_workspace_id
        ORDER BY created_at DESC
        LIMIT 20
    ) a;

    RETURN jsonb_build_object(
        'profile', jsonb_build_object('name', v_profile_name),
        'metrics', jsonb_build_object(
            'total_clients', v_total_clients
        ),
        'recent_projects', v_projects,
        'recent_invoices', v_invoices,
        'recent_activities', v_activities
    );
END;
$$;

-- ------------------------------------------------------------
-- Consolidated execution grants
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_portal_project(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_client(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_settings(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_proposal(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_contract(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_deliverables(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_portal_verification(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_portal_code(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_portal_proposal(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_data(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_portal_project(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_client(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_settings(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_proposal(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_contract(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_deliverables(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_portal_verification(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_portal_code(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_portal_proposal(text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, NUMERIC, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_data(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- F13: Explicit storage policies committed to the repo.
-- ------------------------------------------------------------

DO $$
DECLARE
  b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['avatars','branding','contracts','proposals','invoices','deliverables'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Owner select ' || b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Owner insert ' || b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Owner update ' || b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Owner delete ' || b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = %L
        AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.profile_id = auth.uid()
            AND (storage.foldername(name))[1] = w.id::text
        )
      )
    $f$, 'Owner select ' || b, b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = %L
        AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.profile_id = auth.uid()
            AND (storage.foldername(name))[1] = w.id::text
        )
      )
    $f$, 'Owner insert ' || b, b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = %L
        AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.profile_id = auth.uid()
            AND (storage.foldername(name))[1] = w.id::text
        )
      )
    $f$, 'Owner update ' || b, b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = %L
        AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.profile_id = auth.uid()
            AND (storage.foldername(name))[1] = w.id::text
        )
      )
    $f$, 'Owner delete ' || b, b);
  END LOOP;
END $$;

-- Authenticated portal read access policies for deliverables & invoices
DROP POLICY IF EXISTS "Allow portal client read access to deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow portal client read access to invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated portal read access to deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated portal read access to invoices" ON storage.objects;

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

REVOKE SELECT ON storage.objects FROM anon;
GRANT SELECT ON storage.objects TO authenticated;
