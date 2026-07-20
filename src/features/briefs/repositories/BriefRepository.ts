import { supabase } from '@/shared/lib/supabaseClient';
import type { ProjectBrief, ProjectBriefInsert, ProjectBriefUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class BriefRepository {
  static async getByProjectId(workspaceId: string, projectId: string): Promise<ProjectBrief | null> {
    const { data, error } = await supabase
      .from('project_briefs')
      .select('*')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProjectBrief>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('project_briefs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      query = query.or(`description.ilike.%${options.search}%,goals.ilike.%${options.search}%`);
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

  static async createOrUpdate(
    workspaceId: string,
    projectId: string,
    briefData: Omit<ProjectBriefInsert, 'workspace_id' | 'project_id'>
  ): Promise<ProjectBrief> {
    const { data, error } = await supabase
      .from('project_briefs')
      .upsert({
        ...briefData,
        workspace_id: workspaceId,
        project_id: projectId,
        updated_at: new Date().toISOString(),
      } as ProjectBriefInsert, { onConflict: 'project_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async submitFromPortal(
    workspaceId: string,
    projectId: string,
    briefData: {
      description?: string;
      goals?: string;
      deadline?: string;
      budget?: number;
      references?: string;
    }
  ): Promise<ProjectBrief> {
    return BriefRepository.createOrUpdate(workspaceId, projectId, {
      description: briefData.description || null,
      goals: briefData.goals || null,
      deadline: briefData.deadline || null,
      budget: briefData.budget ?? null,
      references: briefData.references || null,
      attachments: [],
      submitted_at: new Date().toISOString(),
    });
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('project_briefs')
      .update({ deleted_at: new Date().toISOString() } as Partial<ProjectBriefUpdate>)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}