-- Migration: Add client_feedback, client_feedback_at, and status to project_briefs
-- Required by the submit_portal_brief_feedback() SECURITY DEFINER RPC, which writes to
-- these columns. Without them the function throws "column does not exist" at runtime.

ALTER TABLE public.project_briefs
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'changes_requested', 'approved'));

COMMENT ON COLUMN public.project_briefs.client_feedback IS 'Client-supplied revision notes, written via the zero-auth portal RPC';
COMMENT ON COLUMN public.project_briefs.client_feedback_at IS 'Timestamp of the most recent portal feedback submission';
COMMENT ON COLUMN public.project_briefs.status IS 'Brief lifecycle: pending -> submitted -> changes_requested | approved';
