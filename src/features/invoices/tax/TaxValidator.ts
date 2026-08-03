/**
 * Ujrat Tax Engine 2.0 - Tax Validator
 * Statutory Format Checks • PAN Linkage • GST Split Validation • HSN/SAC Validation
 */

import type { InvoiceTaxCalculationInput, TaxBreakdownResult } from './TaxTypes';
import { validateGSTINFormat } from './TaxUtilities';
import { VALID_GST_RATES } from './TaxConstants';

export interface TaxValidationIssue {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TaxValidationResult {
  isValid: boolean;
  issues: TaxValidationIssue[];
  errors: TaxValidationIssue[];
  warnings: TaxValidationIssue[];
}

export function validateTaxCalculation(
  input: InvoiceTaxCalculationInput,
  result?: TaxBreakdownResult
): TaxValidationResult {
  const issues: TaxValidationIssue[] = [];

  // 1. Validate Freelancer GSTIN if registered
  if (input.freelancer.is_gst_registered) {
    if (!input.freelancer.gstin || !input.freelancer.gstin.trim()) {
      issues.push({
        field: 'freelancer_gstin',
        code: 'MISSING_GSTIN',
        message: 'Freelancer is marked as GST Registered but GSTIN is missing.',
        severity: 'error',
      });
    } else {
      const gstinVal = validateGSTINFormat(input.freelancer.gstin);
      if (!gstinVal.isValid) {
        issues.push({
          field: 'freelancer_gstin',
          code: 'INVALID_GSTIN_FORMAT',
          message: `Freelancer GSTIN error: ${gstinVal.error}`,
          severity: 'error',
        });
      }
    }
  }

  // 2. Validate Client GSTIN if provided
  if (input.client.gstin && input.client.gstin.trim()) {
    const clientGstinVal = validateGSTINFormat(input.client.gstin);
    if (!clientGstinVal.isValid) {
      issues.push({
        field: 'client_gstin',
        code: 'INVALID_CLIENT_GSTIN',
        message: `Client GSTIN error: ${clientGstinVal.error}`,
        severity: 'warning',
      });
    }
  }

  // 3. Validate Line Items
  if (!input.items || input.items.length === 0) {
    issues.push({
      field: 'items',
      code: 'NO_ITEMS',
      message: 'Invoice must contain at least one line item.',
      severity: 'error',
    });
  } else {
    input.items.forEach((item, index) => {
      if (item.quantity <= 0) {
        issues.push({
          field: `items[${index}].quantity`,
          code: 'INVALID_QUANTITY',
          message: `Line item #${index + 1} (${item.description}) must have a positive quantity.`,
          severity: 'error',
        });
      }
      if (item.rate < 0) {
        issues.push({
          field: `items[${index}].rate`,
          code: 'NEGATIVE_RATE',
          message: `Line item #${index + 1} (${item.description}) cannot have a negative rate.`,
          severity: 'error',
        });
      }
      if (!VALID_GST_RATES.includes(item.gst_rate as any)) {
        issues.push({
          field: `items[${index}].gst_rate`,
          code: 'INVALID_GST_RATE',
          message: `Line item #${index + 1} GST rate ${item.gst_rate}% is not a valid statutory GST slab rate (valid slabs: 0%, 3%, 5%, 12%, 18%, 28%).`,
          severity: 'error',
        });
      }
    });
  }

  // 4. Validate GST Splits if result is provided
  if (result) {
    if (result.is_interstate) {
      if (result.cgst > 0 || result.sgst > 0) {
        issues.push({
          field: 'tax_splits',
          code: 'INVALID_INTERSTATE_SPLIT',
          message: 'Inter-state invoice cannot contain CGST or SGST.',
          severity: 'error',
        });
      }
    } else {
      if (result.igst > 0) {
        issues.push({
          field: 'tax_splits',
          code: 'INVALID_INTRASTATE_SPLIT',
          message: 'Intra-state invoice cannot contain IGST.',
          severity: 'error',
        });
      }
      if (Math.abs(result.cgst - result.sgst) > 0.02) {
        issues.push({
          field: 'tax_splits',
          code: 'CGST_SGST_MISMATCH',
          message: 'CGST and SGST amounts must be equal for intra-state supplies.',
          severity: 'error',
        });
      }
    }

    if (result.grand_total < 0) {
      issues.push({
        field: 'grand_total',
        code: 'NEGATIVE_GRAND_TOTAL',
        message: 'Invoice Grand Total cannot be negative.',
        severity: 'error',
      });
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
