/**
 * Ujrat Input Sanitizer & Security Utilities
 * Protects against XSS, Prototype Pollution, and Control Character Injection.
 */

export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/[<>]/g, '') // Strip basic HTML tags
    .replace(/javascript:/gi, '') // Strip JS URI schemes
    .replace(/data:/gi, '') // Strip data URIs
    .replace(/[\u200B-\u200D\uFEFF\u202E]/g, '') // Strip Zero-Width and RTL overrides
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const clean: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Defend against prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      clean[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}
