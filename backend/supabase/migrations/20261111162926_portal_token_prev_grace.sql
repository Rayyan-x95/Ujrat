-- Migration: grace window for the previous portal token.
--
-- Sharing any portal document rotates projects.portal_token_hash, which used
-- to invalidate every link already sent for that project. The immediately
-- previous hash now stays valid for 30 days after a rotation, so a proposal
-- link survives an invoice share and vice versa.
--
-- shortcut: only one previous token is kept; the older one is retired on the
-- next rotation. Move to a per-link token table if multi-stage links must all
-- stay alive at once.
--
-- Applies to fresh and live databases: the DO block rewrites the lookup in
-- every portal RPC (the hashing migration did the same for token -> hash).

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS portal_token_prev_hash TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS portal_token_prev_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS projects_portal_token_prev_hash_idx
  ON public.projects (portal_token_prev_hash) WHERE portal_token_prev_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hash_portal_token_on_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_token IS NOT NULL THEN
    -- A rotation retires the current hash into the grace slot; rewrites of
    -- the same token (same hash) are not rotations.
    IF TG_OP = 'UPDATE'
       AND OLD.portal_token_hash IS NOT NULL
       AND OLD.portal_token_hash <> encode(sha256(NEW.portal_token::bytea), 'hex') THEN
      NEW.portal_token_prev_hash := OLD.portal_token_hash;
      NEW.portal_token_prev_expires_at := now() + interval '30 days';
    END IF;
    NEW.portal_token_hash := encode(sha256(NEW.portal_token::bytea), 'hex');
    NEW.portal_token := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
  v_def TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosrc LIKE '%portal_token_hash = encode(sha256(token_val::bytea), ''hex'')%'
      AND p.prosrc NOT LIKE '%portal_token_prev_hash%'
  LOOP
    v_def := replace(
      r.def,
      'WHERE p.portal_token_hash = encode(sha256(token_val::bytea), ''hex'')',
      'WHERE (p.portal_token_hash = encode(sha256(token_val::bytea), ''hex'') OR (p.portal_token_prev_hash = encode(sha256(token_val::bytea), ''hex'') AND p.portal_token_prev_expires_at > now()))'
    );
    v_def := replace(
      v_def,
      'WHERE portal_token_hash = encode(sha256(token_val::bytea), ''hex'')',
      'WHERE (portal_token_hash = encode(sha256(token_val::bytea), ''hex'') OR (portal_token_prev_hash = encode(sha256(token_val::bytea), ''hex'') AND portal_token_prev_expires_at > now()))'
    );
    EXECUTE v_def;
  END LOOP;
END
$$;
