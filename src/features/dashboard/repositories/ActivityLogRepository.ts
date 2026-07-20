import { supabase } from '@/shared/lib/supabaseClient';
import type { ActivityLog } from '@/shared/types';

export class ActivityLogRepository {
  /**
   * Get recent activity logs for a workspace, optionally filtered by profile.
   * Scopes by workspace_id to prevent cross-workspace data leakage.
   */
  static async getRecent(workspaceId: string, profileId: string, limitNum: number): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limitNum);

    if (error) throw new Error(error.message);
    return data || [];
  }
}