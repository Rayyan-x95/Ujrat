-- Migration 027: UPI Deep Link Payment System Schema
-- Provider-Independent Payment Requests, Attempts, Verifications, Audit Logs, and Receipts

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
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    utr_number TEXT NOT NULL,
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
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE NOT NULL,
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

CREATE POLICY "Workspace isolated payment requests" ON public.payment_requests FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated payment attempts" ON public.payment_attempts FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated payment verifications" ON public.payment_verifications FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated payment audit logs" ON public.payment_audit_logs FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
CREATE POLICY "Workspace isolated payment receipts" ON public.payment_receipts FOR ALL USING (workspace_id = (SELECT auth.uid()) OR workspace_id IN (SELECT id FROM public.workspaces WHERE profile_id = (SELECT auth.uid())));
