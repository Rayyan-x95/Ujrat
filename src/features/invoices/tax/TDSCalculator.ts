/**
 * Ujrat Tax Engine 2.0 - TDS Calculator (Income Tax Act 1961)
 * CBDT Circular No. 23/2017 Compliance: TDS Calculated Strictly on Taxable Amount (Excl. GST)
 */

import { TDS_SECTIONS } from './TaxConstants';
import { toPaise, fromPaise } from './TaxUtilities';

export interface TDSCalculationResult {
  tdsSection: string;
  tdsRate: number; // percentage
  taxableAmount: number;
  tdsAmount: number; // deducted by recipient
  netReceivable: number; // Grand Total - TDS Amount
  cbdTCircular: string;
}

export function calculateTDS(
  taxableAmount: number,
  grandTotal: number,
  sectionCode?: string | null,
  customRate?: number
): TDSCalculationResult {
  const sectionInfo = (sectionCode ? TDS_SECTIONS[sectionCode.trim()] : undefined) || TDS_SECTIONS['NONE']!;
  const sectionKey = sectionInfo.code;

  let rate = sectionInfo.defaultRate;
  if (customRate !== undefined && customRate !== null) {
    if (typeof customRate !== 'number' || !Number.isFinite(customRate) || customRate < 0 || customRate > 30) {
      throw new Error(`Invalid custom TDS rate: ${customRate}. Rate must be a finite number between 0 and 30.`);
    }
    rate = customRate;
  }

  if (sectionKey === 'NONE' || rate <= 0 || taxableAmount <= 0) {
    return {
      tdsSection: 'NONE',
      tdsRate: 0,
      taxableAmount,
      tdsAmount: 0,
      netReceivable: grandTotal,
      cbdTCircular: sectionInfo.cbdTCircular,
    };
  }

  // CBDT Circular No. 23/2017: TDS is calculated on Gross Taxable Value (excluding GST)
  const taxablePaise = toPaise(taxableAmount);
  const tdsPaise = Math.round(taxablePaise * (rate / 100));
  const tdsAmount = fromPaise(tdsPaise);

  const grandTotalPaise = toPaise(grandTotal);
  const netReceivablePaise = Math.max(0, grandTotalPaise - tdsPaise);
  const netReceivable = fromPaise(netReceivablePaise);

  return {
    tdsSection: sectionKey,
    tdsRate: rate,
    taxableAmount,
    tdsAmount,
    netReceivable,
    cbdTCircular: sectionInfo.cbdTCircular,
  };
}
