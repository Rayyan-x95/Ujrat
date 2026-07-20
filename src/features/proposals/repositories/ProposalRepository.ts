import { supabase } from '@/shared/lib/supabaseClient';
import type { Proposal, ProposalSection, ProposalWithSections, ProposalInsert, ProposalUpdate, ProposalSectionInsert, ProposalSectionUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class ProposalRepository {
  static async getByProjectId(workspaceId: string, projectId: string): Promise<ProposalWithSections | null> {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (propError || !proposal) return null;

    const { data: sections } = await supabase
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', proposal.id)
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });

    return {
      ...proposal,
      proposal_sections: sections || [],
    };
  }

  static async getByProposalId(workspaceId: string, proposalId: string): Promise<ProposalWithSections | null> {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (propError || !proposal) return null;

    const { data: sections } = await supabase
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', proposal.id)
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });

    return {
      ...proposal,
      proposal_sections: sections || [],
    };
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Proposal>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('proposals')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      query = query.or(`introduction.ilike.%${options.search}%,scope.ilike.%${options.search}%`);
    }

    if (options.filter?.status) {
      query = query.eq('status', String(options.filter.status));
    }

    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
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

  static async create(workspaceId: string, proposalData: ProposalInsert): Promise<Proposal> {
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        ...proposalData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async update(workspaceId: string, id: string, proposalData: ProposalUpdate): Promise<Proposal> {
    const { data, error } = await supabase
      .from('proposals')
      .update(proposalData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async addSection(workspaceId: string, sectionData: ProposalSectionInsert): Promise<ProposalSection> {
    const { data, error } = await supabase
      .from('proposal_sections')
      .insert({
        ...sectionData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateSection(workspaceId: string, sectionId: string, sectionData: ProposalSectionUpdate): Promise<ProposalSection> {
    const { data, error } = await supabase
      .from('proposal_sections')
      .update(sectionData)
      .eq('id', sectionId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteSection(workspaceId: string, sectionId: string): Promise<void> {
    const { error } = await supabase
      .from('proposal_sections')
      .delete()
      .eq('id', sectionId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('proposals')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}