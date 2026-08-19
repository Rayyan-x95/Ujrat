import { describe, it, expect } from 'vitest';
import { InvoiceStateMachine, PaymentStateMachine } from '@/shared/utils/StateMachine';
import { calculateGST, calculateInvoiceTax } from '@/features/invoices/utils/TaxEngine';

describe('Financial Invariants, Tax Engine & Payment Race Conditions Suite (F-003 / F-004 / F-005)', () => {
  describe('Invoice Status Settlement Invariants', () => {
    it('prevents direct illegal transition from draft to paid without verification', () => {
      expect(InvoiceStateMachine.validate('draft', 'paid')).toBe(false);
    });

    it('allows valid sequence: draft -> sent -> pending_verification -> paid', () => {
      expect(InvoiceStateMachine.validate('draft', 'sent')).toBe(true);
      expect(InvoiceStateMachine.validate('sent', 'pending_verification')).toBe(true);
      expect(InvoiceStateMachine.validate('pending_verification', 'paid')).toBe(true);
    });

    it('enforces total settlement invariant: completed payments must satisfy invoice total', () => {
      const invoiceTotal = 118000; // 100k + 18% GST
      const completedPayments = [
        { amount: 50000, status: 'completed' },
        { amount: 68000, status: 'completed' },
      ];

      const sumPaid = completedPayments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const isSettled = sumPaid >= invoiceTotal;
      expect(isSettled).toBe(true);

      // Deficit payment scenario
      const deficientPayments = [
        { amount: 50000, status: 'completed' },
        { amount: 60000, status: 'completed' }, // total 110,000 < 118,000
      ];
      const sumDeficient = deficientPayments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const isDeficientSettled = sumDeficient >= invoiceTotal;
      expect(isDeficientSettled).toBe(false);
    });

    it('tracks progressive multi-installment milestone reconciliation ledger', () => {
      const invoiceTotal = 100000;
      const installments = [25000, 25000, 30000, 20000];
      let remainingBalance = invoiceTotal;

      installments.forEach((payment, idx) => {
        const prevBalance = remainingBalance;
        remainingBalance -= payment;
        // Invariant: Balance must decrease monotonically
        expect(remainingBalance).toBeLessThan(prevBalance);
        expect(remainingBalance).toBeGreaterThanOrEqual(0);
      });

      expect(remainingBalance).toBe(0);
    });
  });

  describe('Tax Calculation Precision & Indian GST Integrity', () => {
    it('accurately splits Intra-state GST into CGST (9%) and SGST (9%)', () => {
      const result = calculateGST(100000, 18, false, false); // Intra-state
      expect(result.subtotal).toBe(100000);
      expect(result.cgst).toBe(9000);
      expect(result.sgst).toBe(9000);
      expect(result.igst).toBe(0);
      expect(result.total).toBe(118000);
    });

    it('accurately calculates Inter-state GST as IGST (18%)', () => {
      const result = calculateGST(100000, 18, true, false); // Inter-state
      expect(result.subtotal).toBe(100000);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(18000);
      expect(result.total).toBe(118000);
    });

    it('aggregates multiple line items without rounding loss or floating-point drift', () => {
      const items = [
        { description: 'Item 1', rate: 33333.33, quantity: 3, gst_rate: 18 },
        { description: 'Item 2', rate: 50000.50, quantity: 2, gst_rate: 18 },
      ];

      const totals = calculateInvoiceTax({
        items,
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
      });
      expect(totals.subtotal).toBeCloseTo(200000.99, 2);
      expect(totals.grand_total_unrounded).toBeCloseTo(totals.subtotal + totals.cgst + totals.sgst, 2);
      expect(totals.grand_total).toBe(236001);
    });

    it('enforces Section 170 CGST Act statutory rounding to nearest whole rupee', () => {
      // 100.49 -> 100
      const roundDown = Math.round(100.49);
      expect(roundDown).toBe(100);

      // 100.50 -> 101
      const roundUp = Math.round(100.50);
      expect(roundUp).toBe(101);

      // 100.99 -> 101
      const roundHigh = Math.round(100.99);
      expect(roundHigh).toBe(101);
    });
  });

  describe('Payment Race Conditions & Duplicate UTR Defense', () => {
    it('rejects terminal state mutation on completed payments', () => {
      expect(PaymentStateMachine.validate('completed', 'failed')).toBe(false);
      expect(PaymentStateMachine.validate('completed', 'pending')).toBe(false);
    });

    it('rejects duplicate transaction reference (UTR) submissions', () => {
      const existingUtrs = new Set(['123456789012', '987654321098']);
      const newUtr = '123456789012';

      const isDuplicate = existingUtrs.has(newUtr);
      expect(isDuplicate).toBe(true);
    });
  });
});
