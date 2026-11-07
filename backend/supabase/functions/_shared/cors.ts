/**
 * Shared CORS helper for Edge Functions.
 *
 * Replaces the previous `Access-Control-Allow-Origin: '*'` wildcard. The
 * allow-list is built from (in order):
 *   1. `ALLOWED_ORIGINS` env (comma-separated, e.g. "https://ujrat.ninety5.in")
 *   2. `APP_URL` / `VITE_APP_URL` env
 *   3. `http://localhost:5173` (local dev fallback — only when
 *      ENVIRONMENT is not production)
 *
 * The request's `Origin` is echoed back only when allow-listed; non-matching
 * origins get NO `Access-Control-Allow-Origin` header (fail-closed).
 * Webhook callers without an `Origin` header are unaffected.
 */

const BASE_HEADERS = 'authorization, x-client-info, apikey, content-type';

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getCorsHeaders(req: Request, extraHeaders = ''): Record<string, string> {
  const isProduction = (Deno.env.get('ENVIRONMENT') || '').toLowerCase() === 'production';
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const appUrls = [
    Deno.env.get('APP_URL'),
    Deno.env.get('VITE_APP_URL'),
    isProduction ? null : 'http://localhost:5173',
  ].filter((v): v is string => !!v);
  const allowlist = [...new Set([...configured, ...appUrls].map(normalizeOrigin))];

  const origin = normalizeOrigin(req.headers.get('origin') || '');
  const allowOrigin = allowlist.includes(origin) ? origin : '';

  const allowHeaders = extraHeaders ? `${BASE_HEADERS}, ${extraHeaders}` : BASE_HEADERS;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  return headers;
}
