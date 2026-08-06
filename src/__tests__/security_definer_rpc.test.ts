import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalService } from '@/features/portal/services/PortalService';
import { PortalRepository } from '@/features/portal/repositories/PortalRepository';

describe('SECURITY DEFINER Portal RPC Authorization Suite (F-001 / F-002 / F-007)', () => {
  const validToken = 'valid-token-32-chars-long-secure';
  const invalidToken = 'invalid-token';
  const validInvoiceId = 'inv-11111111-1111-4111-a111-111111111111';
  const foreignInvoiceId = 'inv-99999999-9999-4999-a999-999999999999';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Portal Access Authorization Boundary', () => {
    it('rejects empty or missing portal tokens', async () => {
      const result = await PortalService.getPortalData('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Portal token is required');
      }
    });

    it('rejects access when portal token returns no project (invalid or expired)', async () => {
      vi.spyOn(PortalRepository, 'getProject').mockResolvedValue(null);

      const result = await PortalService.getPortalData(invalidToken);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid security token or project not found');
      }
    });
  });

  describe('Cross-Project Payment Submission Isolation', () => {
    it('rejects payment submission for an invoice not associated with the verified portal project', async () => {
      vi.spyOn(PortalRepository, 'getInvoices').mockResolvedValue([
        {
          id: validInvoiceId,
          project_id: 'proj-1',
          workspace_id: 'ws-1',
          invoice_number: 'INV-001',
          invoice_date: '2026-01-01',
          due_date: '2026-01-31',
          subtotal: 10000,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total: 11800,
          status: 'sent',
          notes: '',
          items: [],
          created_at: '',
          updated_at: '',
        } as any,
      ]);

      const result = await PortalService.submitPayment(validToken, {
        invoiceId: foreignInvoiceId,
        amount: 11800,
        paymentMethod: 'UPI',
        transactionReference: '123456789012',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invoice not found');
      }
    });

    it('rejects payment when invoice is already settled and paid', async () => {
      vi.spyOn(PortalRepository, 'getInvoices').mockResolvedValue([
        {
          id: validInvoiceId,
          project_id: 'proj-1',
          workspace_id: 'ws-1',
          invoice_number: 'INV-001',
          status: 'paid',
          total: 10000,
        } as any,
      ]);

      const result = await PortalService.submitPayment(validToken, {
        invoiceId: validInvoiceId,
        amount: 10000,
        transactionReference: '123456789012',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid invoice transition');
      }
    });
  });

  describe('Digital Contract Signature Verification Gate', () => {
    it('blocks signature submission without confirmed OTP email verification', async () => {
      const result = await PortalService.signContract(validToken, {
        signatureName: 'John Doe',
        ipAddress: '192.168.1.1',
        emailVerified: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Identity verification required');
      }
    });

    it('blocks signature when contract is not found for the project', async () => {
      vi.spyOn(PortalRepository, 'getContract').mockResolvedValue(null);

      const result = await PortalService.signContract(validToken, {
        signatureName: 'John Doe',
        ipAddress: '192.168.1.1',
        emailVerified: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Contract details not found');
      }
    });
  });

  describe('Signed URL Deliverable Authorization', () => {
    it('rejects signed URL generation for deliverable files not belonging to the project', async () => {
      vi.spyOn(PortalRepository, 'getProject').mockResolvedValue({ id: 'proj-1' } as any);
      vi.spyOn(PortalRepository, 'getDeliverables').mockResolvedValue([
        { id: 'deliv-1', file_url: 'deliverables/proj-1/valid-asset.zip' } as any,
      ]);

      const result = await PortalService.getSignedDownloadUrl(validToken, 'deliverables/foreign-project/secret.pdf');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Access denied: Deliverable does not belong to this project');
      }
    });
  });
});
