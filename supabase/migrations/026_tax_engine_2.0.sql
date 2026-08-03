-- Migration 026: Tax Engine 2.0 Schema Enhancements
-- Production-grade Indian GST, TDS, RCM, Export/LUT, Multi-Currency, and Audit Trail support.

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
    currency TEXT,
    snapshot_date DATE,
    from_currency TEXT NOT NULL DEFAULT 'USD',
    to_currency TEXT NOT NULL DEFAULT 'INR',
    rate NUMERIC(12, 6) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'RBI_MANUAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT exchange_rate_snapshots_curr_date_key UNIQUE(currency, snapshot_date),
    CONSTRAINT exchange_rate_snapshots_from_to_date_key UNIQUE(from_currency, to_currency, effective_date)
);

-- RLS Security Policies for new tables
ALTER TABLE public.hsn_sac_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public readable HSN/SAC codes" ON public.hsn_sac_codes FOR SELECT USING (true);
CREATE POLICY "Workspace isolated TDS certificates" ON public.tds_certificates FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated Tax Audit Logs" ON public.tax_audit_logs FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Public readable Exchange Rates" ON public.exchange_rate_snapshots FOR SELECT USING (true);
