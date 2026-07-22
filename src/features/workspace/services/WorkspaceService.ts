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

  static async createWorkspace(profileId: string, name: string = 'My Workspace'): Promise<Result<Workspace>> {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ profile_id: profileId, name })
        .select()
        .single();

      if (error) {
        // Handle 409 Conflict / Unique constraint (23505) gracefully by retrieving existing workspace
        if (
          error.code === '23505' ||
          (error as any).status === 409 ||
          error.message?.includes('409') ||
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('conflict')
        ) {
          const existing = await supabase
            .from('workspaces')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existing.data) {
            return { success: true, data: existing.data };
          }
        }
        return { success: false, error: new Error(error.message) };
      }
      return { success: true, data };
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
