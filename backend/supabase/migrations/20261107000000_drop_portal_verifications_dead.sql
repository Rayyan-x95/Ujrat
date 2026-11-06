-- Drop dead portal OTP verification path (dead since 20261106130000).
DROP FUNCTION IF EXISTS public.generate_portal_verification(text);
DROP FUNCTION IF EXISTS public.verify_portal_code(text, text);
DROP TABLE IF EXISTS public.portal_verifications;

-- Remove portal_verifications from the retention cron.
SELECT cron.unschedule('ujrat-log-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ujrat-log-retention');

SELECT cron.schedule(
  'ujrat-log-retention',
  '37 20 * * *',
  $$
    DELETE FROM public.activity_logs WHERE created_at < now() - interval '18 months';
    DELETE FROM public.email_logs WHERE created_at < now() - interval '18 months';
    DELETE FROM public.tax_audit_logs WHERE created_at < now() - interval '18 months';
  $$
);
