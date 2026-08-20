/**
 * Ujrat Input Sanitizer & Security Utilities
 * Protects against XSS, Prototype Pollution, and Control Character Injection.
 */

const MAX_SANITIZE_DEPTH = 10;

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  let sanitized = input
    .replace(/[<>]/g, '') // Strip basic HTML tags
    .replace(/[\u200B-\u200D\uFEFF\u202E]/g, '') // Strip Zero-Width and RTL overrides
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip ASCII C0 controls (excluding standard whitespace)
    .trim();

  // Repeatedly strip dangerous URI schemes (including obfuscated/interspersed controls & whitespace) until none remain
  let prev: string;
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:\s*/gi, '');
    sanitized = sanitized.replace(/d\s*a\s*t\s*a\s*:\s*text\/(?:html|javascript|svg\+xml)[^,]*,/gi, '');
    sanitized = sanitized.replace(/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:\s*/gi, '');
  } while (sanitized !== prev);

  return sanitized;
}

export function sanitizeObject<T>(obj: T, depth = 0): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Preserve non-plain objects (Date, RegExp, Map, Set, Blob, File, ArrayBuffer, etc.)
  if (
    obj instanceof Date ||
    obj instanceof RegExp ||
    obj instanceof Map ||
    obj instanceof Set ||
    (typeof Blob !== 'undefined' && obj instanceof Blob) ||
    (typeof File !== 'undefined' && obj instanceof File) ||
    obj instanceof ArrayBuffer
  ) {
    return obj;
  }

  // Fail closed when maximum nesting depth is exceeded for arrays and objects
  if (depth > MAX_SANITIZE_DEPTH) {
    return (Array.isArray(obj) ? [] : Object.create(null)) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1)) as unknown as T;
  }

  // Ensure plain object prototype
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    return obj;
  }

  const cleanObj = Object.create(null) as Record<string, any>;
  const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);

  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (dangerousKeys.has(key)) continue;
    const sanitizedKey = typeof key === 'string' ? sanitizeString(key) : key;
    if (!sanitizedKey || dangerousKeys.has(sanitizedKey)) continue;

    if (typeof value === 'string') {
      cleanObj[sanitizedKey] = sanitizeString(value);
    } else if (value && typeof value === 'object') {
      cleanObj[sanitizedKey] = sanitizeObject(value, depth + 1);
    } else {
      cleanObj[sanitizedKey] = value;
    }
  }

  return cleanObj as T;
}
