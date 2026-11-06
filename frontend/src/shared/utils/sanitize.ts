/**
 * Defense-in-depth sanitizer for user-supplied search terms before they are
 * interpolated into PostgREST `.or()` / `.ilike()` filter expressions.
 *
 * PostgREST filter syntax uses commas and parentheses as structural tokens;
 * unsanitized values could alter filter semantics. Tenant isolation is still
 * enforced by RLS and explicit workspace_id equality conditions — this layer
 * exists so hostile input can never reshape query structure at all.
 */
const MAX_SEARCH_LENGTH = 100;

/** Hide the passwordless portal token before a URL leaves the browser. */
export function redactPortalToken(url: string): string {
  return url.replace(/(\/portal\/)[^/?#]{2,}/, '$1[redacted]');
}

/**
 * Walk an analytics event and redact the portal token in every string —
 * point-fixes always miss a spot (Sentry span descriptions, span data,
 * nested PostHog properties), so redact the whole shape at send time.
 */
export function deepRedact<T>(value: T): T {
  // Transactions carry circular span/back-references and getter-heavy objects —
  // an unguarded walk overflows the stack (RangeError) and the SDK ships the
  // raw event from its error path. Memoise cycles and swallow getters.
  return (function walk(node: unknown, seen: WeakSet<object>): unknown {
    if (typeof node === 'string') return redactPortalToken(node);
    if (Array.isArray(node)) return node.map((item) => walk(item, seen));
    if (node !== null && typeof node === 'object') {
      if (seen.has(node)) return node;
      seen.add(node);
      const out: Record<string, unknown> = {};
      let entries: [string, unknown][] = [];
      try {
        entries = Object.entries(node);
      } catch {
        return node;
      }
      for (const [key, child] of entries) {
        try {
          out[key] = walk(child, seen);
        } catch {
          out[key] = child;
        }
      }
      return out;
    }
    return node;
  })(value, new WeakSet()) as T;
}

export function sanitizeSearchTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[(),*%\\]/g, '')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}
