import { supabase } from '@/shared/lib/supabaseClient';
import type { Contract, ContractInsert, ContractUpdate, ContractSignature, ContractSignatureInsert, ContractWithSignature, QueryOptions, PaginatedResult } from '@/shared/types';

export class ContractRepository {
  private static readonly sortableColumns = new Set(['created_at', 'updated_at', 'status']);

  private static mapContract(c: any): any {
    if (!c) return c;
    if (c.introduction === undefined && c.content !== undefined) {
      let parsed = { introduction: '', payment_schedule: '', terms: '' };
      try {
        parsed = JSON.parse(c.content || '{}');
      } catch {
        parsed = { introduction: c.content || '', payment_schedule: '', terms: '' };
      }
      return {
        ...c,
        introduction: parsed.introduction || null,
        payment_schedule: parsed.payment_schedule || null,
        terms: parsed.terms || null,
      };
    }
    return c;
  }

  static async getByProjectId(workspaceId: string, projectId: string): Promise<ContractWithSignature | null> {
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error || !contract) return null;

    const { data: signature } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('contract_id', contract.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    return {
      ...this.mapContract(contract),
      contract_signatures: signature || null,
    };
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Contract>> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from('contracts')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (options.search) {
        const searchTerm = options.search.replace(/[^a-zA-Z0-9\\s-]/g, '').trim();
        if (searchTerm) {
          query = query.or(`introduction.ilike.%${searchTerm}%,payment_schedule.ilike.%${searchTerm}%,terms.ilike.%${searchTerm}%`);
        }
      }

      if (options.filter?.status) {
        query = query.eq('status', String(options.filter.status));
      }

      if (options.filter?.project_id) {
        query = query.eq('project_id', String(options.filter.project_id));
      }

      const sortBy = options.sortBy && this.sortableColumns.has(options.sortBy)
        ? options.sortBy
        : 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query.range(from, to);

      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('introduction')) {
          return await this.getAllLegacy(workspaceId, options, from, to);
        }
        throw new Error(error.message);
      }
      
      const total = count || 0;
      return {
        data: (data || []).map(c => this.mapContract(c)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (e: any) {
      if (e.message?.includes('introduction') || e.code === 'PGRST204') {
        return await this.getAllLegacy(workspaceId, options, from, to);
      }
      throw e;
    }
  }

  private static async getAllLegacy(
    workspaceId: string,
    options: QueryOptions,
    from: number,
    to: number
  ): Promise<PaginatedResult<Contract>> {
    let query = supabase
      .from('contracts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      const searchTerm = options.search.replace(/[^a-zA-Z0-9\\s-]/g, '').trim();
      if (searchTerm) {
        query = query.or(`content.ilike.%${searchTerm}%`);
      }
    }

    if (options.filter?.status) {
      query = query.eq('status', String(options.filter.status));
    }

    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
    }

    const sortBy = options.sortBy && this.sortableColumns.has(options.sortBy)
      ? options.sortBy
      : 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);
    
    const total = count || 0;
    return {
      data: (data || []).map(c => this.mapContract(c)),
      total,
      page: Math.floor(from / (to - from + 1)) + 1,
      pageSize: to - from + 1,
      totalPages: Math.ceil(total / (to - from + 1)),
    };
  }

  static async create(workspaceId: string, contractData: ContractInsert): Promise<Contract> {
    try {
      const payload: ContractInsert = {
        workspace_id: workspaceId,
        project_id: contractData.project_id,
        introduction: contractData.introduction || null,
        payment_schedule: contractData.payment_schedule || null,
        terms: contractData.terms || null,
        status: contractData.status || 'draft',
      };

      const { data, error } = await supabase
        .from('contracts')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('introduction')) {
          return await this.createLegacy(workspaceId, contractData);
        }
        throw new Error(error.message);
      }
      return data;
    } catch (e: any) {
      if (e.message?.includes('introduction') || e.code === 'PGRST204') {
        return await this.createLegacy(workspaceId, contractData);
      }
      throw e;
    }
  }

  private static async createLegacy(workspaceId: string, contractData: ContractInsert): Promise<Contract> {
    const payload = {
      workspace_id: workspaceId,
      project_id: contractData.project_id,
      content: JSON.stringify({
        introduction: contractData.introduction || '',
        payment_schedule: contractData.payment_schedule || '',
        terms: contractData.terms || '',
      }),
      status: contractData.status || 'draft',
    } as any;
    const { data, error } = await supabase
      .from('contracts')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapContract(data);
  }

  static async update(workspaceId: string, id: string, contractData: ContractUpdate): Promise<Contract> {
    try {
      const updatePayload: ContractUpdate = {};
      if (contractData.status !== undefined) updatePayload.status = contractData.status;
      if (contractData.introduction !== undefined) updatePayload.introduction = contractData.introduction;
      if (contractData.payment_schedule !== undefined) updatePayload.payment_schedule = contractData.payment_schedule;
      if (contractData.terms !== undefined) updatePayload.terms = contractData.terms;

      if (Object.keys(updatePayload).length === 0) {
        throw new Error('Contract update requires at least one mutable field');
      }

      const { data, error } = await supabase
        .from('contracts')
        .update(updatePayload)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('introduction')) {
          return await this.updateLegacy(workspaceId, id, contractData);
        }
        throw new Error(error.message);
      }
      return data;
    } catch (e: any) {
      if (e.message?.includes('introduction') || e.code === 'PGRST204') {
        return await this.updateLegacy(workspaceId, id, contractData);
      }
      throw e;
    }
  }

  private static async updateLegacy(workspaceId: string, id: string, contractData: ContractUpdate): Promise<Contract> {
    const { data: existing, error: fetchError } = await supabase
      .from('contracts')
      .select('content, status')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !existing) throw new Error(fetchError?.message || 'Contract not found');

    let parsed = { introduction: '', payment_schedule: '', terms: '' };
    try {
      parsed = JSON.parse((existing as any).content || '{}');
    } catch {
      parsed = { introduction: (existing as any).content || '', payment_schedule: '', terms: '' };
    }

    const updatePayload: any = {};
    if (contractData.status !== undefined) updatePayload.status = contractData.status;

    if (contractData.introduction !== undefined || contractData.payment_schedule !== undefined || contractData.terms !== undefined) {
      updatePayload.content = JSON.stringify({
        introduction: contractData.introduction !== undefined ? contractData.introduction : parsed.introduction,
        payment_schedule: contractData.payment_schedule !== undefined ? contractData.payment_schedule : parsed.payment_schedule,
        terms: contractData.terms !== undefined ? contractData.terms : parsed.terms,
      });
    }

    const { data, error } = await supabase
      .from('contracts')
      .update(updatePayload)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapContract(data);
  }

  static async addSignature(workspaceId: string, signatureData: ContractSignatureInsert): Promise<ContractSignature> {
    const { data, error } = await supabase
      .from('contract_signatures')
      .insert({
        ...signatureData,
        workspace_id: workspaceId,
        signature_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('contracts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}
