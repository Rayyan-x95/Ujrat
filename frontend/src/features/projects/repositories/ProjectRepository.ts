import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getListPage, softDeleteRecord } from '@/shared/utils/repository';
import type { Project, ProjectWithClient, ProjectInsert, ProjectUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

// List columns only — detail rows come from getById.
export const PROJECT_LIST_COLUMNS =
  'id,name,status,budget,timeline_start,timeline_end,client_id,created_at,clients(id,name)';

export class ProjectRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProjectWithClient>> {
    let query = supabase
      .from('projects')
      .select(PROJECT_LIST_COLUMNS, { count: 'exact' })
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

    return (await getListPage(query, options)) as unknown as PaginatedResult<ProjectWithClient>;
  }

  static async getById(workspaceId: string, id: string): Promise<ProjectWithClient | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, clients(*), project_briefs(*), proposals(*), contracts(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    const result = data as unknown as ProjectWithClient;
    // Embedded relations don't inherit the parent's soft-delete filter, so
    // null out any soft-deleted child record (clients/briefs/etc. all have
    // a deleted_at column). Embeds that come back as arrays stay arrays.
    const notDeleted = <T extends { deleted_at?: string | null }>(v: T | T[] | null | undefined): T | T[] | null | undefined => {
      if (Array.isArray(v)) {
        return v.filter((item) => !(item as { deleted_at?: string | null }).deleted_at) as T[];
      }
      if ((v as { deleted_at?: string | null } | null | undefined)?.deleted_at) {
        return null;
      }
      return (v as T | null | undefined) ?? null;
    };
    return {
      ...result,
      clients: notDeleted(result.clients) as ProjectWithClient['clients'],
      project_briefs: notDeleted(result.project_briefs) as ProjectWithClient['project_briefs'],
      proposals: notDeleted(result.proposals) as ProjectWithClient['proposals'],
      contracts: notDeleted(result.contracts) as ProjectWithClient['contracts'],
    };
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

  /**
   * Rotate the passwordless portal credential and return the NEW RAW token
   * (only the sha256 hash is persisted — the trigger nulls the stored copy).
   * The previous token keeps working for 30 days; the one before it does not.
   * The raw value is revealed once here and then unrecoverable; callers must
   * copy/return it right away.
   */
  static async regeneratePortalToken(workspaceId: string, id: string): Promise<Project> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = crypto.randomUUID().replace(/-/g, '');
      try {
        const row = await this.update(workspaceId, id, {
          portal_token: raw,
          portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });
        return { ...row, portal_token: raw };
      } catch (e: any) {
        // Retry once on the unique index: randomUUID collisions are
        // astronomically unlikely, but on write failure the user’s action
        // fails with a raw Postgres error.
        if (attempt === 1 || !(e?.code === '23505' || e?.message?.includes('duplicate key'))) {
          throw e;
        }
      }
    }
    throw new Error('Could not generate a unique portal token');
  }
}