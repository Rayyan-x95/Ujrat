/**
 * Ujrat Tax Engine 2.0 - Master Entry Point & Facade
 * Indian GST • TDS • International Taxation • RCM • Compliance • Audit Trail
 */

export * from '../tax/TaxTypes';
export * from '../tax/InvoiceCalculator';
export { numberToIndianRupeeWords, formatCurrency } from '@/shared/utils/currency';

import {
  evaluateTaxRules,
  calculateGSTBreakdown,
  calculateTDSBreakdown,
  validateGSTINFormat,
  calculateInvoiceTax,
  validateTaxCalculation,
  toPaise,
  fromPaise,
} from '../tax/InvoiceCalculator';
import type { InvoiceItemTaxInput } from '../tax/TaxTypes';

// Backward compatibility adapters for existing components
export function determineGSTType(
  freelancer: { is_gst_registered: boolean; state?: string | null; gstin?: string | null; tax_scheme?: any; lut_number?: string | null },
  client: { state?: string | null; gstin?: string | null; country?: string | null; is_sez?: boolean }
): { isInterstate: boolean; isZeroRated: boolean; isReverseCharge: boolean; suppressesGst: boolean } {
  const rules = evaluateTaxRules(
    {
      is_gst_registered: freelancer.is_gst_registered,
      state: freelancer.state,
      gstin: freelancer.gstin,
      tax_scheme: freelancer.tax_scheme,
      lut_number: freelancer.lut_number,
    },
    {
      state: client.state,
      gstin: client.gstin,
      country: client.country,
      is_sez: client.is_sez,
    }
  );

  return {
    isInterstate: rules.isInterstate,
    isZeroRated: rules.isZeroRated,
    isReverseCharge: rules.isReverseCharge,
    suppressesGst: rules.suppressesGst,
  };
}

export function calculateGST(
  baseAmount: number,
  gstRate: number,
  isInterstate: boolean,
  isZeroRated: boolean,
  suppressesGst: boolean = false
): { subtotal: number; cgst: number; sgst: number; igst: number; total: number } {
  const items: InvoiceItemTaxInput[] = [
    {
      description: 'Item',
      quantity: 1,
      rate: baseAmount,
      gst_rate: gstRate,
    },
  ];

  const breakdown = calculateGSTBreakdown(items, isInterstate, isZeroRated, false, 0, suppressesGst);

  return {
    subtotal: breakdown.subtotal,
    cgst: breakdown.cgstTotal,
    sgst: breakdown.sgstTotal,
    igst: breakdown.igstTotal,
    total: breakdown.subtotal + breakdown.totalGst,
  };
}

export function calculateTDS(
  taxableAmount: number,
  invoiceTotalOrSection?: number | string,
  sectionOrRate?: string | number,
  rate?: number
): { tdsAmount: number; netReceivable: number; section: string | null; rate: number } {
  let section: string = '194J';
  let appliedRate: number | undefined = rate;
  let totalAmount = taxableAmount;

  if (typeof invoiceTotalOrSection === 'number') {
    totalAmount = invoiceTotalOrSection;
    if (typeof sectionOrRate === 'string') {
      section = sectionOrRate;
    }
    appliedRate = rate;
  } else if (typeof invoiceTotalOrSection === 'string') {
    section = invoiceTotalOrSection;
    if (typeof sectionOrRate === 'number') {
      appliedRate = sectionOrRate;
    }
  }

  const res = calculateTDSBreakdown(taxableAmount, { section, rate: appliedRate });
  const netReceivable = fromPaise(Math.max(0, toPaise(totalAmount) - toPaise(res.tdsAmount)));

  return {
    tdsAmount: res.tdsAmount,
    netReceivable,
    section: res.section,
    rate: res.rate,
  };
}

export function isValidGstin(gstin: string): boolean {
  return validateGSTINFormat(gstin).isValid;
}

export const TaxEngine = {
  calculateInvoiceTax,
  validateTaxCalculation,
  determineGSTType,
  calculateGST,
  calculateTDS,
  isValidGstin,
};
