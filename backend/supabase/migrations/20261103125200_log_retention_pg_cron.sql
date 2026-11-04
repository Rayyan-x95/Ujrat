-- Migration: nightly retention for the append-only log tables.
--
-- Every audit/log table in the baseline grows without bound; the dashboards
-- that read them regress over the years (the one self-pruning table is
-- edge_function_rate_limits, added in 20261020000008). financial_audit_trail
-- and invoice_versions are kept forever - they back the statutory money
-- history and have no substitute.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('ujrat-log-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ujrat-log-retention');

SELECT cron.schedule(
  'ujrat-log-retention',
  '37 20 * * *',
  $$
    DELETE FROM public.portal_verifications WHERE created_at < now() - interval '90 days';
    DELETE FROM public.activity_logs WHERE created_at < now() - interval '18 months';
    DELETE FROM public.email_logs WHERE created_at < now() - interval '18 months';
    DELETE FROM public.tax_audit_logs WHERE created_at < now() - interval '18 months';
  $$
);
