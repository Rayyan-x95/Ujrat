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
  const code = (sectionCode || 'NONE').trim();
  const fallback = {
    code: 'NONE',
    name: 'No TDS Deducted',
    defaultRate: 0,
    description: 'No tax deduction at source applicable.',
    cbdTCircular: 'N/A',
  };

  const sectionKey = TDS_SECTIONS[code] ? code : 'NONE';
  const sectionInfo = TDS_SECTIONS[sectionKey] || TDS_SECTIONS['NONE'] || fallback;

  let rate = sectionInfo.defaultRate;
  // Statutory ceiling: custom rate must be non-negative, finite, and not exceed 30% (max Indian withholding rate)
  if (customRate !== undefined && typeof customRate === 'number' && Number.isFinite(customRate) && customRate >= 0 && customRate <= Math.max(30, sectionInfo.defaultRate)) {
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
