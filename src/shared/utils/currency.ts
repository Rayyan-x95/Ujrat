const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SGD: 'en-SG',
  JPY: 'ja-JP',
};

/**
 * Universal currency formatter with locale and precision support.
 * e.g., 150000, 'INR' -> ₹1,50,000.00
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const locale = CURRENCY_LOCALES[currency] || 'en-IN';
  const minDigits = currency === 'JPY' ? 0 : 2;
  const maxDigits = currency === 'JPY' ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(amount);
}

/**
 * Formats a numeric amount to Indian Rupee (INR) representation with appropriate comma groups.
 * e.g., 150000 -> ₹1,50,000.00
 */
export function formatINR(amount: number): string {
  return formatCurrency(amount, 'INR');
}

const SINGLE_DIGITS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEEN_DIGITS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const DOUBLE_DIGITS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

export function formatIndianNumberGroup(n: number): string {
  if (n === 0) return '';
  if (n < 10) return SINGLE_DIGITS[n] || '';
  if (n < 20) return TEEN_DIGITS[n - 10] || '';
  if (n < 100) return (DOUBLE_DIGITS[Math.floor(n / 10)] + ' ' + (SINGLE_DIGITS[n % 10] || '')).trim();
  if (n < 1000) return (SINGLE_DIGITS[Math.floor(n / 100)] + ' Hundred ' + formatIndianNumberGroup(n % 100)).trim();
  if (n < 100000) return (formatIndianNumberGroup(Math.floor(n / 1000)) + ' Thousand ' + formatIndianNumberGroup(n % 1000)).trim();
  if (n < 10000000) return (formatIndianNumberGroup(Math.floor(n / 100000)) + ' Lakh ' + formatIndianNumberGroup(n % 100000)).trim();
  return (formatIndianNumberGroup(Math.floor(n / 10000000)) + ' Crore ' + formatIndianNumberGroup(n % 10000000)).trim();
}


/**
 * Converts numbers to words with statutory Rupees/Paise placement for tax invoices.
 * e.g., 11800 -> "Eleven Thousand Eight Hundred Rupees Only"
 */
export function numberToIndianRupeeWords(num: number): string {
  if (isNaN(num)) return 'Zero Rupees Only';
  if (!Number.isFinite(num)) throw new RangeError('Amount must be a finite number');

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const totalPaise = Math.round(absNum * 100);
  const integerPart = Math.floor(totalPaise / 100);
  const decimalPart = totalPaise % 100;

  if (integerPart === 0 && decimalPart === 0) {
    return 'Zero Rupees Only';
  }

  let words = formatIndianNumberGroup(integerPart);
  if (!words) words = 'Zero';
  words += ' Rupees';

  if (decimalPart > 0) {
    const decStr = formatIndianNumberGroup(decimalPart) || 'Zero';
    words += ' and ' + decStr + ' Paise';
  }

  const result = words + ' Only';
  return isNegative ? `Minus ${result}` : result;
}
