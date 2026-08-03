/**
 * Ujrat Tax Engine 2.0 - Tax Formatter & Statutory Notice Generator
 * Format GSTR Summaries • Legal Declarations • Currency Display
 */

import type { TaxBreakdownResult, SupportedCurrency } from './TaxTypes';
import { SUPPORTED_CURRENCIES } from './TaxConstants';
import { numberToIndianRupeeWords } from './TaxUtilities';

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SGD: 'en-SG',
  JPY: 'ja-JP',
};

export function formatCurrencyAmount(
  amount: number,
  currency: SupportedCurrency = 'INR'
): string {
  const currencyInfo = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR;
  const locale = CURRENCY_LOCALES[currency] || 'en-IN';
  const minDigits = currency === 'JPY' ? 0 : 2;
  const maxDigits = currency === 'JPY' ? 0 : 2;

  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
  return `${currencyInfo.symbol}${formatted}`;
}

export function generateStatutoryDeclarations(result: TaxBreakdownResult): string[] {
  const declarations: string[] = [];

  if (result.tax_scheme === 'composition') {
    declarations.push('COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES.');
  } else if (result.tax_scheme === 'non_gst') {
    declarations.push('SUPPLIER IS NOT REGISTERED UNDER GST. NO TAX CHARGED.');
  }

  if (result.supply_type === 'zero_rated_lut') {
    declarations.push('SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING (LUT) WITHOUT PAYMENT OF INTEGRATED TAX.');
  } else if (result.supply_type === 'zero_rated_non_lut') {
    declarations.push('SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.');
  } else if (result.supply_type === 'sez_without_tax') {
    declarations.push('SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS WITHOUT PAYMENT OF INTEGRATED TAX UNDER LUT.');
  } else if (result.supply_type === 'sez_with_tax') {
    declarations.push('SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS ON PAYMENT OF INTEGRATED TAX.');
  }

  if (result.is_reverse_charge) {
    declarations.push('TAX ON THIS INVOICE IS PAYABLE ON REVERSE CHARGE BASIS BY THE RECIPIENT OF SUPPLY.');
  }

  return declarations;
}

export function formatAmountInWords(amount: number, currency: SupportedCurrency = 'INR'): string {
  if (currency === 'INR') {
    return numberToIndianRupeeWords(amount);
  }
  const currInfo = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR;
  return `${currInfo.name} ${amount.toFixed(2)} Only`;
}
