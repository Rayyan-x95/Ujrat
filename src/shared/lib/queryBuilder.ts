import { supabase } from '@/shared/lib/supabaseClient';
import type { QueryOptions, PaginatedResult } from '@/shared/types';

export interface RepositoryConfig {
  table: string;
  selectColumns?: string;
  allowedFilters?: string[];
  allowedSearches?: string[];
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

/**
 * Shared query builders to eliminate duplication across repositories.
 * Uses `any` for table name to work with Supabase's typed client,
 * but maintains type safety for everything else.
 */

export async function buildPaginatedQuery<T>(
  workspaceId: string,
  options: QueryOptions = {},
  config: RepositoryConfig
): Promise<PaginatedResult<T>> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (supabase.from(config.table as any) as any)
    .select(config.selectColumns || '*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (options.search && config.allowedSearches?.length) {
    const searchClauses = config.allowedSearches
      .map(col => `${col}.ilike.%${options.search}%`)
      .join(',');
    query = query.or(searchClauses);
  }

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      if (config.allowedFilters?.includes(key) && value !== undefined && value !== null) {
        query = query.eq(key, String(value));
      }
    }
  }

  const sortBy = options.sortBy || config.defaultSortBy || 'created_at';
  const sortOrder = options.sortOrder || config.defaultSortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const result = await query.range(from, to);

  if (result.error) throw new Error(result.error.message);

  const total = result.count || 0;
  return {
    data: (result.data as unknown as T[]) || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function buildGetByIdQuery<T>(
  workspaceId: string,
  id: string,
  table: string
): Promise<T | null> {
  const result = await (supabase.from(table as any) as any)
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .single();

  if (result.error || !result.data) return null;
  return result.data as unknown as T;
}

export async function buildGetByProjectIdQuery<T>(
  workspaceId: string,
  projectId: string,
  table: string
): Promise<T[]> {
  const result = await (supabase.from(table as any) as any)
    .select('*')
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (result.error) throw new Error(result.error.message);
  return (result.data as unknown as T[]) || [];
}

export async function buildCreateQuery<TInsert, TRow>(
  workspaceId: string,
  data: TInsert,
  table: string
): Promise<TRow> {
  const result = await (supabase.from(table as any) as any)
    .insert({
      ...data,
      workspace_id: workspaceId,
    })
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  return result.data as unknown as TRow;
}

export async function buildUpdateQuery<TUpdate, TRow>(
  workspaceId: string,
  id: string,
  data: TUpdate,
  table: string
): Promise<TRow> {
  const result = await (supabase.from(table as any) as any)
    .update(data)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  return result.data as unknown as TRow;
}

export async function buildSoftDeleteQuery(
  workspaceId: string,
  id: string,
  table: string
): Promise<void> {
  const result = await (supabase.from(table as any) as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (result.error) throw new Error(result.error.message);
}