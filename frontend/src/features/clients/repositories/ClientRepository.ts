import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import type { Client, ClientInsert, ClientUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class ClientRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Client>> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const { page, pageSize, from, to } = getPaginationBounds(options);

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      const term = sanitizeSearchTerm(options.search);
      if (term) {
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
      }
    }

    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return toPaginatedResult(data, count, page, pageSize);
  }

  static async getById(workspaceId: string, id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  static async create(workspaceId: string, clientData: ClientInsert): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...clientData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async update(workspaceId: string, id: string, clientData: ClientUpdate): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return softDeleteRecord('clients', workspaceId, id);
  }
}