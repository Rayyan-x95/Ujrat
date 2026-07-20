import { describe, it, expect, vi, beforeEach } from 'vitest';
import { determineGSTType, calculateGST } from '@/features/invoices/utils/TaxEngine';
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
    verifyPayment: vi.fn(),
  },
}));

vi.mock('@/features/auth/services/LoggingService', () => ({
  LoggingService: {
    logActivity: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../services/NotificationService', () => ({
  NotificationService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, data: { logId: 'log-123', delivered: true } }),
  },
}));

describe('Sprint 2: Financial System Hardening Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TaxEngine GST Determination', () => {
    it('should determine zero-rated if freelancer is not GST registered', () => {
      const freelancer = { is_gst_registered: false, state: 'Karnataka', gstin: '' };
      const client = { state: 'Karnataka', gstin: '29AAAAA1111A1Z1' };
      const result = determineGSTType(freelancer, client);
      expect(result.isZeroRated).toBe(true);
      expect(result.isInterstate).toBe(false);
    });

    it('should determine intrastate (CGST + SGST) if states match and registered', () => {
      const freelancer = { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' };
      const client = { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' };
      const result = determineGSTType(freelancer, client);
      expect(result.isZeroRated).toBe(false);
      expect(result.isInterstate).toBe(false);
    });

    it('should determine interstate (IGST) if states differ and registered', () => {
      const freelancer = { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' };
      const client = { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' };
      const result = determineGSTType(freelancer, client);
      expect(result.isZeroRated).toBe(false);
      expect(result.isInterstate).toBe(true);
    });

    it('should fall back to GSTIN state codes if state name is missing', () => {
      const freelancer = { is_gst_registered: true, state: null, gstin: '29AAAAA1111A1Z1' };
      const client = { state: null, gstin: '27BBBBB2222B1Z2' };
      const result = determineGSTType(freelancer, client);
      expect(result.isInterstate).toBe(true);
      expect(result.isZeroRated).toBe(false);
    });
  });

  describe('TaxEngine Calculation Math', () => {
    it('should compute correct splits for Intrastate (CGST + SGST)', () => {
      const freelancer = { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' };
      const client = { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' };
      const type = determineGSTType(freelancer, client);
      const tax = calculateGST(10000, 18, type.isInterstate, type.isZeroRated);

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(900);
      expect(tax.sgst).toBe(900);
      expect(tax.igst).toBe(0);
      expect(tax.total).toBe(11800);
    });

    it('should compute correct splits for Interstate (IGST)', () => {
      const freelancer = { is_gst_registered: true, state: 'Karnataka', gstin: '29AAAAA1111A1Z1' };
      const client = { state: 'Maharashtra', gstin: '27BBBBB2222B1Z2' };
      const type = determineGSTType(freelancer, client);
      const tax = calculateGST(10000, 18, type.isInterstate, type.isZeroRated);

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(0);
      expect(tax.sgst).toBe(0);
      expect(tax.igst).toBe(1800);
      expect(tax.total).toBe(11800);
    });

    it('should compute zero GST if zero-rated', () => {
      const freelancer = { is_gst_registered: false, state: 'Karnataka', gstin: '' };
      const client = { state: 'Karnataka', gstin: '29BBBBB2222B1Z2' };
      const type = determineGSTType(freelancer, client);
      const tax = calculateGST(10000, 18, type.isInterstate, type.isZeroRated);

      expect(tax.subtotal).toBe(10000);
      expect(tax.cgst).toBe(0);
      expect(tax.sgst).toBe(0);
      expect(tax.igst).toBe(0);
      expect(tax.total).toBe(10000);
    });
  });

  describe('Payment Verification Workflow', () => {
    it('should verify payment transition and update outstanding balance', async () => {
      // Mock getById returning the mock invoice
      const mockInvoice = {
        id: 'invoice-123',
        invoice_number: 'INV-001',
        total: 11800,
        status: 'pending_verification',
      };
      vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue(mockInvoice as any);
      vi.spyOn(InvoiceRepository, 'update').mockResolvedValue(mockInvoice as any);

      // Mock getAll returning the single payment
      const mockPayment = {
        id: 'payment-456',
        invoice_id: 'invoice-123',
        amount: 11800,
        status: 'pending',
        transaction_reference: 'UTR123456789',
      };
      vi.spyOn(PaymentRepository, 'getById').mockResolvedValue(mockPayment as any);
      vi.spyOn(PaymentRepository, 'getByInvoiceId').mockResolvedValue([
        { ...mockPayment, status: 'completed' },
      ] as any);

      vi.spyOn(PaymentRepository, 'verifyPayment').mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        verifier_id: 'verifier-789',
        verified_at: new Date().toISOString(),
      } as any);

      const result = await PaymentService.verifyPayment(
        'workspace-999',
        'verifier-789',
        'payment-456',
        'completed',
        'Manual UTR Match verified successfully'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
      }
      expect(InvoiceRepository.update).toHaveBeenCalledWith('workspace-999', 'invoice-123', {
        outstanding_balance: 0,
        status: 'paid',
      });
    });
  });
});
