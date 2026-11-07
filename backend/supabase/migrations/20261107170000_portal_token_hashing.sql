-- Migration: portal tokens hashed at rest + regenerate-to-reveal UX.
--
-- Previously projects.portal_token held the raw bearer secret (a DB dump
-- leaked every client portal). Now only sha256(portal_token) is stored in
-- portal_token_hash; the raw token is generated client-side, shown once at
-- generation, and never persisted — the freelancer "copy link" flows now
-- rotate (regenerate) and reveal a fresh link per share.
--
-- Steps:
--  1. Add portal_token_hash + unique index; backfill from existing tokens
--     (existing shared links keep working — lookup compares hashes).
--  2. BEFORE INSERT/UPDATE trigger hashes any newly written portal_token
--     and nulls the raw column (new inserts get a raw token from the DB
--     default; the trigger immediately reduces it to its hash).
--  3. All 13 portal RPCs switch to: portal_token_hash =
--     encode(sha256(token_val::bytea), 'hex').
--  4. portal_token is allowed to be NULL and existing raw values are wiped.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS portal_token_hash TEXT;

UPDATE public.projects
SET portal_token_hash = encode(sha256(portal_token::bytea), 'hex')
WHERE portal_token IS NOT NULL AND portal_token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_portal_token_hash_key
  ON public.projects (portal_token_hash) WHERE portal_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hash_portal_token_on_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Any raw token written to projects is reduced to its hash before it
  -- lands on disk; the raw value exists only in the writer's memory.
  IF NEW.portal_token IS NOT NULL THEN
    NEW.portal_token_hash := encode(sha256(NEW.portal_token::bytea), 'hex');
    NEW.portal_token := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hash_portal_token_on_write ON public.projects;
CREATE TRIGGER hash_portal_token_on_write
  BEFORE INSERT OR UPDATE OF portal_token ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.hash_portal_token_on_write();

-- Rewrite every portal RPC from raw comparison to hash comparison.
-- Matches: approve_portal_proposal, get_portal_bundle, get_portal_client,
-- get_portal_contract, get_portal_deliverables, get_portal_invoice_items,
-- get_portal_invoices, get_portal_project, get_portal_proposal,
-- get_portal_settings, submit_portal_brief_feedback, submit_portal_payment,
-- submit_portal_signature. (get_dashboard_data intentionally untouched: it is
-- authenticated and only returns the now-null portal_token column.)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc LIKE '%portal_token = token_val%'
  LOOP
    EXECUTE replace(
      r.def,
      'portal_token = token_val',
      'portal_token_hash = encode(sha256(token_val::bytea), ''hex'')'
    );
  END LOOP;
END
$$;

ALTER TABLE public.projects ALTER COLUMN portal_token DROP NOT NULL;

UPDATE public.projects SET portal_token = NULL WHERE portal_token IS NOT NULL;
