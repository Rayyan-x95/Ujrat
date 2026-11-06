import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PortalService } from '@/features/portal/services/PortalService';
import { PortalRepository } from '@/features/portal/repositories/PortalRepository';

const ROOT = process.cwd();
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations/20261108000001_portal_bundle.sql'))
  ? path.join(ROOT, 'backend/supabase/migrations/20261108000001_portal_bundle.sql')
  : path.resolve(ROOT, '../backend/supabase/migrations/20261108000001_portal_bundle.sql');
const SQL = readFileSync(MIGRATION, 'utf8');

function mockBundle() {
  return {
    project: { id: 'proj-1', portal_token: 'tok', name: 'Site' } as any,
    client: { id: 'cli-1', name: 'Client' } as any,
    settings: { company_name: 'Ujrat' } as any,
    proposal: null,
    contract: null,
    invoices: [
      {
        id: 'inv-1',
        invoice_items: [{ id: 'item-1', invoice_id: 'inv-1', amount: 11800 }],
      } as any,
    ],
    deliverables: [] as any[],
    lastViewedAt: '2026-11-08T10:00:00Z',
    viewCount: 3,
  };
}

describe('Portal bundle — single RPC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches everything with one getBundle call (7-RPC path untouched)', async () => {
    const bundleSpy = vi.spyOn(PortalRepository, 'getBundle').mockResolvedValue(mockBundle() as any);
    const projectSpy = vi.spyOn(PortalRepository, 'getProject');
    const invoicesSpy = vi.spyOn(PortalRepository, 'getInvoices');

    const res = await PortalService.getPortalData('tok');

    expect(bundleSpy).toHaveBeenCalledTimes(1);
    expect(projectSpy).not.toHaveBeenCalled();
    expect(invoicesSpy).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.project.id).toBe('proj-1');
      expect(res.data.invoices[0]?.invoice_items).toHaveLength(1);
      expect(res.data.viewCount).toBe(3);
      expect(res.data.lastViewedAt).toBe('2026-11-08T10:00:00Z');
    }
  });

  it('falls back to the 7-RPC path when the bundle RPC is missing', async () => {
    vi.spyOn(PortalRepository, 'getBundle').mockRejectedValue(new Error('Function not found'));
    vi.spyOn(PortalRepository, 'getProject').mockResolvedValue({ id: 'proj-1' } as any);
    vi.spyOn(PortalRepository, 'getClient').mockResolvedValue(null);
    vi.spyOn(PortalRepository, 'getSettings').mockResolvedValue(null);
    vi.spyOn(PortalRepository, 'getProposal').mockResolvedValue(null);
    vi.spyOn(PortalRepository, 'getContract').mockResolvedValue(null);
    vi.spyOn(PortalRepository, 'getInvoices').mockResolvedValue([]);
    vi.spyOn(PortalRepository, 'getDeliverables').mockResolvedValue([]);

    const res = await PortalService.getPortalData('tok');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.viewCount).toBe(0);
      expect(res.data.lastViewedAt).toBeNull();
    }
  });

  it('getInvoices no longer throws when the items RPC degrades', async () => {
    const { supabase } = await import('@/shared/lib/supabaseClient');
    (vi.spyOn(supabase, 'rpc' as never) as any).mockImplementation((fn: string) => {
      if (fn === 'get_portal_invoices') {
        return Promise.resolve({ data: [{ id: 'inv-1' }], error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'items down' } });
    });
    await expect(PortalRepository.getInvoices('tok')).resolves.toEqual([
      { id: 'inv-1', invoice_items: [] },
    ]);
  });
});

describe('get_portal_bundle migration invariants', () => {
  it('returns all seven keys plus view tracking', () => {
    for (const key of ["'project'", "'client'", "'settings'", "'proposal'", "'contract'", "'invoices'", "'deliverables'"]) {
      expect(SQL).toContain(key);
    }
    expect(SQL).toContain('portal_view');
    expect(SQL).toContain('activity_logs');
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_portal_bundle/);
  });

  it('mirrors sibling guards: soft-delete, live token, draft-free invoices', () => {
    expect(SQL).toContain('deleted_at IS NULL');
    expect(SQL).toContain('portal_token_is_live');
    expect(SQL).toContain("status <> 'draft'");
  });
});
