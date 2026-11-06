-- Migration: dashboard aging buckets + daily overdue engine.
--
-- get_dashboard_data gains aging { overdue, due_7d, later } - SUM of
-- COALESCE(outstanding_balance, total) grouped by due_date, excluding
-- paid / cancelled / draft, matching the RPC's outstanding definition.
-- The nightly pg_cron job flips stale sent/viewed/partially_paid invoices
-- to overdue. StateMachine already allows sent/viewed/partially_paid ->
-- overdue (see InvoiceStateMachine), so no client edit is needed.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily 06:00 Asia/Kolkata == 00:30 UTC (Kolkata is UTC+5:30 year-round).
SELECT cron.unschedule('ujrat-mark-overdue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ujrat-mark-overdue');

SELECT cron.schedule(
  'ujrat-mark-overdue',
  '30 0 * * *',
  $$
    UPDATE public.invoices
    SET status = 'overdue'
    WHERE due_date < CURRENT_DATE
      AND status IN ('sent', 'viewed', 'partially_paid')
      AND deleted_at IS NULL;
  $$
);

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_profile UUID;
    v_profile_name TEXT;
    v_total_clients INT;
    v_projects JSONB;
    v_invoices JSONB;
    v_activities JSONB;
    v_outstanding NUMERIC;
    v_earned_this_month NUMERIC;
    v_monthly_revenue JSONB;
    v_aging JSONB;
BEGIN
    v_caller_profile := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = p_workspace_id
          AND profile_id = v_caller_profile
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id;
    END IF;

    SELECT full_name INTO v_profile_name
    FROM public.profiles
    WHERE id = v_caller_profile;

    SELECT COUNT(*) INTO v_total_clients
    FROM public.clients
    WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    SELECT COALESCE(SUM(COALESCE(outstanding_balance, total)), 0)
      INTO v_outstanding
    FROM public.invoices
    WHERE workspace_id = p_workspace_id
      AND deleted_at IS NULL
      AND status NOT IN ('paid', 'cancelled', 'draft');

    SELECT COALESCE(SUM(amount), 0)
      INTO v_earned_this_month
    FROM public.payments
    WHERE workspace_id = p_workspace_id
      AND deleted_at IS NULL
      AND status = 'completed'
      AND payment_date >= date_trunc('month', now());

    SELECT COALESCE(jsonb_agg(month_total ORDER BY month_index), '[]'::jsonb)
      INTO v_monthly_revenue
    FROM (
        SELECT g.month_index, COALESCE(SUM(pay.amount), 0) AS month_total
        FROM generate_series(1, 12) AS g(month_index)
        LEFT JOIN public.payments pay
          ON pay.workspace_id = p_workspace_id
         AND pay.deleted_at IS NULL
         AND pay.status = 'completed'
         AND EXTRACT(YEAR FROM pay.payment_date) = EXTRACT(YEAR FROM now())
         AND EXTRACT(MONTH FROM pay.payment_date) = g.month_index
        GROUP BY g.month_index
    ) months;

    -- Aging buckets: same receivable filter as outstanding, split by due_date.
    SELECT jsonb_build_object(
        'overdue', COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE
                                     THEN COALESCE(i.outstanding_balance, i.total) ELSE 0 END), 0),
        'due_7d',  COALESCE(SUM(CASE WHEN i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
                                     THEN COALESCE(i.outstanding_balance, i.total) ELSE 0 END), 0),
        'later',   COALESCE(SUM(CASE WHEN i.due_date > CURRENT_DATE + 7
                                     THEN COALESCE(i.outstanding_balance, i.total) ELSE 0 END), 0)
    )
      INTO v_aging
    FROM public.invoices i
    WHERE i.workspace_id = p_workspace_id
      AND i.deleted_at IS NULL
      AND i.status NOT IN ('paid', 'cancelled', 'draft');

    SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb) INTO v_projects
    FROM (
        SELECT id, name, client_id, budget, status, timeline_start, timeline_end, portal_token, created_at, updated_at
        FROM public.projects
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) p;

    SELECT COALESCE(jsonb_agg(to_jsonb(i.*)), '[]'::jsonb) INTO v_invoices
    FROM (
        SELECT id, project_id, invoice_number, total, status, due_date, outstanding_balance, created_at
        FROM public.invoices
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) i;

    SELECT COALESCE(jsonb_agg(to_jsonb(a.*)), '[]'::jsonb) INTO v_activities
    FROM (
        SELECT id, project_id, action, details, created_at
        FROM public.activity_logs
        WHERE workspace_id = p_workspace_id
        ORDER BY created_at DESC
        LIMIT 20
    ) a;

    RETURN jsonb_build_object(
        'profile', jsonb_build_object('name', v_profile_name),
        'metrics', jsonb_build_object(
            'total_clients', v_total_clients,
            'outstanding', v_outstanding,
            'earned_this_month', v_earned_this_month,
            'monthly_revenue', v_monthly_revenue,
            'aging', v_aging
        ),
        'recent_projects', v_projects,
        'recent_invoices', v_invoices,
        'recent_activities', v_activities
    );
END;
$$;
