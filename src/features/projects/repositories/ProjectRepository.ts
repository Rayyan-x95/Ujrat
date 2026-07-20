import { supabase } from '@/shared/lib/supabaseClient';
import type { Project, ProjectWithClient, ProjectInsert, ProjectUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class ProjectRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProjectWithClient>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('projects')
      .select('*, clients(*), project_briefs(*), proposals(*), contracts(*)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,notes.ilike.%${options.search}%`);
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
    
    const total = count || 0;
    return {
      data: (data as unknown as ProjectWithClient[]) || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}