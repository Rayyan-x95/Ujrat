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
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 10));
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
