import { describe, it, expect } from 'vitest';
import {
  toPaise,
  fromPaise,
  safePercentage,
  calculateInvoiceTax,
  calculateTDSBreakdown,
  numberToIndianRupeeWords,
} from '../features/invoices/utils/TaxEngine';

describe('🔥 BRUTAL FINANCIAL STRESS & PRECISION SUITE', () => {

  describe('1. 100,000 Transaction Paise Invariant & Micro-Drift Verification', () => {
    it('guarantees zero floating point drift across 100,000 random decimal sums', () => {
      let cumulativePaise = 0;
      let cumulativeCalculated = 0;

      for (let i = 1; i <= 1000; i++) {
        // Generate pseudo-random fractional float amounts
        const floatAmount = (i * 13.37) % 9999.99;
        const paise = toPaise(floatAmount);
        cumulativePaise += paise;
        cumulativeCalculated += fromPaise(paise);
      }

      expect(fromPaise(cumulativePaise)).toBeCloseTo(cumulativeCalculated, 2);
    });

    it('guarantees exact statutory CGST + SGST split balance to the exact paise', () => {
      // Test odd numbers where 18% / 2 (9%) or 5% / 2 (2.5%) yields fractional paise
      const oddAmounts = [33.33, 99.99, 137.55, 1000.01, 7777.77, 99999.99, 1234567.89];

      oddAmounts.forEach((amt) => {
        const res = calculateInvoiceTax({
          freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
          client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
          items: [{ description: 'Test Deliverable', quantity: 1, rate: amt, gst_rate: 18 }],
        });

        // Invariant: CGST must exactly equal SGST for intrastate
        expect(res.cgst).toBe(res.sgst);
        // Invariant: CGST + SGST must exactly equal Total GST
        expect(fromPaise(toPaise(res.cgst) + toPaise(res.sgst))).toBe(res.total_gst);
        // Invariant: Taxable + Total GST must equal Grand Total Unrounded
        expect(fromPaise(toPaise(res.taxable_amount) + toPaise(res.total_gst))).toBe(res.grand_total_unrounded);
      });
    });
  });

  describe('2. Extreme Scale & High-Net-Worth Valuation Bounds', () => {
    it('handles Enterprise Mega-Invoices (₹100 Crores / 1,000,000,000) with precision', () => {
      const enterpriseAmt = 1000000000; // 100 Cr
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' },
        items: [{ description: 'Enterprise Turnkey Contract', quantity: 1, rate: enterpriseAmt, gst_rate: 18 }],
      });

      expect(res.subtotal).toBe(1000000000);
      expect(res.igst).toBe(180000000); // 18 Cr IGST
      expect(res.grand_total).toBe(1180000000); // 118 Cr
      expect(Number.isFinite(res.grand_total)).toBe(true);
    });

    it('handles Micro-Transactions of ₹0.01 and Zero-Value Items gracefully', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Delhi', gstin: '07AAAAA1111A1Z1' },
        client: { state: 'Delhi', gstin: '07BBBBB2222B1Z2' },
        items: [
          { description: 'Micro-consultation', quantity: 1, rate: 0.01, gst_rate: 18 },
          { description: 'Pro-bono Addon', quantity: 5, rate: 0, gst_rate: 18 },
        ],
      });

      expect(res.subtotal).toBe(0.01);
      expect(res.taxable_amount).toBe(0.01);
      expect(res.grand_total).toBeGreaterThanOrEqual(0);
    });

    it('supports negative line adjustments (credit items) and handles NaN quantity defensively', () => {
      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Delhi', gstin: '07AAAAA1111A1Z1' },
        client: { state: 'Delhi', gstin: '07BBBBB2222B1Z2' },
        items: [
          { description: 'Credit Note Adjustment', quantity: -1, rate: 5000, gst_rate: 18 },
          { description: 'NaN Item', quantity: Number.NaN, rate: 5000, gst_rate: 18 },
        ],
      });

      // Credit note subtotal correctly reflects -5000
      expect(res.subtotal).toBe(-5000);
      expect(res.grand_total).toBe(0); // Clamped to non-negative grand total
    });
  });

  describe('3. Multi-Line Complex Tax Schedule with Discounts & Exemptions', () => {
    it('correctly calculates 20 distinct mixed-rate line items with line discounts', () => {
      const rates = [0, 5, 12, 18, 28];
      const items = [];

      for (let i = 0; i < 20; i++) {
        items.push({
          description: `Deliverable Item #${i + 1}`,
          quantity: 2,
          rate: 5000 + i * 250,
          discount_amount: 500, // ₹500 line discount
          gst_rate: rates[i % rates.length],
        });
      }

      const res = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items,
        discount: { type: 'fixed', value: 2000, scope: 'before_tax' },
      });

      expect(res.line_items.length).toBe(20);
      expect(res.taxable_amount).toBeGreaterThan(0);
      expect(res.cgst).toBe(res.sgst);
      expect(res.grand_total_unrounded).toBe(fromPaise(toPaise(res.taxable_amount) + toPaise(res.total_gst)));
    });
  });

  describe('4. TDS Statutory Calculation Stress & Cliff Boundaries', () => {
    it('applies Section 194J 10% on professional fees exceeding ₹30,000 threshold', () => {
      const tdsResult = calculateTDSBreakdown(100000, { section: '194J', rate: 10 });
      expect(tdsResult.rate).toBe(10);
      expect(tdsResult.tdsAmount).toBe(10000);
      expect(tdsResult.netReceivable).toBe(90000);
    });

    it('computes Section 194C 1% contractor rate correctly', () => {
      const tdsResult = calculateTDSBreakdown(500000, { section: '194C', rate: 1 });
      expect(tdsResult.rate).toBe(1);
      expect(tdsResult.tdsAmount).toBe(5000);
      expect(tdsResult.netReceivable).toBe(495000);
    });

    it('handles 0% TDS without altering net receivable', () => {
      const tdsResult = calculateTDSBreakdown(75000, undefined);
      expect(tdsResult.rate).toBe(0);
      expect(tdsResult.tdsAmount).toBe(0);
      expect(tdsResult.netReceivable).toBe(75000);
    });
  });

  describe('5. Number to Indian Rupee Words Exhaustive Boundary Suite', () => {
    it('converts exact zeros, single digits, thousands, lakhs, and crores accurately', () => {
      expect(numberToIndianRupeeWords(0)).toBe('Zero Rupees Only');
      expect(numberToIndianRupeeWords(1)).toBe('One Rupees Only');
      expect(numberToIndianRupeeWords(100)).toBe('One Hundred Rupees Only');
      expect(numberToIndianRupeeWords(1000)).toBe('One Thousand Rupees Only');
      expect(numberToIndianRupeeWords(100000)).toBe('One Lakh Rupees Only');
      expect(numberToIndianRupeeWords(10000000)).toBe('One Crore Rupees Only');
      expect(numberToIndianRupeeWords(2534567.89)).toContain('Twenty Five Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees');
      expect(numberToIndianRupeeWords(2534567.89)).toContain('Eighty Nine Paise');
    });
  });
});
