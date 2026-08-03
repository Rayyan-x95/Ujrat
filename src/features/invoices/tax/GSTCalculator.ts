/**
 * Ujrat Tax Engine 2.0 - GST Calculator
 * Intra-state CGST+SGST Split • Inter-state IGST • CESS • Precise Paise Distribution
 */

import type { CalculatedLineItem, InvoiceItemTaxInput } from './TaxTypes';
import { toPaise, fromPaise } from './TaxUtilities';

export interface GSTCalculationResult {
  lineItems: CalculatedLineItem[];
  subtotal: number;
  lineDiscountsTotal: number;
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

  // First pass: calculate gross and line-level taxable
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
    // Pro-rata allocate invoice-level pre-tax discount with residual allocated to final line (Item 11)
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
      const totalGstLinePaise = Math.round(netLineTaxablePaise * (gstRate / 100));

      if (isInterstate) {
        igstRate = gstRate;
        igstPaise = totalGstLinePaise;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        // Alternating CGST/SGST odd-paise split across line items (Item 10)
        if (index % 2 === 0) {
          cgstPaise = Math.floor(totalGstLinePaise / 2);
          sgstPaise = totalGstLinePaise - cgstPaise;
        } else {
          sgstPaise = Math.floor(totalGstLinePaise / 2);
          cgstPaise = totalGstLinePaise - sgstPaise;
        }
      }
    }

    if (!isTaxExempt && cessRate > 0) {
      cessPaise = Math.round(netLineTaxablePaise * (cessRate / 100));
    }

    cgstTotalPaise += cgstPaise;
    sgstTotalPaise += sgstPaise;
    igstTotalPaise += igstPaise;
    cessTotalPaise += cessPaise;

    const totalLineGstPaise = cgstPaise + sgstPaise + igstPaise + cessPaise;
    const lineTotalPaise = netLineTaxablePaise + totalLineGstPaise;

    return {
      description: prep.item.description,
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
      hsn_code: prep.item.hsn_code || '9983',
      sac_code: prep.item.sac_code || prep.item.hsn_code || '9983',
      unit: prep.item.unit || 'NOS',
    };
  });

  return {
    lineItems,
    subtotal: fromPaise(subtotalPaise),
    lineDiscountsTotal: fromPaise(lineDiscountsPaise),
    taxableSubtotal: fromPaise(netTaxableTotalPaise),
    cgstTotal: fromPaise(cgstTotalPaise),
    sgstTotal: fromPaise(sgstTotalPaise),
    igstTotal: fromPaise(igstTotalPaise),
    cessTotal: fromPaise(cessTotalPaise),
    totalGst: fromPaise(cgstTotalPaise + sgstTotalPaise + igstTotalPaise + cessTotalPaise),
  };
}
