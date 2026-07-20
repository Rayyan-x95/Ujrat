import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

export class LoggingService {
  static async logActivity(params: {
    workspaceId: string;
    profileId?: string;
    projectId?: string;
    action: string;
    details?: Record<string, unknown>;
  }): Promise<Result<void>> {
    try {
      const { workspaceId, profileId, projectId, action, details = {} } = params;

      const { error } = await supabase
        .from('activity_logs')
        .insert({
          workspace_id: workspaceId,
          profile_id: profileId || null,
          project_id: projectId || null,
          action,
          details,
        });

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
