-- Migration: Rate-limit table housekeeping and redundant index removal
--
-- 1. edge_function_rate_limits keeps one row per (scope, window) and nothing
--    ever removed the old rows, so the table grew without bound. The consume
--    function now drops rows older than a day on every call.
--
-- 2. projects.portal_token is TEXT UNIQUE NOT NULL, which already creates a
--    unique index. idx_projects_portal_token was a second, partial index on the
--    same column - redundant write amplification for no extra lookups.

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope TEXT,
  p_window_seconds INT,
  p_max_requests INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INT,
  window_reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INT;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) = 0 OR char_length(p_scope) > 256 THEN
    RAISE EXCEPTION 'Invalid rate limit scope';
  END IF;
  IF p_window_seconds <= 0 OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'Invalid window or max requests parameters';
  END IF;

  -- Housekeeping: the table is append-only per window, so old rows would
  -- otherwise pile up forever.
  DELETE FROM public.edge_function_rate_limits
  WHERE window_started_at < now() - interval '1 day';

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.edge_function_rate_limits (scope, window_started_at, request_count)
  VALUES (p_scope, v_window_start, 1)
  ON CONFLICT (scope, window_started_at)
  DO UPDATE SET request_count = public.edge_function_rate_limits.request_count + 1
  RETURNING public.edge_function_rate_limits.request_count INTO v_current_count;

  RETURN QUERY SELECT
    (v_current_count <= p_max_requests) AS allowed,
    v_current_count AS current_count,
    v_window_start + (p_window_seconds || ' seconds')::interval AS window_reset_at;
END;
$$;

DROP INDEX IF EXISTS public.idx_projects_portal_token;
