-- Migration: Supabase performance advisor remediation (read-path latency).
--
-- Remedies the three findings Supabase's performance advisor raised on this
-- project on 2026-11-03:
--   1) auth_rls_initplan (18 WARNs)  -> policy rewrite below
--   2) unindexed_foreign_keys (20)   -> covering FK indexes below
--   3) duplicate_index (4 sets)      -> byte-identical duplicates dropped
-- The 64 "unused index" findings were deliberately NOT actioned: usage stats
-- reset on migrations, so "unused" there does not mean "safe to drop" yet.
--
-- Why it matters for perceived app speed: every workspace-scoped list query
-- evaluates its RLS policy per row; marking auth.uid() as an initplan
-- (single evaluation per statement) removes that per-row overhead, and the
-- FK indexes unblock join/filter plans on the payment and tax audit tables.

-- ============================================================
-- 1) RLS initplan fix: auth.uid() -> (select auth.uid())
--    Rewrites every public-schema policy whose qual or WITH CHECK contains
--    the bare call, preserving permissive/restrictive, roles, and command.
--    Idempotent: already-wrapped occurrences are normalized, never nested;
--    re-running leaves matching policies untouched.
-- ============================================================
DO $rewrite$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  v_roles TEXT;
  v_sql TEXT;
BEGIN
  FOR r IN
    SELECT policyname, tablename, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
  LOOP
    -- Normalize an existing wrapper first so re-runs never nest selects.
    new_qual  := replace(replace(r.qual,       '(select auth.uid())', '##uid##'), 'auth.uid()', '(select auth.uid())');
    new_qual  := replace(new_qual,  '##uid##', '(select auth.uid())');
    new_check := replace(replace(r.with_check, '(select auth.uid())', '##uid##'), 'auth.uid()', '(select auth.uid())');
    new_check := replace(new_check, '##uid##', '(select auth.uid())');

    IF new_qual IS NOT DISTINCT FROM r.qual
       AND new_check IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(role), ', ') INTO v_roles
    FROM unnest(r.roles) AS role;

    -- pg_policies.qual / with_check already carry their outer parentheses.
    v_sql := 'CREATE POLICY ' || quote_ident(r.policyname)
          || ' ON public.' || quote_ident(r.tablename)
          || CASE WHEN upper(r.permissive) = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END
          || ' FOR ' || r.cmd
          || ' TO ' || v_roles
          || COALESCE(' USING ' || new_qual, '')
          || COALESCE(' WITH CHECK ' || new_check, '');

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE v_sql;
  END LOOP;
END
$rewrite$;

-- ============================================================
-- 2) Covering indexes for every single-column foreign key that lacks one.
--    Data-driven over the CURRENT schema: hardcoding the advisor's 2016-11-03
--    findings would break the moment a migration drops/adds a column (e.g. a
--    fresh lineage that has not learned payment_audit_logs.payment_request_id
--    yet). IF NOT EXISTS keeps it re-runnable.
-- ============================================================
DO $fkindexes$
DECLARE
  r RECORD;
  colname TEXT;
BEGIN
  FOR r IN
    SELECT c.conname, pc.relname AS tbl, c.conrelid AS tbl_oid,
           ARRAY(SELECT a.attname
                 FROM pg_attribute a
                 WHERE a.attrelid = c.conrelid
                   AND a.attnum = ANY (c.conkey)
                 ORDER BY a.attnum) AS cols
    FROM pg_constraint c
    JOIN pg_class pc ON pc.oid = c.conrelid
    WHERE c.connamespace = 'public'::regnamespace
      AND c.contype = 'f'
      AND cardinality(c.conkey) = 1
  LOOP
    colname := r.cols[1];
    -- Skip when an index already leads with this column (covering FK usage).
    IF EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE i.indrelid = r.tbl_oid AND a.attname = colname
    ) THEN
      CONTINUE;
    END IF;
    RAISE NOTICE 'fk index: % (%)', r.conname, colname;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      'idx_' || r.conname, r.tbl, colname);
  END LOOP;
END
$fkindexes$;

-- ============================================================
-- 3) Drop byte-identical duplicate indexes (advisor duplicate_index sets).
--    Each set keeps its most descriptively-named member; the dropped ones
--    were exact copies (same columns, same WHERE / partial condition), so
--    they only cost write amplification.
-- ============================================================
DROP INDEX IF EXISTS public.idx_active_clients;        -- == idx_clients_workspace_deleted
DROP INDEX IF EXISTS public.idx_clients_workspace_id;  -- == idx_clients_workspace_deleted
DROP INDEX IF EXISTS public.idx_email_logs_workspace;  -- == idx_email_logs_workspace_id
DROP INDEX IF EXISTS public.idx_invoice_items_invoice; -- == idx_invoice_items_invoice_id
DROP INDEX IF EXISTS public.idx_active_projects;       -- == idx_projects_workspace_deleted
