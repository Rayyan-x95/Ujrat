import { supabase } from '@/shared/lib/supabaseClient';
import type { Deliverable, DeliverableInsert, QueryOptions, PaginatedResult } from '@/shared/types';

export class DeliverableRepository {
  static async getByProjectId(workspaceId: string, projectId: string): Promise<Deliverable[]> {
    const { data, error } = await supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Deliverable>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('deliverables')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
    }
    if (options.search) {
      query = query.ilike('name', `%${options.search}%`);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async addDeliverable(workspaceId: string, deliverableData: DeliverableInsert): Promise<Deliverable> {
    const { data, error } = await supabase
      .from('deliverables')
      .insert({
        ...deliverableData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async markDownloaded(workspaceId: string, id: string): Promise<Deliverable> {
    return this.update(workspaceId, id, { downloaded_at: new Date().toISOString() } as any);
  }

  static async update(workspaceId: string, id: string, deliverableData: Partial<DeliverableInsert>): Promise<Deliverable> {
    const { data, error } = await supabase
      .from('deliverables')
      .update(deliverableData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('deliverables')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}