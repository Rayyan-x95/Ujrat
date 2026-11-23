import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateInvoiceTax } from '@/features/invoices/tax/InvoiceCalculator';
import { PaymentService } from '@/features/payments';
import { InvoiceRepository } from '@/features/invoices';
import { PaymentRepository } from '@/features/payments';

// Mock Repositories — paths must match the exact specifier used by PaymentService and InvoiceService
vi.mock('@/features/invoices/repositories/InvoiceRepository', () => ({
  InvoiceRepository: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/features/payments/repositories/PaymentRepository', () => ({
  PaymentRepository: {
    getAll: vi.fn(),
    getByInvoiceId: vi.fn(),
    getById: vi.fn(),
    submitPayment: vi.fn(),
    verifyPaymentTransactional: vi.fn(),
  },
}));

vi.mock('@/features/auth/services/LoggingService', () => ({
  LoggingService: {
    logActivity: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Sprint 2: Financial System Hardening Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TaxEngine GST Determination', () => {
    const item = { description: 'Service', quantity: 1, rate: 10000, gst_rate: 18 };

    it('should determine suppressesGst if freelancer is not GST registered', () => {
      const result = calculateInvoiceTax({
        freelancer: { is_gst_registered: false, state: 'Karnataka', gstin: '' },
        client: { state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        items: [item],
      });
      expect(result.rules.suppressesGst).toBe(true);
      expect(result.rules.isInterstate).toBe(false);
    });

    it('should determine intrastate (CGST + SGST) if states match and registered', () => {
      const result = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [item],
      });
      expect(result.rules.isZeroRated).toBe(false);
      expect(result.rules.isInterstate).toBe(false);
    });

    it('should determine interstate (IGST) if states differ and registered', () => {
      const result = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' },
        items: [item],
      });
      expect(result.rules.isZeroRated).toBe(false);
      expect(result.rules.isInterstate).toBe(true);
    });

    it('should fall back to GSTIN state codes if state name is missing', () => {
      const result = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: null, gstin: '29AAAAA1111A1Z1' },
        client: { state: null, gstin: '27BBBBB2222B1Z2' },
        items: [item],
      });
      expect(result.rules.isInterstate).toBe(true);
      expect(result.rules.isZeroRated).toBe(false);
    });
  });

  describe('TaxEngine Calculation Math', () => {
    it('should compute correct splits for Intrastate (CGST + SGST)', () => {
      const tax = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Service', quantity: 1, rate: 10000, gst_rate: 18 }],
      });

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(900);
      expect(tax.sgst).toBe(900);
      expect(tax.igst).toBe(0);
      expect(tax.grand_total).toBe(11800);
    });

    it('should compute correct splits for Interstate (IGST)', () => {
      const tax = calculateInvoiceTax({
        freelancer: { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' },
        client: { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' },
        items: [{ description: 'Service', quantity: 1, rate: 10000, gst_rate: 18 }],
      });

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(0);
      expect(tax.sgst).toBe(0);
      expect(tax.igst).toBe(1800);
      expect(tax.grand_total).toBe(11800);
    });

    it('should compute zero GST if zero-rated or suppressed', () => {
      const tax = calculateInvoiceTax({
        freelancer: { is_gst_registered: false, state: 'Karnataka', gstin: '' },
        client: { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' },
        items: [{ description: 'Service', quantity: 1, rate: 10000, gst_rate: 18 }],
      });

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(0);
      expect(tax.sgst).toBe(0);
      expect(tax.igst).toBe(0);
      expect(tax.grand_total).toBe(10000);
    });
  });

  describe('Payment Verification Workflow (atomic RPC)', () => {
    const mockInvoice = {
      id: 'invoice-123',
      invoice_number: 'INV-001',
      total: 11800,
      outstanding_balance: 11800,
      status: 'pending_verification',
      due_date: '2099-01-01',
    };
    const mockPayment = {
      id: 'payment-456',
      invoice_id: 'invoice-123',
      amount: 11800,
      status: 'pending',
      transaction_reference: '423156789012',
    };

    it('approves a covering payment through the RPC and returns the DB row', async () => {
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(mockPayment as any);
      vi.spyOn(PaymentRepository, 'getByInvoiceId').mockResolvedValue([mockPayment] as any);
      const rpcPayment = { ...mockPayment, status: 'completed', verifier_id: 'verifier-789', verified_at: '2026-11-23T00:00:00Z' };
      const rpcSpy = vi.spyOn(PaymentRepository, 'verifyPaymentTransactional').mockResolvedValue({
        payment: rpcPayment as any,
        invoice: { ...mockInvoice, status: 'paid', outstanding_balance: 0 } as any,
      });

      const result = await PaymentService.verifyPayment(
        'workspace-999', 'verifier-789', 'payment-456', 'completed', 'Manual UTR Match verified successfully'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // The returned payment is the RPC's DB row, not a fabricated object.
        expect(result.data).toEqual(rpcPayment);
      }
      expect(rpcSpy).toHaveBeenCalledWith(
        'workspace-999', 'verifier-789', 'invoice-123', 'payment-456', true, 'Manual UTR Match verified successfully'
      );
      // No JS compute-then-write: the invoice is never updated directly.
      expect(InvoiceRepository.update).not.toHaveBeenCalled();
    });

    it('approves a partial payment through the same RPC (partially_paid)', async () => {
      const partial = { ...mockPayment, amount: 5000 };
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(partial as any);
      vi.spyOn(PaymentRepository, 'getByInvoiceId').mockResolvedValue([partial] as any);
      const rpcSpy = vi.spyOn(PaymentRepository, 'verifyPaymentTransactional').mockResolvedValue({
        payment: { ...partial, status: 'completed' } as any,
        invoice: { ...mockInvoice, status: 'partially_paid', outstanding_balance: 6800 } as any,
      });

      const result = await PaymentService.verifyPayment('workspace-999', 'verifier-789', 'payment-456', 'completed');

      expect(result.success).toBe(true);
      expect(rpcSpy).toHaveBeenCalledWith('workspace-999', 'verifier-789', 'invoice-123', 'payment-456', true, undefined);
      expect(InvoiceRepository.update).not.toHaveBeenCalled();
    });

    it('rejects through the RPC with approve=false and returns the DB row', async () => {
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(mockPayment as any);
      const rpcPayment = { ...mockPayment, status: 'failed' };
      const rpcSpy = vi.spyOn(PaymentRepository, 'verifyPaymentTransactional').mockResolvedValue({
        payment: rpcPayment as any,
        invoice: { ...mockInvoice, status: 'sent', outstanding_balance: 11800 } as any,
      });

      const result = await PaymentService.verifyPayment(
        'workspace-999', 'verifier-789', 'payment-456', 'failed', 'UTR not found in bank statement'
      );

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe('failed');
      expect(rpcSpy).toHaveBeenCalledWith(
        'workspace-999', 'verifier-789', 'invoice-123', 'payment-456', false, 'UTR not found in bank statement'
      );
      expect(InvoiceRepository.update).not.toHaveBeenCalled();
    });

    it('refuses to re-verify a terminal payment before any write', async () => {
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue({ ...mockPayment, status: 'completed' } as any);
      const rpcSpy = vi.spyOn(PaymentRepository, 'verifyPaymentTransactional');

      const result = await PaymentService.verifyPayment('workspace-999', 'verifier-789', 'payment-456', 'completed');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('already been verified');
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it('blocks approval while another claim is pending (pending_verification included)', async () => {
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(mockPayment as any);
      vi.spyOn(PaymentRepository, 'getByInvoiceId').mockResolvedValue([
        mockPayment,
        { ...mockPayment, id: 'payment-other', status: 'pending_verification' },
      ] as any);
      const rpcSpy = vi.spyOn(PaymentRepository, 'verifyPaymentTransactional');

      const result = await PaymentService.verifyPayment('workspace-999', 'verifier-789', 'payment-456', 'completed');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('still pending verification');
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it('surfaces the RPC error instead of writing around it', async () => {
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(mockPayment as any);
      vi.spyOn(PaymentRepository, 'getByInvoiceId').mockResolvedValue([mockPayment] as any);
      vi.spyOn(PaymentRepository, 'verifyPaymentTransactional').mockRejectedValue(
        new Error('Payment amount exceeds outstanding invoice balance')
      );

      const result = await PaymentService.verifyPayment('workspace-999', 'verifier-789', 'payment-456', 'completed');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('exceeds outstanding');
      expect(InvoiceRepository.update).not.toHaveBeenCalled();
    });
  });
});
