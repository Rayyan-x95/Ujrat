import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getListPage, fetchAllPages } from '@/shared/utils/repository';

describe('repository pagination', () => {
  it('page 2 of 250 rows = exactly 1 .range() call with full page bounds + exact count', async () => {
    const allRows = Array.from({ length: 250 }, (_, i) => ({ id: String(i + 1) }));
    const query = {
      range: vi.fn(async (from: number, to: number) => ({
        data: allRows.slice(from, to + 1),
        error: null,
        count: 250,
      })),
    };

    const result = await getListPage<{ id: string }>(query as any, { page: 2, pageSize: 100 });

    expect(query.range).toHaveBeenCalledTimes(1);
    expect(query.range).toHaveBeenCalledWith(100, 199);
    expect(result.data).toHaveLength(100);
    expect(result.data[0]).toEqual({ id: '101' });
    expect(result.data[99]).toEqual({ id: '200' });
    expect(result.total).toBe(250);
    expect(result.totalPages).toBe(3);
  });

  it('propagates the query error instead of swallowing it', async () => {
    const query = {
      range: vi.fn(async () => ({
        data: null,
        error: { message: 'boom' },
        count: null,
      })),
    };

    await expect(getListPage(query as any, { page: 1, pageSize: 10 })).rejects.toThrow('boom');
    expect(query.range).toHaveBeenCalledTimes(1);
  });

  it('fetchAllPages remains exported for backward compatibility', async () => {
    expect(typeof fetchAllPages).toBe('function');
  });

  it('the three list hooks no longer use the fetchAllPages loop', () => {
    const src = (rel: string) =>
      readFileSync(path.join(process.cwd(), 'src', rel), 'utf-8');

    expect(src('features/clients/hooks/useClients.ts')).not.toContain('fetchAllPages');
    expect(src('features/projects/hooks/useProjects.ts')).not.toContain('fetchAllPages');
    expect(src('features/invoices/hooks/useInvoices.ts')).not.toContain('fetchAllPages');
  });
});
