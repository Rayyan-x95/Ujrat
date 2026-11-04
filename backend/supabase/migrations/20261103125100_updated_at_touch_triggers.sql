-- Migration: keep updated_at fresh on plain UPDATEs.
--
-- Tables declare updated_at with a default, but only hand-written update
-- paths set it; REST/RPC updates left it frozen, so change-detection or sync
-- keyed on updated_at silently saw "nothing changed".

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces', 'workspace_settings', 'clients', 'projects', 'invoices', 'payments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;
