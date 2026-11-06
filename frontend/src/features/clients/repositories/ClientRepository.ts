import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getListPage, softDeleteRecord } from '@/shared/utils/repository';
import type { Client, ClientInsert, ClientUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

// List columns only — detail rows come from getById.
export const CLIENT_LIST_COLUMNS = 'id,name,email,company,created_at';

export class ClientRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Client>> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    let query = supabase
      .from('clients')
      .select(CLIENT_LIST_COLUMNS, { count: 'exact' })
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

    return getListPage<Client>(query, options);
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