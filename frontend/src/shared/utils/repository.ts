import { supabase } from '@/shared/lib/supabaseClient';
import type { QueryOptions, PaginatedResult } from '@/shared/types';

/**
 * Calculates zero-indexed range bounds for Supabase PostgREST `.range(from, to)`.
 */
export function getPaginationBounds(options: QueryOptions = {}): {
  page: number;
  pageSize: number;
  from: number;
  to: number;
} {
  const page = Math.max(1, options.page || 1);
  // 1000 is the hosted Supabase per-request row cap; pages stay full until
  // exhausted, so callers asking for whole-table lists cost 1 round trip
  // instead of 10 (each Supabase RTT dominates perceived latency).
  const pageSize = Math.min(1000, Math.max(1, options.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

/**
 * Standardizes raw database query rows and count into a structured PaginatedResult.
 */
export function toPaginatedResult<T>(
  data: T[] | null,
  count: number | null,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const total = count || 0;
  return {
    data: data || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Fetches every row of a paginated query, page by page.
 * A single request is capped at 1000 rows (the hosted Supabase max), so lists
 * that must be complete (dashboard cards, statutory exports) cannot rely on
 * one page.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResult<T>>,
): Promise<PaginatedResult<T>> {
  const rows: T[] = [];
  let page = 1;
  let total = 0;
  let totalPages = 1;

  do {
    const result = await fetchPage(page);
    rows.push(...result.data);
    total = result.total;
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);

  return { data: rows, total, page: 1, pageSize: rows.length, totalPages: 1 };
}

/**
 * Reusable defense-in-depth soft delete for workspace-scoped records.
 */
export async function softDeleteRecord(
  table: string,
  workspaceId: string,
  id: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
}
