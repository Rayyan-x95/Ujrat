import { supabase } from '@/shared/lib/supabaseClient';
import type { Workspace, WorkspaceSettings, Result } from '@/shared/types';
// ponytail: lazy-load WorkspaceSettingsSchema in updateSettings — keeps zod off the auth startup path

export class WorkspaceService {
  static async getWorkspaces(profileId: string): Promise<Result<Workspace[]>> {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id,name,profile_id,created_at')
        .eq('profile_id', profileId)
        .is('deleted_at', null);

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: (data || []) as unknown as Workspace[] };
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
        // Handle unique constraint / duplicate workspace gracefully by retrieving existing workspace
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
            .is('deleted_at', null)
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
        .maybeSingle();

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async updateSettings(workspaceId: string, settingsData: Partial<WorkspaceSettings>): Promise<Result<WorkspaceSettings>> {
    try {
      const { WorkspaceSettingsSchema } = await import('@/shared/validation/schemas');
      const validated = WorkspaceSettingsSchema.partial().parse(settingsData);

      let { data, error } = await (supabase
        .from('workspace_settings') as any)
        .update(validated)
        .eq('workspace_id', workspaceId)
        .select()
        .maybeSingle();

      if (!error && !data) {
        // Fallback to upsert if workspace_settings row did not exist yet
        const upsertRes = await (supabase
          .from('workspace_settings') as any)
          .upsert({
            workspace_id: workspaceId,
            ...validated,
          }, { onConflict: 'workspace_id' })
          .select()
          .maybeSingle();

        data = upsertRes.data;
        error = upsertRes.error;
      }

      if (error || !data) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(error?.message || 'Settings update failed'),
        };
      }
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }
}
