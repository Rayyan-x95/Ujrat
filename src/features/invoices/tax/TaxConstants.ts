/**
 * Ujrat Tax Engine 2.0 - Tax Constants & Master Registries
 * Official GST State Codes, TDS Sections, HSN/SAC Presets, Currency Master
 */

import type { TDSSectionInfo, SupportedCurrency } from './TaxTypes';

// 40 Official & Legacy Indian State / Union Territory GST Codes
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu (Legacy)',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

// Reverse map: Normalized State Name -> GST State Code
export const STATE_NAME_TO_CODE: Record<string, string> = Object.entries(GST_STATE_CODES).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase().trim()] = code;
    return acc;
  },
  {} as Record<string, string>
);

// Standard GST Tax Rates under Indian GST Act
export const VALID_GST_RATES = [0, 3, 5, 12, 18, 28] as const;

// Default HSN / SAC Presets for Freelancers and Agencies
export const DEFAULT_SAC_CODES = [
  { code: '998311', description: 'IT Consulting & Management Services', gst_rate: 18 },
  { code: '998313', description: 'IT Infrastructure & Software Design Services', gst_rate: 18 },
  { code: '998314', description: 'Web & Mobile Application Development', gst_rate: 18 },
  { code: '998315', description: 'Software Development & Maintenance', gst_rate: 18 },
  { code: '998399', description: 'Other Professional & Technical Services', gst_rate: 18 },
  { code: '998413', description: 'Digital Marketing & Advertising Services', gst_rate: 18 },
  { code: '9983', description: 'General IT & Technical Services', gst_rate: 18 },
] as const;

// Official TDS Sections under Indian Income Tax Act 1961
export const TDS_SECTIONS: Record<string, TDSSectionInfo> = {
  'NONE': {
    code: 'NONE',
    name: 'No TDS Deducted',
    defaultRate: 0,
    description: 'No tax deduction at source applicable.',
    cbdTCircular: 'N/A',
  },
  '194J_10': {
    code: '194J_10',
    name: 'Section 194J (Professional Services - 10%)',
    defaultRate: 10,
    description: 'TDS on Professional/Technical Fees, Consultancy, Royalty (CBDT Circular 23/2017).',
    cbdTCircular: 'CBDT Circular No. 23/2017',
  },
  '194J_2': {
    code: '194J_2',
    name: 'Section 194J (Technical Services / Call Center - 2%)',
    defaultRate: 2,
    description: 'TDS on Technical Services or Call Center Operations.',
    cbdTCircular: 'Finance Act 2020 Amendment',
  },
  '194C_1': {
    code: '194C_1',
    name: 'Section 194C (Contractors - Individual/HUF - 1%)',
    defaultRate: 1,
    description: 'TDS on Payments to Individual Contractor / Freelancer.',
    cbdTCircular: 'Section 194C(1)',
  },
  '194C_2': {
    code: '194C_2',
    name: 'Section 194C (Contractors - Companies/Firms - 2%)',
    defaultRate: 2,
    description: 'TDS on Payments to Corporate Contractors.',
    cbdTCircular: 'Section 194C(2)',
  },
  '194H_5': {
    code: '194H_5',
    name: 'Section 194H (Commission / Brokerage - 5%)',
    defaultRate: 5,
    description: 'TDS on Commission or Brokerage Services.',
    cbdTCircular: 'Section 194H',
  },
  '194M_5': {
    code: '194M_5',
    name: 'Section 194M (Payment by Individual/HUF - 5%)',
    defaultRate: 5,
    description: 'TDS on Professional Fees by Non-Audit Individuals (Exceeding Rs 50 Lakhs).',
    cbdTCircular: 'Section 194M',
  },
  '194O_1': {
    code: '194O_1',
    name: 'Section 194O (E-Commerce Operator - 1%)',
    defaultRate: 1,
    description: 'TDS by E-Commerce Operators on Sale of Services.',
    cbdTCircular: 'Finance Act 2020',
  },
};

// Supported Currencies and Baseline Exchange Rates (INR equivalent for 1 Foreign Unit)
export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, { symbol: string; defaultInrRate: number; name: string }> = {
  INR: { symbol: '₹', defaultInrRate: 1.0, name: 'Indian Rupee' },
  USD: { symbol: '$', defaultInrRate: 83.50, name: 'United States Dollar' },
  EUR: { symbol: '€', defaultInrRate: 90.20, name: 'Euro' },
  GBP: { symbol: '£', defaultInrRate: 106.00, name: 'British Pound' },
  AED: { symbol: 'AED ', defaultInrRate: 22.75, name: 'UAE Dirham' },
  SGD: { symbol: 'S$', defaultInrRate: 62.10, name: 'Singapore Dollar' },
  JPY: { symbol: '¥', defaultInrRate: 0.55, name: 'Japanese Yen' },
};
