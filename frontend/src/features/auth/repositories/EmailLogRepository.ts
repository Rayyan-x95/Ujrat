import { supabase } from '@/shared/lib/supabaseClient';
import type { EmailLog } from '@/shared/types';

export class EmailLogRepository {
  static async getByProjectId(workspaceId: string, projectId: string): Promise<EmailLog[]> {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      // Log history is bounded, not critical data.
      .limit(500);

    if (error) throw new Error(error.message);
    return data || [];
  }
}