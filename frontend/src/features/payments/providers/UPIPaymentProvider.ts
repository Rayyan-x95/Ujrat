/**
 * Ujrat Payment System - UPI Deep Link Utilities
 * Gateway-Independent Direct NPCI UPI Specification Implementation
 */

import type { PaymentRequestParams } from '../types/PaymentTypes';

/**
 * Generates official NPCI UPI Deep Link URI
 * Spec: upi://pay?pa=<upi_id>&pn=<payee_name>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
 */
export function generateUpiDeepLink(params: PaymentRequestParams): string {
  const cleanVpa = (params.payeeVpa || '').trim();
  if (!cleanVpa || !cleanVpa.includes('@')) {
    throw new Error('Invalid or empty payee UPI VPA.');
  }
  const numAmount = Number(params.amount || 0);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const amountStr = numAmount.toFixed(2);
  const cleanPayee = (params.payeeName || 'Freelancer').trim();
  // NPCI transaction reference: two links generated in the same second must
  // not collide, so derive uniqueness from a UUID instead of a timestamp.
  const ref = `INV-${params.invoiceNumber}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const note = (params.note || `Invoice ${params.invoiceNumber}`).trim();

  const upiParams: Record<string, string> = {
    pa: cleanVpa,
    pn: cleanPayee,
    am: amountStr,
    cu: (params.currency || 'INR').toUpperCase(),
    tr: ref,
    tn: note,
  };

  const query = Object.entries(upiParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `upi://pay?${query}`;
}

export function generateAppSpecificDeepLink(params: PaymentRequestParams, schemePrefix: string): string {
  const queryString = generateUpiDeepLink(params).replace('upi://pay?', '');
  return `${schemePrefix}${queryString}`;
}

export class UPIPaymentProvider {
  readonly providerId = 'upi_direct';
  readonly providerName = 'UPI Direct (Deep Link & QR)';

  generateDeepLink = generateUpiDeepLink;
  generateAppSpecificDeepLink = generateAppSpecificDeepLink;
}
