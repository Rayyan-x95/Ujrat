/**
 * Formats a numeric amount to Indian Rupee (INR) representation with appropriate comma groups.
 * e.g., 150000 -> ₹1,50,000.00
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Converts a number to its word representation in the Indian Numbering System.
 * e.g., 150000 -> "Rupees One Lakh Fifty Thousand Only"
 */
export function numberToIndianWords(amount: number): string {
  const price = Math.floor(amount);
  if (price === 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const formatTens = (num: number): string => {
    if (num === 0) return '';
    if (num < 10) return singleDigits[num] || '';
    if (num < 20) return teenDigits[num - 10] || '';
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return (doubleDigits[tens] || '') + (ones > 0 ? ' ' + (singleDigits[ones] || '') : '');
  };

  const formatGroup = (num: number, label: string): string => {
    if (num === 0) return '';
    return formatTens(num) + ' ' + label + ' ';
  };

  let words = '';
  const crores = Math.floor(price / 10000000);
  const lakhs = Math.floor((price % 10000000) / 100000);
  const thousands = Math.floor((price % 100000) / 1000);
  const hundreds = Math.floor((price % 1000) / 100);
  const remaining = price % 100;

  words += formatGroup(crores, 'Crore');
  words += formatGroup(lakhs, 'Lakh');
  words += formatGroup(thousands, 'Thousand');
  words += formatGroup(hundreds, 'Hundred');
  
  if (remaining > 0) {
    words += formatTens(remaining);
  }

  return `Rupees ${words.trim()} Only`;
}
