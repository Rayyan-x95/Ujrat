/**
 * Ujrat Tax Engine 2.0 - Tax Utilities & Decimal Math
 * Zero-Floating Point Loss Math • GSTIN Parser • PAN Extractor • Number Words
 */

import { GST_STATE_CODES, STATE_NAME_TO_CODE } from './TaxConstants';

/**
 * Converts major currency unit to integer minor unit (paise/cents)
 * Prevents floating point inaccuracy like 100.05 * 100 = 10004.999999999998
 */
export function toPaise(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Converts integer minor unit (paise) back to 2-decimal rounded number
 */
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Safely computes percentage of an amount using integer paise precision
 */
export function safePercentage(baseAmount: number, percentage: number): number {
  const basePaise = toPaise(baseAmount);
  const resultPaise = Math.round(basePaise * (percentage / 100));
  return fromPaise(resultPaise);
}

/**
 * Extracts 2-digit GST state code from GSTIN or state name
 */
export function extractStateCode(gstin?: string | null, stateName?: string | null): string | null {
  if (gstin && /^\d{2}/.test(gstin.trim())) {
    const code = gstin.trim().substring(0, 2);
    if (GST_STATE_CODES[code]) {
      return code;
    }
  }

  if (stateName) {
    const normalized = stateName.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!normalized) return null;
    if (STATE_NAME_TO_CODE[normalized]) {
      return STATE_NAME_TO_CODE[normalized];
    }
    // Partial search match for state name skipping legacy entries and finding longest exact-prefix match
    let bestMatchCode: string | null = null;
    let maxMatchLen = 0;
    for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
      if (name.includes('(legacy)') || name.includes('(old)')) continue;
      const cleanName = name.replace(/\s*\([^)]*\)/g, '').trim();
      if (normalized.startsWith(cleanName) || cleanName.startsWith(normalized) || normalized.includes(cleanName) || cleanName.includes(normalized)) {
        if (cleanName.length > maxMatchLen) {
          maxMatchLen = cleanName.length;
          bestMatchCode = code;
        }
      }
    }
    if (bestMatchCode) return bestMatchCode;
  }

  return null;
}

/**
 * Extracts 10-character PAN number from a 15-character Indian GSTIN
 * Pattern: 2-digit state code + 10-char PAN + 1-char entity + 1-char 'Z' + 1-char checksum
 */
export function extractPANFromGSTIN(gstin?: string | null): string | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase();
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    return clean.substring(2, 12);
  }
  return null;
}

/**
 * Validates Indian GSTIN format with regex & state code verification
 */
export function validateGSTINFormat(gstin?: string | null): { isValid: boolean; stateName?: string; pan?: string; error?: string } {
  if (!gstin || !gstin.trim()) {
    return { isValid: false, error: 'GSTIN is empty' };
  }

  const clean = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(clean)) {
    return { isValid: false, error: 'Invalid 15-character GSTIN format (e.g. 29AAAAA1111A1Z1)' };
  }

  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) {
    return { isValid: false, error: `Invalid GST state code prefix: ${stateCode}` };
  }

  const pan = clean.substring(2, 12);
  return { isValid: true, stateName, pan };
}
