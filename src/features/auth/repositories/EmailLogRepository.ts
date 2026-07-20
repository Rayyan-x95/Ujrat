import { supabase } from '@/shared/lib/supabaseClient';
import type { EmailLog, QueryOptions, PaginatedResult } from '@/shared/types';

export class EmailLogRepository {
  static async getByProjectId(workspaceId: string, projectId: string): Promise<EmailLog[]> {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    let clientEmail = '';
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .eq('workspace_id', workspaceId)
        .single();
      
      if (project && project.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('email')
          .eq('id', project.client_id)
          .single();
        if (client) {
          clientEmail = client.email;
        }
      }
    } catch {
      // ignore
    }

    let query = supabase
      .from('email_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', fifteenMinAgo);

    if (clientEmail) {
      query = query.eq('recipient', clientEmail);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const logs = data || [];
    return logs.filter(log => 
      (log.subject && (log.subject.toLowerCase().includes('verification') || log.subject.toLowerCase().includes('otp'))) ||
      (log.body && log.body.match(/\b\d{6}\b/))
    );
  }

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<EmailLog>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('email_logs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId);

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

  static async create(workspaceId: string, emailData: Omit<EmailLog, 'id' | 'created_at'>): Promise<EmailLog> {
    const { data, error } = await supabase
      .from('email_logs')
      .insert({
        ...emailData,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}