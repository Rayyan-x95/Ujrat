/**
 * Ujrat Tax Engine 2.0 - Core Domain Types & Master Constants
 * Indian GST • TDS • International Tax • RCM • State Registries • Currencies
 */

export type TaxScheme = 'regular' | 'composition' | 'non_gst';

export type SupplyType =
  | 'taxable'
  | 'exempt'
  | 'nil_rated'
  | 'zero_rated_lut'
  | 'zero_rated_non_lut'
  | 'sez_with_tax'
  | 'sez_without_tax';

export type PlaceOfSupplyType = 'intra_state' | 'inter_state' | 'sez' | 'export' | 'import';

export type DiscountType = 'percentage' | 'fixed';

export type DiscountScope = 'before_tax' | 'after_tax';

export interface TDSSectionInfo {
  code: string;
  name: string;
  defaultRate: number;
  description: string;
  cbdTCircular: string;
}

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'JPY';

export interface FreelancerTaxProfile {
  is_gst_registered: boolean;
  gstin?: string | null | undefined;
  state?: string | null | undefined;
  tax_scheme?: TaxScheme | undefined;
  lut_number?: string | null | undefined;
  lut_expiry_date?: string | null | undefined;
}

export interface ClientTaxProfile {
  gstin?: string | null | undefined;
  state?: string | null | undefined;
  country?: string | null | undefined;
  is_sez?: boolean | undefined;
}

export interface InvoiceItemTaxInput {
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  cess_rate?: number;
  hsn_code?: string | null;
  sac_code?: string | null;
  unit?: string;
  discount_amount?: number;
}

export interface InvoiceTaxCalculationInput {
  freelancer: FreelancerTaxProfile;
  client: ClientTaxProfile;
  items: InvoiceItemTaxInput[];
  invoiceDiscount?: {
    type: DiscountType;
    value: number;
    scope: DiscountScope;
  } | undefined;
  tds?: {
    section: string;
    rate: number;
  } | undefined;
  isReverseCharge?: boolean | undefined;
  currency?: SupportedCurrency | undefined;
  exchangeRate?: number | undefined;
  exchangeRateDate?: string | undefined;
  supply_type?: SupplyType | undefined;
  lutNumber?: string | null | undefined;
  lutExpiryDate?: string | null | undefined;
}

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  rate: number;
  gross_amount: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_rate: number;
  cess_amount: number;
  line_total: number;
  hsn_code: string;
  sac_code: string;
  unit: string;
}

export interface TaxBreakdownResult {
  subtotal: number;
  discount_amount: number;
  discount_type: DiscountType;
  discount_scope: DiscountScope;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_gst: number;
  grand_total_unrounded: number;
  round_off: number;
  grand_total: number;
  
  // TDS details
  tds_section: string | null;
  tds_rate: number;
  tds_amount: number;
  net_receivable: number;
  
  // Tax determination & Place of Supply
  place_of_supply: PlaceOfSupplyType;
  is_interstate: boolean;
  is_zero_rated: boolean;
  is_reverse_charge: boolean;
  supply_type: SupplyType;
  tax_scheme: TaxScheme;
  
  // Location & Identity metadata
  freelancer_state: string;
  client_state: string;
  freelancer_gstin: string;
  client_gstin: string;

  // Currency & Foreign turnover
  currency: SupportedCurrency;
  exchange_rate: number;
  exchange_rate_date: string;
  inr_subtotal: number;
  inr_grand_total: number;
  inr_net_receivable?: number;

  // Statutory Declarations & Warning badges
  declarations: string[];
  warnings: string[];
}

export interface GSTR1B2BEntry {
  gstin: string;
  receiverName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: 'Y' | 'N';
  applicablePercent: number;
  invoiceType: 'Regular' | 'SEZ' | 'Deemed Export';
  eCommerceGSTIN?: string;
  rate: number;
  taxableValue: number;
  cessAmount: number;
}

export interface GSTR1Summary {
  period: string; // e.g. "2026-04" or "FY 2026-27"
  totalOutwardSupplies: number;
  totalTaxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalCess: number;
  totalTax: number;
  b2bInvoicesCount: number;
  b2cInvoicesCount: number;
  exportInvoicesCount: number;
  nilExemptCount: number;

  // Compatibility aliases
  total_b2b_invoices: number;
  total_b2c_invoices: number;
  total_export_invoices: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
}

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

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const TDS_SECTIONS: Record<string, TDSSectionInfo> = {
  '194J': {
    code: '194J',
    name: 'Fees for Professional or Technical Services',
    defaultRate: 10,
    description: '10% for professional services (architecture, design, engineering, legal, consulting). 2% for technical software support.',
    cbdTCircular: 'CBDT Circular No. 3/2020 & Section 194J of Income Tax Act 1961',
  },
  '194J_TECH': {
    code: '194J_TECH',
    name: 'Fees for Technical Services (FTS)',
    defaultRate: 2,
    description: '2% for pure technical services and call centre operations.',
    cbdTCircular: 'Finance Act 2020 amendment to Section 194J(1)',
  },
  '194C': {
    code: '194C',
    name: 'Payments to Contractors & Sub-contractors',
    defaultRate: 1, // 1% individual / HUF, 2% company
    description: '1% for individuals/HUFs, 2% for corporate entities on contract work.',
    cbdTCircular: 'Section 194C of Income Tax Act 1961',
  },
  '194H': {
    code: '194H',
    name: 'Commission or Brokerage',
    defaultRate: 5,
    description: '5% on commission/brokerage payments above ₹15,000 threshold.',
    cbdTCircular: 'Section 194H of Income Tax Act 1961',
  },
  '194Q': {
    code: '194Q',
    name: 'TDS on Purchase of Goods',
    defaultRate: 0.1,
    description: '0.1% on purchase of goods exceeding ₹50 Lakhs in aggregate FY.',
    cbdTCircular: 'Finance Act 2021 addition',
  },
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'JPY',
];
