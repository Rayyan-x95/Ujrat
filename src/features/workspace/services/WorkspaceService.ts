import { supabase } from '@/shared/lib/supabaseClient';
import type { Workspace, WorkspaceSettings, Result } from '@/shared/types';
import { WorkspaceSettingsSchema } from '@/shared/validation/schemas';

export class WorkspaceService {
  static async getWorkspaces(profileId: string): Promise<Result<Workspace[]>> {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('profile_id', profileId)
        .is('deleted_at', null);

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: data || [] };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async getSettings(workspaceId: string): Promise<Result<WorkspaceSettings | null>> {
    try {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async updateSettings(workspaceId: string, settingsData: Partial<WorkspaceSettings>): Promise<Result<WorkspaceSettings>> {
    try {
      // Validate settings data using Zod
      const validated = WorkspaceSettingsSchema.partial().parse(settingsData);

      const { data, error } = await supabase
        .from('workspace_settings')
        .update(validated as any)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }
}
