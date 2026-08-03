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
    if (STATE_NAME_TO_CODE[normalized]) {
      return STATE_NAME_TO_CODE[normalized];
    }
    // Partial search match for state name
    for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
      if (name.includes(normalized) || normalized.includes(name)) {
        return code;
      }
    }
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

/**
 * Converts numbers to words in the Indian Numbering System (Lakhs & Crores)
 */
export function numberToIndianRupeeWords(num: number): string {
  if (isNaN(num) || num < 0) return 'Zero Rupees Only';

  const totalPaise = Math.round(num * 100);
  const integerPart = Math.floor(totalPaise / 100);
  const decimalPart = totalPaise % 100;

  if (integerPart === 0 && decimalPart === 0) {
    return 'Zero Rupees Only';
  }

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n] || '';
    if (n < 100) return (b[Math.floor(n / 10)] + ' ' + (a[n % 10] || '')).trim();
    if (n < 1000) return (a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100)).trim();
    if (n < 100000) return (inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000)).trim();
    if (n < 10000000) return (inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000)).trim();
    return (inWords(Math.floor(n / 10000000)) + ' Crore ' + inWords(n % 10000000)).trim();
  }

  let words = inWords(integerPart);
  if (!words) words = 'Zero';
  words += ' Rupees';

  if (decimalPart > 0) {
    const decStr = inWords(decimalPart) || 'Zero';
    words += ' and ' + decStr + ' Paise';
  }

  return words + ' Only';
}
