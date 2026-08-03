/**
 * Ujrat Tax Engine 2.0 - Core Domain Types & Enums
 * Indian GST • TDS • International Tax • RCM • Compliance
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
  };
  tds?: {
    section: string;
    rate: number; // percentage, e.g. 10 for 10%
  };
  isReverseCharge?: boolean;
  currency?: SupportedCurrency;
  exchangeRate?: number; // 1 USD to INR (e.g. 83.50)
  exchangeRateDate?: string;
  supply_type?: SupplyType;
  lutNumber?: string | null | undefined;
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

  // Statutory Declarations & Warning badges
  declarations: string[];
  warnings: string[];
  line_items: CalculatedLineItem[];
}

export interface GSTR1Summary {
  financial_year: string;
  month_or_quarter: string;
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
