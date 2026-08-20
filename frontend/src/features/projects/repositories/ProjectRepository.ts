import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import type { Project, ProjectWithClient, ProjectInsert, ProjectUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class ProjectRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProjectWithClient>> {
    const { page, pageSize, from, to } = getPaginationBounds(options);

    let query = supabase
      .from('projects')
      .select('*, clients(*)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      const term = sanitizeSearchTerm(options.search);
      if (term) {
        query = query.or(`name.ilike.%${term}%,notes.ilike.%${term}%`);
      }
    }

    if (options.filter?.status) {
      query = query.eq('status', String(options.filter.status));
    }

    if (options.filter?.client_id) {
      query = query.eq('client_id', String(options.filter.client_id));
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return toPaginatedResult(data as unknown as ProjectWithClient[], count, page, pageSize);
  }

  static async getById(workspaceId: string, id: string): Promise<ProjectWithClient | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, clients(*), project_briefs(*), proposals(*), contracts(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data as unknown as ProjectWithClient;
  }

  static async create(workspaceId: string, projectData: ProjectInsert): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async update(workspaceId: string, id: string, projectData: ProjectUpdate): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(projectData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return softDeleteRecord('projects', workspaceId, id);
  }
}