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

export function sanitizeSearchTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[(),*%\\]/g, '')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}
