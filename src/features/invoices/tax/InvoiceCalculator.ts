/**
 * Ujrat Tax Engine 2.0 - Unified Invoice & Tax Calculator
 * Integer Paise Precision Math • GST Determination • TDS Breakdown • Statutory Validations • GSTR-1 Aggregation
 */

import { supabase } from '@/shared/lib/supabaseClient';
import {
  GST_STATE_CODES,
  STATE_NAME_TO_CODE,
  TDS_SECTIONS,
  type FreelancerTaxProfile,
  type ClientTaxProfile,
  type InvoiceItemTaxInput,
  type InvoiceTaxCalculationInput,
  type CalculatedLineItem,
  type TaxBreakdownResult,
  type PlaceOfSupplyType,
  type SupplyType,
  type TaxScheme,
  type GSTR1Summary,
} from './TaxTypes';

// ==========================================
// 1. Precise Decimal / Integer Paise Arithmetic
// ==========================================

export function toPaise(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function safePercentage(baseAmount: number, percentage: number): number {
  const basePaise = toPaise(baseAmount);
  const resultPaise = Math.round(basePaise * (percentage / 100));
  return fromPaise(resultPaise);
}

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
    let bestMatchCode: string | null = null;
    let maxMatchLen = 0;
    for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
      if (name.includes('(legacy)') || name.includes('(old)')) continue;
      const cleanName = name.replace(/\s*\([^)]*\)/g, '').trim();
      const isMatch =
        normalized === cleanName ||
        normalized.startsWith(cleanName + ' ') ||
        cleanName.startsWith(normalized + ' ') ||
        new RegExp(`\\b${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized) ||
        new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cleanName);

      if (isMatch) {
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

export function extractPANFromGSTIN(gstin?: string | null): string | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase();
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    return clean.substring(2, 12);
  }
  return null;
}

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

// ==========================================
// 2. Place of Supply & Statutory Rule Evaluator
// ==========================================

export interface EvaluatedTaxRules {
  placeOfSupply: PlaceOfSupplyType;
  isInterstate: boolean;
  isZeroRated: boolean;
  suppressesGst: boolean;
  isReverseCharge: boolean;
  supplyType: SupplyType;
  taxScheme: TaxScheme;
  freelancerStateCode: string | null;
  clientStateCode: string | null;
  declarations: string[];
  warnings: string[];
}

export function evaluateTaxRules(
  freelancer: FreelancerTaxProfile,
  client: ClientTaxProfile,
  customSupplyType?: SupplyType,
  isCustomRcm?: boolean,
  customLutNumber?: string | null,
  customLutExpiryDate?: string | null
): EvaluatedTaxRules {
  const declarations: string[] = [];
  const warnings: string[] = [];

  const taxScheme: TaxScheme = freelancer.is_gst_registered === false ? 'non_gst' : (freelancer.tax_scheme || 'regular');
  const freeStateCode = extractStateCode(freelancer.gstin, freelancer.state);
  const clientStateCode = extractStateCode(client.gstin, client.state);

  const clientCountry = (client.country || '').trim().toLowerCase();
  const clientStateStr = (client.state || '').trim().toLowerCase();

  const isForeignClient =
    clientCountry !== '' && clientCountry !== 'india' && clientCountry !== 'in';
  
  const isExportKeyword =
    clientStateStr === 'export' ||
    clientStateStr === 'outside india' ||
    clientStateStr === 'international' ||
    clientStateStr === 'foreign' ||
    clientStateStr === 'row';

  const isExport = isForeignClient || isExportKeyword;

  let placeOfSupply: PlaceOfSupplyType = 'intra_state';
  let isInterstate = false;
  let isZeroRated = false;
  let suppressesGst = false;
  let supplyType: SupplyType = customSupplyType || 'taxable';

  const lutNo = customLutNumber || freelancer.lut_number;
  const rawLutExp = customLutExpiryDate || freelancer.lut_expiry_date;
  let lutExpDate: string | null = null;
  if (rawLutExp && typeof rawLutExp === 'string') {
    const match = rawLutExp.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && match[1]) {
      lutExpDate = match[1];
    }
  }
  const todayStr = new Date().toISOString().substring(0, 10);
  const isLutExpired = Boolean(lutExpDate && lutExpDate < todayStr);
  const isLutValid = Boolean(lutNo && !isLutExpired);

  suppressesGst = taxScheme === 'non_gst' || taxScheme === 'composition';

  if (isExport) {
    placeOfSupply = 'export';
    isInterstate = true;
    isZeroRated = true;

    if (!suppressesGst) {
      if (isLutValid) {
        supplyType = 'zero_rated_lut';
        declarations.push(`SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING (LUT NO: ${lutNo}) WITHOUT PAYMENT OF INTEGRATED TAX.`);
      } else {
        supplyType = 'zero_rated_non_lut';
        declarations.push('SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.');
        if (!lutNo) {
          warnings.push('No active LUT Number specified for foreign client. IGST will be applied per GST export rules.');
        } else if (isLutExpired) {
          warnings.push(`LUT Number ${lutNo} expired on ${rawLutExp || ''}. IGST will be applied per GST export rules.`);
        }
      }
    }
  } else if (client.is_sez) {
    placeOfSupply = 'sez';
    isInterstate = true;
    isZeroRated = true;

    if (!suppressesGst) {
      if (isLutValid) {
        supplyType = 'sez_without_tax';
        declarations.push(`SUPPLY TO SEZ DEVELOPER/UNIT UNDER BOND/LUT (NO: ${lutNo}) WITHOUT PAYMENT OF INTEGRATED TAX.`);
      } else {
        supplyType = 'sez_with_tax';
        declarations.push('SUPPLY TO SEZ DEVELOPER/UNIT ON PAYMENT OF INTEGRATED TAX.');
      }
    }
  } else if (freeStateCode && clientStateCode) {
    if (freeStateCode === clientStateCode) {
      placeOfSupply = 'intra_state';
      isInterstate = false;
    } else {
      placeOfSupply = 'inter_state';
      isInterstate = true;
    }
  } else if (freelancer.state && client.state && freelancer.state.trim().toLowerCase() === client.state.trim().toLowerCase()) {
    placeOfSupply = 'intra_state';
    isInterstate = false;
  } else if (client.state) {
    placeOfSupply = 'inter_state';
    isInterstate = true;
  }

  if (taxScheme === 'composition') {
    declarations.push('COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES.');
  }

  const isReverseCharge = Boolean(isCustomRcm);
  if (isReverseCharge) {
    declarations.push('TAX ON THIS INVOICE IS PAYABLE ON REVERSE CHARGE BASIS BY THE RECIPIENT OF SUPPLY.');
  }

  return {
    placeOfSupply,
    isInterstate,
    isZeroRated,
    suppressesGst,
    isReverseCharge,
    supplyType,
    taxScheme,
    freelancerStateCode: freeStateCode,
    clientStateCode: clientStateCode,
    declarations,
    warnings,
  };
}

// ==========================================
// 3. GST Calculation Breakdown
// ==========================================

export interface GSTCalculationResult {
  lineItems: CalculatedLineItem[];
  subtotal: number;
  lineDiscountsTotal: number;
  allocatedInvoiceDiscount: number;
  taxableSubtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  totalGst: number;
}

export function calculateGSTBreakdown(
  items: InvoiceItemTaxInput[],
  isInterstate: boolean,
  isZeroRated: boolean,
  isReverseCharge: boolean,
  invoiceDiscountBeforeTaxPaise: number = 0,
  suppressesGst: boolean = false,
  supplyType?: string
): GSTCalculationResult {
  let subtotalPaise = 0;
  let lineDiscountsPaise = 0;
  let grossTaxablePaise = 0;

  const prepItems = items.map(item => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const grossLinePaise = Math.round(toPaise(qty * rate));
    const lineDiscountPaise = Math.round(toPaise(item.discount_amount || 0));
    const lineTaxablePaise = Math.max(0, grossLinePaise - lineDiscountPaise);

    subtotalPaise += grossLinePaise;
    lineDiscountsPaise += lineDiscountPaise;
    grossTaxablePaise += lineTaxablePaise;

    return {
      item,
      qty,
      rate,
      grossLinePaise,
      lineDiscountPaise,
      lineTaxablePaise,
    };
  });

  let cgstTotalPaise = 0;
  let sgstTotalPaise = 0;
  let igstTotalPaise = 0;
  let cessTotalPaise = 0;
  let netTaxableTotalPaise = 0;
  let allocatedDiscountTotalPaise = 0;

  const isTaxExempt =
    suppressesGst ||
    isReverseCharge ||
    supplyType === 'zero_rated_lut' ||
    supplyType === 'sez_without_tax' ||
    supplyType === 'exempt' ||
    supplyType === 'nil_rated' ||
    (isZeroRated && supplyType !== 'zero_rated_non_lut' && supplyType !== 'sez_with_tax');

  const lineItems: CalculatedLineItem[] = prepItems.map((prep, index) => {
    let itemInvoiceDiscountPaise = 0;
    if (invoiceDiscountBeforeTaxPaise > 0 && grossTaxablePaise > 0) {
      if (index === prepItems.length - 1) {
        itemInvoiceDiscountPaise = Math.max(0, invoiceDiscountBeforeTaxPaise - allocatedDiscountTotalPaise);
      } else {
        itemInvoiceDiscountPaise = Math.round(
          (prep.lineTaxablePaise / grossTaxablePaise) * invoiceDiscountBeforeTaxPaise
        );
      }
    }
    itemInvoiceDiscountPaise = Math.min(itemInvoiceDiscountPaise, prep.lineTaxablePaise);
    allocatedDiscountTotalPaise += itemInvoiceDiscountPaise;

    const netLineTaxablePaise = Math.max(0, prep.lineTaxablePaise - itemInvoiceDiscountPaise);
    netTaxableTotalPaise += netLineTaxablePaise;

    const gstRate = Number(prep.item.gst_rate || 0);
    const cessRate = Number(prep.item.cess_rate || 0);

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let cessPaise = 0;

    if (!isTaxExempt && gstRate > 0) {
      if (isInterstate) {
        igstRate = gstRate;
        igstPaise = Math.round(netLineTaxablePaise * (igstRate / 100));
        igstTotalPaise += igstPaise;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstPaise = Math.round(netLineTaxablePaise * (cgstRate / 100));
        sgstPaise = Math.round(netLineTaxablePaise * (sgstRate / 100));
        cgstTotalPaise += cgstPaise;
        sgstTotalPaise += sgstPaise;
      }
    }

    if (!isTaxExempt && cessRate > 0) {
      cessPaise = Math.round(netLineTaxablePaise * (cessRate / 100));
      cessTotalPaise += cessPaise;
    }

    const lineTotalPaise = netLineTaxablePaise + cgstPaise + sgstPaise + igstPaise + cessPaise;

    return {
      description: prep.item.description || '',
      quantity: prep.qty,
      rate: prep.rate,
      gross_amount: fromPaise(prep.grossLinePaise),
      discount_amount: fromPaise(prep.lineDiscountPaise + itemInvoiceDiscountPaise),
      taxable_amount: fromPaise(netLineTaxablePaise),
      gst_rate: gstRate,
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      igst_rate: igstRate,
      cgst_amount: fromPaise(cgstPaise),
      sgst_amount: fromPaise(sgstPaise),
      igst_amount: fromPaise(igstPaise),
      cess_rate: cessRate,
      cess_amount: fromPaise(cessPaise),
      line_total: fromPaise(lineTotalPaise),
      hsn_code: prep.item.hsn_code || '',
      sac_code: prep.item.sac_code || prep.item.hsn_code || '',
      unit: prep.item.unit || 'NOS',
    };
  });

  const totalGstPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise + cessTotalPaise;

  return {
    lineItems,
    subtotal: fromPaise(subtotalPaise),
    lineDiscountsTotal: fromPaise(lineDiscountsPaise),
    allocatedInvoiceDiscount: fromPaise(allocatedDiscountTotalPaise),
    taxableSubtotal: fromPaise(netTaxableTotalPaise),
    cgstTotal: fromPaise(cgstTotalPaise),
    sgstTotal: fromPaise(sgstTotalPaise),
    igstTotal: fromPaise(igstTotalPaise),
    cessTotal: fromPaise(cessTotalPaise),
    totalGst: fromPaise(totalGstPaise),
  };
}

// ==========================================
// 4. TDS Calculator
// ==========================================

export interface TDSBreakdownResult {
  section: string | null;
  rate: number;
  tdsAmount: number;
  netReceivable: number;
  legalCircular: string | null;
}

export function calculateTDSBreakdown(
  taxableAmount: number,
  tdsConfig?: { section?: string | undefined; rate?: number | undefined } | undefined
): TDSBreakdownResult {
  if (!tdsConfig || !tdsConfig.section || tdsConfig.section === 'NONE') {
    return {
      section: null,
      rate: 0,
      tdsAmount: 0,
      netReceivable: taxableAmount,
      legalCircular: null,
    };
  }

  const sectionKey = tdsConfig.section;
  const baseKey = sectionKey.split('_')[0] ?? sectionKey;
  const sectionMeta = TDS_SECTIONS[sectionKey] || TDS_SECTIONS[baseKey];
  const rate = typeof tdsConfig.rate === 'number' && Number.isFinite(tdsConfig.rate)
    ? tdsConfig.rate
    : (sectionMeta ? sectionMeta.defaultRate : 0);

  if (rate <= 0) {
    return {
      section: sectionKey,
      rate: 0,
      tdsAmount: 0,
      netReceivable: taxableAmount,
      legalCircular: sectionMeta ? sectionMeta.cbdTCircular : null,
    };
  }

  const taxablePaise = toPaise(taxableAmount);
  const tdsPaise = Math.round(taxablePaise * (rate / 100));
  const tdsAmount = fromPaise(tdsPaise);
  const netReceivable = fromPaise(Math.max(0, taxablePaise - tdsPaise));

  return {
    section: sectionKey,
    rate,
    tdsAmount,
    netReceivable,
    legalCircular: sectionMeta ? sectionMeta.cbdTCircular : null,
  };
}

// ==========================================
// 5. Master Tax & Invoice Aggregation
// ==========================================

export type InvoiceTaxResult = TaxBreakdownResult & {
  breakdown: TaxBreakdownResult;
  lineItems: CalculatedLineItem[];
  line_items: CalculatedLineItem[];
  rules?: any;
};

export function calculateInvoiceTax(input: InvoiceTaxCalculationInput): InvoiceTaxResult {
  const rules = evaluateTaxRules(
    input.freelancer,
    input.client,
    input.supply_type,
    input.isReverseCharge,
    input.lutNumber,
    input.lutExpiryDate
  );

  let preTaxDiscountPaise = 0;
  let postTaxDiscountPaise = 0;
  let discountType = input.invoiceDiscount?.type || 'fixed';
  let discountScope = input.invoiceDiscount?.scope || 'before_tax';

  if (input.invoiceDiscount && input.invoiceDiscount.value > 0) {
    const discVal = Number(input.invoiceDiscount.value);
    const rawSubtotalPaise = input.items.reduce(
      (sum, it) => sum + Math.round(toPaise(Number(it.quantity || 0) * Number(it.rate || 0))),
      0
    );

    let calculatedDiscountPaise = 0;
    if (discountType === 'percentage') {
      calculatedDiscountPaise = Math.round(rawSubtotalPaise * (discVal / 100));
    } else {
      calculatedDiscountPaise = Math.round(toPaise(discVal));
    }

    if (discountScope === 'before_tax') {
      preTaxDiscountPaise = Math.min(rawSubtotalPaise, calculatedDiscountPaise);
    } else {
      postTaxDiscountPaise = calculatedDiscountPaise;
    }
  }

  const gstRes = calculateGSTBreakdown(
    input.items,
    rules.isInterstate,
    rules.isZeroRated,
    rules.isReverseCharge,
    preTaxDiscountPaise,
    rules.suppressesGst,
    rules.supplyType
  );

  const taxablePaise = toPaise(gstRes.taxableSubtotal);
  const totalGstPaise = toPaise(gstRes.totalGst);
  const totalDiscountPaise = toPaise(gstRes.lineDiscountsTotal + gstRes.allocatedInvoiceDiscount) + postTaxDiscountPaise;

  const rawGrandTotalPaise = taxablePaise + totalGstPaise - postTaxDiscountPaise;
  const grandTotalUnrounded = fromPaise(Math.max(0, rawGrandTotalPaise));
  const grandTotal = Math.round(grandTotalUnrounded);
  const roundOff = fromPaise(toPaise(grandTotal) - toPaise(grandTotalUnrounded));

  const tdsRes = calculateTDSBreakdown(gstRes.taxableSubtotal, input.tds);
  const tdsPaise = toPaise(tdsRes.tdsAmount);
  const netReceivablePaise = Math.max(0, toPaise(grandTotal) - tdsPaise);
  const netReceivable = fromPaise(netReceivablePaise);

  const currency = input.currency || 'INR';
  const exchangeRate = Number(input.exchangeRate || 1);
  const exchangeRateDate = input.exchangeRateDate || new Date().toISOString().substring(0, 10);

  const inrSubtotal = fromPaise(Math.round(toPaise(gstRes.subtotal) * exchangeRate));
  const inrGrandTotal = fromPaise(Math.round(toPaise(grandTotal) * exchangeRate));
  const inrNetReceivable = fromPaise(Math.round(netReceivablePaise * exchangeRate));

  const breakdown: TaxBreakdownResult = {
    subtotal: gstRes.subtotal,
    discount_amount: fromPaise(totalDiscountPaise),
    discount_type: discountType,
    discount_scope: discountScope,
    post_tax_discount: fromPaise(postTaxDiscountPaise),
    taxable_amount: gstRes.taxableSubtotal,
    cgst: gstRes.cgstTotal,
    sgst: gstRes.sgstTotal,
    igst: gstRes.igstTotal,
    cess: gstRes.cessTotal,
    total_gst: gstRes.totalGst,
    grand_total_unrounded: grandTotalUnrounded,
    round_off: roundOff,
    grand_total: grandTotal,

    tds_section: tdsRes.section,
    tds_rate: tdsRes.rate,
    tds_amount: tdsRes.tdsAmount,
    net_receivable: netReceivable,

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
    inr_net_receivable: inrNetReceivable,

    declarations: rules.declarations,
    warnings: rules.warnings,
  };

  return {
    ...breakdown,
    breakdown,
    lineItems: gstRes.lineItems,
    line_items: gstRes.lineItems,
    rules,
  };
}

export function calculateInvoiceWithTax(
  items: InvoiceItemTaxInput[],
  freelancer: FreelancerTaxProfile,
  client: ClientTaxProfile,
  options?: {
    discount?: { type: 'percentage' | 'fixed'; value: number; scope: 'before_tax' | 'after_tax' };
    tds?: { section: string; rate: number };
    isReverseCharge?: boolean;
    currency?: any;
    exchangeRate?: number;
    lutNumber?: string | null;
  }
) {
  return calculateInvoiceTax({
    freelancer,
    client,
    items,
    invoiceDiscount: options?.discount,
    tds: options?.tds,
    isReverseCharge: options?.isReverseCharge,
    currency: options?.currency,
    exchangeRate: options?.exchangeRate,
    lutNumber: options?.lutNumber,
  });
}

// ==========================================
// 6. Tax Invariant Validation Guard
// ==========================================

export function validateTaxCalculation(
  inputOrBreakdown: InvoiceTaxCalculationInput | TaxBreakdownResult,
  lineItems?: CalculatedLineItem[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if ('freelancer' in inputOrBreakdown) {
    const input = inputOrBreakdown as InvoiceTaxCalculationInput;
    if (!input.items || input.items.length === 0) {
      errors.push('Invoice must contain at least one line item');
    }
    (input.items || []).forEach((it: InvoiceItemTaxInput, idx: number) => {
      if (!Number.isFinite(it.quantity) || it.quantity < 0) {
        errors.push(`Line item #${idx + 1}: quantity must be non-negative`);
      }
      if (!Number.isFinite(it.rate) || it.rate < 0) {
        errors.push(`Line item #${idx + 1}: rate must be non-negative`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  const breakdown = inputOrBreakdown as TaxBreakdownResult;
  const items = lineItems || (breakdown as any).lineItems || (breakdown as any).line_items || [];
  const headerTaxablePaise = toPaise(breakdown.taxable_amount);

  const lineSumPaise = items.reduce((acc: number, it: any) => acc + toPaise(it.taxable_amount), 0);
  if (items.length > 0 && Math.abs(lineSumPaise - headerTaxablePaise) > 1) {
    errors.push(`Taxable subtotal mismatch: lines sum to ₹${fromPaise(lineSumPaise)} but header reports ₹${breakdown.taxable_amount}`);
  }

  if (breakdown.place_of_supply === 'intra_state') {
    if (breakdown.cgst !== breakdown.sgst) {
      errors.push(`Intra-state GST asymmetry: CGST (₹${breakdown.cgst}) must equal SGST (₹${breakdown.sgst})`);
    }
    if (breakdown.igst > 0) {
      errors.push(`Intra-state supply cannot levy IGST (found ₹${breakdown.igst})`);
    }
  }

  if (breakdown.place_of_supply === 'inter_state' || breakdown.place_of_supply === 'export' || breakdown.place_of_supply === 'sez') {
    if (breakdown.cgst > 0 || breakdown.sgst > 0) {
      errors.push(`Inter-state/Export supply cannot levy CGST or SGST`);
    }
  }

  const postTaxDiscountPaise = toPaise(breakdown.post_tax_discount || 0);
  const calculatedGrandUnroundedPaise = Math.max(0, headerTaxablePaise + toPaise(breakdown.total_gst) - postTaxDiscountPaise);
  const diffGrand = Math.abs(calculatedGrandUnroundedPaise - toPaise(breakdown.grand_total_unrounded));
  if (diffGrand > 2) {
    errors.push(`Grand total arithmetic divergence: expected ₹${fromPaise(calculatedGrandUnroundedPaise)}, got ₹${breakdown.grand_total_unrounded}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ==========================================
// 7. GSTR-1 Aggregation Repository (Inlined)
// ==========================================

function computeFinancialYearLabel(startDate: string): string {
  const startYear = parseInt(startDate.substring(0, 4), 10) || 2026;
  const startMonth = parseInt(startDate.substring(5, 7), 10) || 4;
  const fyStart = startMonth >= 4 ? startYear : startYear - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2);
  return `FY ${fyStart}-${fyEnd}`;
}

export class TaxRepository {
  static async logTaxAuditEvent(
    workspaceId: string,
    invoiceId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    try {
      await (supabase as any).from('tax_audit_logs').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        event_type: eventType,
        payload,
        performed_by: userId || null,
      });
    } catch {
      // Safely ignore audit log insert failures
    }
  }

  static async getGSTR1Summary(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<GSTR1Summary> {
    const fyLabel = computeFinancialYearLabel(startDate);

    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const allInvoices: any[] = [];

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await (supabase.from('invoices') as any)
        .select('id, taxable_amount, subtotal, cgst, sgst, igst, cess_amount, supply_type, client_state, client_gstin')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('id', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Database error aggregating GSTR-1 summary: ${error.message}`);
      }

      if (data && data.length > 0) {
        allInvoices.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (!allInvoices || allInvoices.length === 0) {
      return {
        period: fyLabel,
        totalOutwardSupplies: 0,
        totalTaxableValue: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        totalCess: 0,
        totalTax: 0,
        b2bInvoicesCount: 0,
        b2cInvoicesCount: 0,
        exportInvoicesCount: 0,
        nilExemptCount: 0,
        total_b2b_invoices: 0,
        total_b2c_invoices: 0,
        total_export_invoices: 0,
        taxable_value: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        cess_amount: 0,
        total_tax: 0,
      };
    }

    let totalOutwardPaise = 0;
    let totalTaxablePaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;
    let totalCessPaise = 0;
    let b2bCount = 0;
    let b2cCount = 0;
    let exportCount = 0;
    let nilCount = 0;

    for (const inv of allInvoices) {
      const taxable = toPaise(Number(inv.taxable_amount ?? inv.subtotal ?? 0));
      const cgst = toPaise(Number(inv.cgst ?? 0));
      const sgst = toPaise(Number(inv.sgst ?? 0));
      const igst = toPaise(Number(inv.igst ?? 0));
      const cess = toPaise(Number(inv.cess_amount ?? 0));
      const invoiceVal = taxable + cgst + sgst + igst + cess;

      totalOutwardPaise += invoiceVal;
      totalTaxablePaise += taxable;
      totalCGSTPaise += cgst;
      totalSGSTPaise += sgst;
      totalIGSTPaise += igst;
      totalCessPaise += cess;

      const hasGstin = Boolean(inv.client_gstin && inv.client_gstin.trim().length >= 15);
      const isExp = inv.supply_type?.includes('zero_rated') || inv.supply_type === 'export';
      const isNil = inv.supply_type === 'nil_rated' || inv.supply_type === 'exempt';

      if (isExp) exportCount++;
      else if (isNil) nilCount++;
      else if (hasGstin) b2bCount++;
      else b2cCount++;
    }

    const totalTaxPaise = totalCGSTPaise + totalSGSTPaise + totalIGSTPaise + totalCessPaise;

    const outVal = fromPaise(totalOutwardPaise);
    const taxVal = fromPaise(totalTaxablePaise);
    const cgstVal = fromPaise(totalCGSTPaise);
    const sgstVal = fromPaise(totalSGSTPaise);
    const igstVal = fromPaise(totalIGSTPaise);
    const cessVal = fromPaise(totalCessPaise);
    const totalTaxVal = fromPaise(totalTaxPaise);

    return {
      period: fyLabel,
      totalOutwardSupplies: outVal,
      totalTaxableValue: taxVal,
      totalCGST: cgstVal,
      totalSGST: sgstVal,
      totalIGST: igstVal,
      totalCess: cessVal,
      totalTax: totalTaxVal,
      b2bInvoicesCount: b2bCount,
      b2cInvoicesCount: b2cCount,
      exportInvoicesCount: exportCount,
      nilExemptCount: nilCount,
      total_b2b_invoices: b2bCount,
      total_b2c_invoices: b2cCount,
      total_export_invoices: exportCount,
      taxable_value: taxVal,
      cgst_amount: cgstVal,
      sgst_amount: sgstVal,
      igst_amount: igstVal,
      cess_amount: cessVal,
      total_tax: totalTaxVal,
    };
  }
}
