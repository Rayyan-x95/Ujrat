import { describe, it, expect } from 'vitest';
import {
  calculateInvoiceTax,
  validateTaxCalculation,
  determineGSTType,
  extractStateCode,
  extractPANFromGSTIN,
  validateGSTINFormat,
  numberToIndianRupeeWords,
  calculateTDS,
} from '../features/invoices/utils/TaxEngine';

describe('Tax Engine 2.0 - Comprehensive Statutory Compliance Suite', () => {

  describe('1. Place of Supply & Rule Evaluation', () => {
    it('should identify Intra-state supply when freelancer & client are in same state (Karnataka 29)', () => {
      const result = determineGSTType(
        { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' }
      );
      expect(result.isInterstate).toBe(false);
      expect(result.isZeroRated).toBe(false);
    });

    it('should identify Inter-state supply when freelancer is Karnataka (29) and client is Maharashtra (27)', () => {
      const result = determineGSTType(
        { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' }
      );
      expect(result.isInterstate).toBe(true);
      expect(result.isZeroRated).toBe(false);
    });

    it('should not mark Zero-Rated for non-GST registered freelancer on domestic supply', () => {
      const result = determineGSTType(
        { is_gst_registered: false, state: 'Karnataka', gstin: '' },
        { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' }
      );
      expect(result.isZeroRated).toBe(false);
    });

    it('should mark Zero-Rated LUT for foreign export client', () => {
      const result = determineGSTType(
        { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1', lut_number: 'AD290324000123L' },
        { state: 'Export', country: 'United States' }
      );
      expect(result.isInterstate).toBe(true);
      expect(result.isZeroRated).toBe(true);
    });
  });

  describe('2. Intrastate GST Splits (CGST + SGST)', () => {
    it('should split 18% GST into 9% CGST and 9% SGST with exact paise distribution', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Web Development', quantity: 1, rate: 10000, gst_rate: 18 }],
      });

      expect(res.subtotal).toBe(10000);
      expect(res.taxable_amount).toBe(10000);
      expect(res.cgst).toBe(900);
      expect(res.sgst).toBe(900);
      expect(res.igst).toBe(0);
      expect(res.total_gst).toBe(1800);
      expect(res.grand_total).toBe(11800);
    });

    it('should split 5% GST into 2.5% CGST and 2.5% SGST', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Delhi', gstin: '07AAAAA1111A1Z1' },
        client: { state: 'Delhi', gstin: '07BBBBB2222B1Z2' },
        items: [{ description: 'Print Media Services', quantity: 1, rate: 5000, gst_rate: 5 }],
      });

      expect(res.cgst).toBe(125);
      expect(res.sgst).toBe(125);
      expect(res.igst).toBe(0);
      expect(res.grand_total).toBe(5250);
    });
  });

  describe('3. Interstate GST Calculation (IGST)', () => {
    it('should compute 18% IGST for inter-state supply', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' },
        items: [{ description: 'UI/UX Design Services', quantity: 1, rate: 25000, gst_rate: 18 }],
      });

      expect(res.cgst).toBe(0);
      expect(res.sgst).toBe(0);
      expect(res.igst).toBe(4500);
      expect(res.grand_total).toBe(29500);
    });
  });

  describe('4. Export & LUT Handling', () => {
    it('should charge 0% GST under active LUT for foreign client', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1', lut_number: 'AD290324000123L' },
        client: { state: 'Export', country: 'USA' },
        items: [{ description: 'Cloud Consulting', quantity: 1, rate: 1000, gst_rate: 18 }],
        currency: 'USD',
        exchangeRate: 83.50,
      });

      expect(res.is_zero_rated).toBe(true);
      expect(res.cgst).toBe(0);
      expect(res.sgst).toBe(0);
      expect(res.igst).toBe(0);
      expect(res.grand_total).toBe(1000);
      expect(res.inr_grand_total).toBe(83500);
      expect(res.declarations).toContain('SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING (LUT NO: AD290324000123L) WITHOUT PAYMENT OF INTEGRATED TAX.');
    });

    it('should apply IGST when export is without LUT', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1', lut_number: null },
        client: { state: 'Export', country: 'UK' },
        items: [{ description: 'Software Development', quantity: 1, rate: 10000, gst_rate: 18 }],
      });

      expect(res.is_zero_rated).toBe(true);
      expect(res.igst).toBe(1800);
      expect(res.grand_total).toBe(11800);
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('5. Income Tax TDS (CBDT Circular No. 23/2017)', () => {
    it('should compute 10% TDS under 194J on Taxable Value (excluding GST)', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Software Architecture', quantity: 1, rate: 100000, gst_rate: 18 }],
        tds: { section: '194J_10', rate: 10 },
      });

      // Subtotal: 1,00,000 | Taxable: 1,00,000 | GST: 18,000 | Grand Total: 1,18,000
      // TDS (10% of Taxable 1,00,000) = 10,000
      // Net Receivable = 1,18,000 - 10,000 = 1,08,000
      expect(res.taxable_amount).toBe(100000);
      expect(res.total_gst).toBe(18000);
      expect(res.grand_total).toBe(118000);
      expect(res.tds_amount).toBe(10000);
      expect(res.net_receivable).toBe(108000);
    });

    it('should compute 1% TDS under 194C for individual contractors', () => {
      const tds = calculateTDS(50000, 59000, '194C_1', 1);
      expect(tds.tdsAmount).toBe(500);
      expect(tds.netReceivable).toBe(58500);
    });
  });

  describe('6. Composition Scheme & RCM', () => {
    it('should not charge GST on client invoice for Composition Scheme taxpayer', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1', tax_scheme: 'composition' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Catering Services', quantity: 1, rate: 20000, gst_rate: 5 }],
      });

      expect(res.is_zero_rated).toBe(false);
      expect(res.cgst).toBe(0);
      expect(res.sgst).toBe(0);
      expect(res.grand_total).toBe(20000);
      expect(res.declarations).toContain('COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES.');
    });

    it('should mark Reverse Charge Mechanism on invoice', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Legal Consultancy Services', quantity: 1, rate: 15000, gst_rate: 18 }],
        isReverseCharge: true,
      });

      expect(res.is_reverse_charge).toBe(true);
      expect(res.cgst).toBe(0);
      expect(res.sgst).toBe(0);
      expect(res.grand_total).toBe(15000);
      expect(res.declarations).toContain('TAX ON THIS INVOICE IS PAYABLE ON REVERSE CHARGE BASIS BY THE RECIPIENT OF SUPPLY.');
    });
  });

  describe('7. Pre-tax vs Post-tax Discounts', () => {
    it('should reduce taxable amount when discount is applied before tax', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Branding Project', quantity: 1, rate: 10000, gst_rate: 18 }],
        invoiceDiscount: { type: 'fixed', value: 1000, scope: 'before_tax' },
      });

      // Subtotal: 10,000 | Discount: 1,000 | Taxable: 9,000
      // CGST (9% of 9000): 810 | SGST: 810 | Grand Total: 10,620
      expect(res.taxable_amount).toBe(9000);
      expect(res.cgst).toBe(810);
      expect(res.sgst).toBe(810);
      expect(res.grand_total).toBe(10620);
    });
  });

  describe('8. GSTIN & PAN Utilities', () => {
    it('should validate 15-character Indian GSTIN and extract state name & PAN', () => {
      const val = validateGSTINFormat('29AAAAA1111A1Z1');
      expect(val.isValid).toBe(true);
      expect(val.stateName).toBe('Karnataka');
      expect(val.pan).toBe('AAAAA1111A');
    });

    it('should extract PAN from GSTIN correctly', () => {
      const pan = extractPANFromGSTIN('27BBBBB2222B1Z2');
      expect(pan).toBe('BBBBB2222B');
    });

    it('should extract state code from GSTIN or state name', () => {
      expect(extractStateCode('29AAAAA1111A1Z1')).toBe('29');
      expect(extractStateCode(null, 'Maharashtra')).toBe('27');
      expect(extractStateCode(null, 'Delhi')).toBe('07');
    });
  });

  describe('9. Indian Currency Number-to-Words', () => {
    it('should convert numerical amounts into Indian Rupee words', () => {
      expect(numberToIndianRupeeWords(11800)).toBe('Eleven Thousand Eight Hundred Rupees Only');
      expect(numberToIndianRupeeWords(100050)).toBe('One Lakh Fifty Rupees Only');
    });
  });

  describe('10. Validation Engine', () => {
    it('should flag errors for empty item lists', () => {
      const val = validateTaxCalculation({
        freelancer: { is_gst_registered: true, gstin: '29AAAAA1111A1Z1' },
        client: {},
        items: [],
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.length).toBeGreaterThan(0);
    });

    it('should flag errors for negative rates', () => {
      const val = validateTaxCalculation({
        freelancer: { is_gst_registered: true, gstin: '29AAAAA1111A1Z1' },
        client: {},
        items: [{ description: 'Invalid Item', quantity: 1, rate: -500, gst_rate: 18 }],
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.length).toBeGreaterThan(0);
    });
  });

});
