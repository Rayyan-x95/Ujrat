-- Create covering index for the email_logs.project_id foreign key to optimize query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_project_id ON public.email_logs(project_id);

-- Drop duplicate/redundant Row-Level Security (RLS) policies on public.financial_audit_trail
-- The policy "Owner access to financial audit trail" FOR ALL already covers all operations securely.
DROP POLICY IF EXISTS "Owner write to financial_audit_trail" ON public.financial_audit_trail;
DROP POLICY IF EXISTS "Read access to financial_audit_trail" ON public.financial_audit_trail;
