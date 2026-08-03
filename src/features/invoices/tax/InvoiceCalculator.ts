/**
 * Ujrat Tax Engine 2.0 - Master Invoice Calculator
 * Single Source of Truth • Deterministic • Zero Floating Point Loss • Multi-Currency
 */

import type {
  InvoiceTaxCalculationInput,
  TaxBreakdownResult,
  DiscountType,
  DiscountScope,
} from './TaxTypes';
import { evaluateTaxRules } from './TaxRules';
import { calculateGSTBreakdown } from './GSTCalculator';
import { calculateTDS } from './TDSCalculator';
import { toPaise, fromPaise } from './TaxUtilities';
import { SUPPORTED_CURRENCIES } from './TaxConstants';

export function calculateInvoiceTax(input: InvoiceTaxCalculationInput): TaxBreakdownResult {
  const currency = input.currency || 'INR';
  const currencyInfo = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR;
  const exchangeRate = currency === 'INR' ? 1.0 : Number(input.exchangeRate || currencyInfo.defaultInrRate || 1.0);
  const exchangeRateDate = input.exchangeRateDate || new Date().toISOString().slice(0, 10);

  // 1. Evaluate Tax Rules & Place of Supply
  const rules = evaluateTaxRules(
    input.freelancer,
    input.client,
    input.supply_type,
    input.isReverseCharge,
    input.lutNumber
  );

  // 2. Pre-calculate Gross Subtotal
  let grossSubtotalPaise = 0;
  for (const item of input.items || []) {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    grossSubtotalPaise += toPaise(qty * rate);
  }

  // 3. Evaluate Global Invoice Discount
  const discType: DiscountType = input.invoiceDiscount?.type || 'fixed';
  const discScope: DiscountScope = input.invoiceDiscount?.scope || 'before_tax';
  const discVal = Number(input.invoiceDiscount?.value || 0);

  let globalDiscountPaise = 0;
  if (discVal > 0) {
    if (discType === 'percentage') {
      globalDiscountPaise = Math.round(grossSubtotalPaise * (discVal / 100));
    } else {
      globalDiscountPaise = toPaise(discVal);
    }
  }

  let invoiceDiscountBeforeTaxPaise = 0;
  let invoiceDiscountAfterTaxPaise = 0;
  if (discScope === 'before_tax') {
    invoiceDiscountBeforeTaxPaise = globalDiscountPaise;
  } else {
    invoiceDiscountAfterTaxPaise = globalDiscountPaise;
  }

  // 4. Calculate GST Breakdown via GSTCalculator
  const gstBreakdown = calculateGSTBreakdown(
    input.items || [],
    rules.isInterstate,
    rules.isZeroRated,
    rules.isReverseCharge,
    invoiceDiscountBeforeTaxPaise,
    rules.suppressesGst,
    rules.supplyType
  );

  const subtotal = gstBreakdown.subtotal;
  const lineDiscountsTotal = gstBreakdown.lineDiscountsTotal;
  const globalDiscountBeforeTax = fromPaise(invoiceDiscountBeforeTaxPaise);
  const totalDiscountBeforeTax = lineDiscountsTotal + globalDiscountBeforeTax;
  const taxableAmount = gstBreakdown.taxableSubtotal;

  const cgst = gstBreakdown.cgstTotal;
  const sgst = gstBreakdown.sgstTotal;
  const igst = gstBreakdown.igstTotal;
  const cess = gstBreakdown.cessTotal;
  const totalGst = gstBreakdown.totalGst;

  // 5. Compute Grand Total & Deterministic Rounding from Taxable Subtotal + GST
  const discountAfterTax = fromPaise(invoiceDiscountAfterTaxPaise);
  const totalDiscount = totalDiscountBeforeTax + discountAfterTax;

  const unroundedGrandTotalPaise =
    toPaise(taxableAmount) + toPaise(totalGst) - invoiceDiscountAfterTaxPaise;

  const roundedGrandTotalPaise = Math.round(unroundedGrandTotalPaise / 100) * 100;
  const roundOffPaise = roundedGrandTotalPaise - unroundedGrandTotalPaise;

  const grandTotalUnrounded = fromPaise(unroundedGrandTotalPaise);
  const grandTotal = fromPaise(roundedGrandTotalPaise);
  const roundOff = fromPaise(roundOffPaise);

  // 6. Compute Income Tax TDS Deduction
  const tdsResult = calculateTDS(
    taxableAmount,
    grandTotal,
    input.tds?.section,
    input.tds?.rate
  );

  // 7. Multi-Currency Foreign Turnover & INR Equivalent from unrounded paise
  const inrSubtotal = fromPaise(Math.round(toPaise(subtotal) * exchangeRate));
  const inrGrandTotal = fromPaise(Math.round(unroundedGrandTotalPaise * exchangeRate));

  return {
    subtotal,
    discount_amount: totalDiscount,
    discount_type: discType,
    discount_scope: discScope,
    taxable_amount: taxableAmount,
    cgst,
    sgst,
    igst,
    cess,
    total_gst: totalGst,
    grand_total_unrounded: grandTotalUnrounded,
    round_off: roundOff,
    grand_total: grandTotal,

    tds_section: tdsResult.tdsSection === 'NONE' ? null : tdsResult.tdsSection,
    tds_rate: tdsResult.tdsRate,
    tds_amount: tdsResult.tdsAmount,
    net_receivable: tdsResult.netReceivable,

    place_of_supply: rules.placeOfSupply,
    is_interstate: rules.isInterstate,
    is_zero_rated: rules.isZeroRated,
    is_reverse_charge: rules.isReverseCharge,
    supply_type: rules.supplyType,
    tax_scheme: rules.taxScheme,

    freelancer_state: input.freelancer.state || '',
    client_state: input.client.state || '',
    freelancer_gstin: input.freelancer.gstin || '',
    client_gstin: input.client.gstin || '',

    currency,
    exchange_rate: exchangeRate,
    exchange_rate_date: exchangeRateDate,
    inr_subtotal: inrSubtotal,
    inr_grand_total: inrGrandTotal,

    declarations: rules.declarations,
    warnings: rules.warnings,
    line_items: gstBreakdown.lineItems,
  };
}
