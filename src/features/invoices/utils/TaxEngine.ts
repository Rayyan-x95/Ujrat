/**
 * Ujrat Tax Engine 2.0 - Master Entry Point & Facade
 * Indian GST • TDS • International Taxation • RCM • Compliance • Audit Trail
 */

export * from '../tax/TaxTypes';
export * from '../tax/TaxConstants';
export * from '../tax/TaxUtilities';
export * from '../tax/TaxRules';
export * from '../tax/GSTCalculator';
export * from '../tax/TDSCalculator';
export * from '../tax/InvoiceCalculator';
export * from '../tax/TaxValidator';
export * from '../tax/TaxRepository';
export { numberToIndianRupeeWords, formatCurrency } from '@/shared/utils/currency';

import { evaluateTaxRules } from '../tax/TaxRules';
import { calculateGSTBreakdown } from '../tax/GSTCalculator';
import { validateGSTINFormat } from '../tax/TaxUtilities';
import { calculateInvoiceTax } from '../tax/InvoiceCalculator';
import { validateTaxCalculation } from '../tax/TaxValidator';
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

export function isValidGstin(gstin: string): boolean {
  return validateGSTINFormat(gstin).isValid;
}

export const TaxEngine = {
  calculateInvoiceTax,
  validateTaxCalculation,
  determineGSTType,
  calculateGST,
  isValidGstin,
};
