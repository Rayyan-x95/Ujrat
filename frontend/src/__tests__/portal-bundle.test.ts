import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PortalService } from '@/features/portal/services/PortalService';
import { PortalRepository } from '@/features/portal/repositories/PortalRepository';

const ROOT = process.cwd();
// The LIVE bundle definition: 20261108000001 was superseded by the
// projections migration (which fixed the whole-client-row leak).
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations/20261114184606_portal_projections_and_rls_gaps.sql'))
  ? path.join(ROOT, 'backend/supabase/migrations/20261114184606_portal_projections_and_rls_gaps.sql')
  : path.resolve(ROOT, '../backend/supabase/migrations/20261114184606_portal_projections_and_rls_gaps.sql');
const SQL = readFileSync(MIGRATION, 'utf8');
const GRANTS_SQL = readFileSync(
  existsSync(path.join(ROOT, 'backend/supabase/migrations/20261107160011_fix_mark_paid_and_immutability.sql'))
    ? path.join(ROOT, 'backend/supabase/migrations/20261107160011_fix_mark_paid_and_immutability.sql')
    : path.resolve(ROOT, '../backend/supabase/migrations/20261107160011_fix_mark_paid_and_immutability.sql'),
  'utf8'
);

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

  it('fetches everything with one getBundle call (no legacy fallbacks)', async () => {
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

  it('fails closed when the bundle RPC is unavailable (no silent fallback)', async () => {
    vi.spyOn(PortalRepository, 'getBundle').mockRejectedValue(new Error('Function not found'));
    const projectSpy = vi.spyOn(PortalRepository, 'getProject');

    const res = await PortalService.getPortalData('tok');
    expect(res.success).toBe(false);
    expect(projectSpy).not.toHaveBeenCalled();
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
    expect(GRANTS_SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_portal_bundle/);
  });

  it('mirrors sibling guards: soft-delete, live token, draft-free invoices', () => {
    expect(SQL).toContain('deleted_at IS NULL');
    expect(SQL).toContain('portal_token_is_live');
    expect(SQL).toContain("status <> 'draft'");
  });

  it('projects away token hashes, PAN and internal notes (no whole-row echoes)', () => {
    expect(SQL).not.toContain('to_jsonb(p.*)');
    expect(SQL).not.toContain('to_jsonb(c.*)');
    const proj = SQL.slice(SQL.indexOf('SELECT to_jsonb(proj)'), SQL.indexOf('SELECT to_jsonb(cli)'));
    expect(proj).not.toMatch(/portal_token/);
    expect(proj).not.toMatch(/\bnotes\b/);
    const cli = SQL.slice(SQL.indexOf('SELECT to_jsonb(cli)'), SQL.indexOf('SELECT to_jsonb(s)'));
    expect(cli).not.toMatch(/\bpan\b/);
    expect(cli).not.toMatch(/\bnotes\b/);
  });
});
