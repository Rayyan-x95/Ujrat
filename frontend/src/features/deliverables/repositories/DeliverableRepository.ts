import { supabase } from '@/shared/lib/supabaseClient';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import type { Deliverable, DeliverableInsert, QueryOptions, PaginatedResult } from '@/shared/types';

export class DeliverableRepository {
  private static readonly sortableColumns = new Set(['created_at', 'updated_at', 'name']);

  static async getByProjectId(workspaceId: string, projectId: string): Promise<Deliverable[]> {
    const { data, error } = await supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      // Non-critical list view; dashboards page through getAll. 500 is well past any real project.
      .limit(500);

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Deliverable>> {
    const { page, pageSize, from, to } = getPaginationBounds(options);

    let query = supabase
      .from('deliverables')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
    }
    if (options.search) {
      query = query.ilike('name', `%${sanitizeSearchTerm(options.search)}%`);
    }

    const sortBy = options.sortBy && this.sortableColumns.has(options.sortBy)
      ? options.sortBy
      : 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return toPaginatedResult(data, count, page, pageSize);
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
    // Whitelist — callers must not re-parent rows (project_id) or move them
    // across workspaces through the update payload.
    const updatePayload: Record<string, unknown> = {};
    if (deliverableData.name !== undefined) updatePayload.name = deliverableData.name;
    if (deliverableData.file_url !== undefined) updatePayload.file_url = deliverableData.file_url;
    if (deliverableData.file_type !== undefined) updatePayload.file_type = deliverableData.file_type;
    if (deliverableData.file_size !== undefined) updatePayload.file_size = deliverableData.file_size;
    if ((deliverableData as Record<string, unknown>).downloaded_at !== undefined) {
      updatePayload.downloaded_at = (deliverableData as Record<string, unknown>).downloaded_at;
    }
    if (Object.keys(updatePayload).length === 0) {
      throw new Error('Deliverable update requires at least one mutable field');
    }
    const { data, error } = await supabase
      .from('deliverables')
      .update(updatePayload as any)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return softDeleteRecord('deliverables', workspaceId, id);
  }
}