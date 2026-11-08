import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';
import { InvoiceRepository } from '@/features/invoices/repositories/InvoiceRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { WorkspaceService } from '@/features/workspace/services/WorkspaceService';
import { LoggingService } from '@/features/auth/services/LoggingService';

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const MIGRATION_NAME = '20261108171853_update_invoice_draft_transactional.sql';
const ROOT = process.cwd();
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations', MIGRATION_NAME))
  ? path.join(ROOT, 'backend/supabase/migrations', MIGRATION_NAME)
  : path.resolve(ROOT, '../backend/supabase/migrations', MIGRATION_NAME);
const SQL = readFileSync(MIGRATION, 'utf8');

const input = {
  invoice_date: '2026-11-08',
  due_date: '2026-11-22',
  notes: null,
  items: [{ description: 'Design', quantity: 1, rate: 1000, gst_rate: 18 }],
};

describe('InvoiceService.editInvoiceDraft uses one atomic write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue({
      id: 'inv-1',
      status: 'draft',
      project_id: 'proj-1',
      invoice_number: 'INV-1',
      currency: 'INR',
      exchange_rate: 1,
    } as any);
    vi.spyOn(ProjectRepository, 'getById').mockResolvedValue({
      id: 'proj-1',
      client_id: 'cli-1',
      clients: { id: 'cli-1', name: 'Acme', state: 'KA', gstin: null },
    } as any);
    vi.spyOn(WorkspaceService, 'getSettings').mockResolvedValue({
      success: true,
      data: {
        is_gst_registered: true,
        state: 'KA',
        gstin: '29AAAAA1111A1Z1',
        tax_scheme: 'regular',
        lut_number: null,
      },
    } as any);
    vi.spyOn(LoggingService, 'logActivity').mockResolvedValue(undefined as any);
  });

  it('updates header and items through the transactional RPC', async () => {
    const tx = vi.spyOn(InvoiceRepository, 'updateDraftTransactional').mockResolvedValue({
      id: 'inv-1',
      invoice_items: [],
    } as any);

    const res = await InvoiceService.editInvoiceDraft('ws-1', 'prof-1', 'inv-1', input);

    expect(res.success).toBe(true);
    expect(tx).toHaveBeenCalledTimes(1);
    const [workspaceId, invoiceId, header, items] = tx.mock.calls[0]!;
    expect(workspaceId).toBe('ws-1');
    expect(invoiceId).toBe('inv-1');
    expect(header).toMatchObject({ total: 1180, cgst: 90, sgst: 90, igst: 0 });
    expect(items[0]).toMatchObject({ description: 'Design', taxable_amount: 1000, amount: 1180 });
  });

  it('rejects a non-draft invoice before any write', async () => {
    vi.spyOn(InvoiceRepository, 'getById').mockResolvedValue({
      id: 'inv-1',
      status: 'sent',
      project_id: 'proj-1',
      invoice_number: 'INV-1',
      currency: 'INR',
      exchange_rate: 1,
    } as any);
    const tx = vi.spyOn(InvoiceRepository, 'updateDraftTransactional');

    const res = await InvoiceService.editInvoiceDraft('ws-1', 'prof-1', 'inv-1', input);

    expect(res.success).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });
});

describe('update_invoice_draft_transactional migration', () => {
  it('writes header and items in one SECURITY DEFINER function', () => {
    expect(SQL).toContain('update_invoice_draft_transactional');
    expect(SQL).toContain('SECURITY DEFINER');
    expect(SQL).toContain("status = 'draft'");
    expect(SQL).toContain('DELETE FROM public.invoice_items');
    expect(SQL).toContain('INSERT INTO public.invoice_items');
  });

  it('grants authenticated + service_role only', () => {
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.update_invoice_draft_transactional/);
    expect(SQL).toContain('authenticated');
    expect(SQL).toContain('service_role');
  });
});
