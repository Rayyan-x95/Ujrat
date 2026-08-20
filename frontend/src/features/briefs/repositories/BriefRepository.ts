import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import type { ProjectBrief, ProjectBriefInsert, QueryOptions, PaginatedResult } from '@/shared/types';

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
    const { page, pageSize, from, to } = getPaginationBounds(options);

    let query = supabase
      .from('project_briefs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      const term = sanitizeSearchTerm(options.search);
      if (term) {
        query = query.or(`description.ilike.%${term}%,goals.ilike.%${term}%`);
      }
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return toPaginatedResult(data, count, page, pageSize);
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
    return softDeleteRecord('project_briefs', workspaceId, id);
  }
}