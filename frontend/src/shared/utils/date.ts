/**
 * Parses 'YYYY-MM-DD' date strings as LOCAL dates, not UTC. Non-exhaustive
 * strings (full ISO timestamps etc.) fall back to regular Date parsing.
 */
export function parseLocalDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date);
}

/**
 * Formats a date string or Date object into standard Indian format (dd/mm/yyyy).
 */
export function formatIndianDate(date: string | Date): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formats a date string or Date object into user friendly descriptive format (e.g. 29 Jun 2026).
 */
export function formatFriendlyDate(date: string | Date): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Check if a date is in the past (compared against local day start).
 */
export function isPastDate(date: string | Date): boolean {
  const d = parseLocalDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
