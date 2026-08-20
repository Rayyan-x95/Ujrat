import { supabase } from '@/shared/lib/supabaseClient';
import type { EmailLog } from '@/shared/types';

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
    return data || [];
  }
}