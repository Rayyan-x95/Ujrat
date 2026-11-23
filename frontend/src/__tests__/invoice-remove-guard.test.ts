import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';
import { InvoiceRepository } from '@/features/invoices/repositories/InvoiceRepository';
import { LoggingService } from '@/features/auth/services/LoggingService';

const { pendingCount } = vi.hoisted(() => ({ pendingCount: vi.fn() }));

vi.mock('@/shared/lib/supabaseClient', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => pendingCount()),
  };
  return { supabase: { from: vi.fn(() => chain) } };
});

describe('InvoiceService.removeInvoice pending-claim guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue({
      id: 'inv-1',
      status: 'draft',
      project_id: 'proj-1',
      invoice_number: 'INV-1',
      total: 100,
      outstanding_balance: 100,
    } as any);
    vi.spyOn(LoggingService, 'logActivity').mockResolvedValue(undefined as any);
  });

  it('refuses to delete while a payment is awaiting verification', async () => {
    pendingCount.mockResolvedValue({ count: 1, error: null });
    const softDelete = vi.spyOn(InvoiceRepository, 'softDelete');

    const res = await InvoiceService.removeInvoice('ws-1', 'prof-1', 'inv-1');

    expect(res.success).toBe(false);
    expect((res as any).error.message).toMatch(/awaiting verification/);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('deletes a draft with no pending claim', async () => {
    pendingCount.mockResolvedValue({ count: 0, error: null });
    const softDelete = vi.spyOn(InvoiceRepository, 'softDelete').mockResolvedValue(undefined);

    const res = await InvoiceService.removeInvoice('ws-1', 'prof-1', 'inv-1');

    expect(res.success).toBe(true);
    expect(softDelete).toHaveBeenCalledWith('ws-1', 'inv-1');
  });
});
