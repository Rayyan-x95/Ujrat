/**
 * Shared CORS helper for Edge Functions.
 *
 * Replaces the previous `Access-Control-Allow-Origin: '*'` wildcard. The
 * allow-list is built from (in order):
 *   1. `ALLOWED_ORIGINS` env (comma-separated, e.g. "https://ujrat.ninety5.in")
 *   2. `APP_URL` / `VITE_APP_URL` env
 *   3. `http://localhost:5173` (local dev fallback)
 *
 * The request's `Origin` is echoed back only when allow-listed; otherwise the
 * first allow-listed origin is returned (fail-closed, no wildcard). Set
 * `ALLOWED_ORIGINS` (or `APP_URL`) in production so the portal/app origin is
 * covered. Webhook callers without an `Origin` header are unaffected.
 */

const BASE_HEADERS = 'authorization, x-client-info, apikey, content-type';

export function getCorsHeaders(req: Request, extraHeaders = ''): Record<string, string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const appUrls = [
    Deno.env.get('APP_URL'),
    Deno.env.get('VITE_APP_URL'),
    'http://localhost:5173',
  ].filter((v): v is string => !!v);
  const allowlist = [...new Set([...configured, ...appUrls])];

  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowlist.includes(origin) ? origin : (allowlist[0] || '');

  const allowHeaders = extraHeaders ? `${BASE_HEADERS}, ${extraHeaders}` : BASE_HEADERS;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': allowHeaders,
    'Vary': 'Origin',
  };
}
