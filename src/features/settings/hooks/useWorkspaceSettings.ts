import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkspaceService } from '@/features/workspace';
import { AuthService } from '@/features/auth';
import type { WorkspaceSettings, Profile } from '@/shared/types';
import { WorkspaceSettingsSchema, ProfileSchema } from '@/shared/validation/schemas';

export function useWorkspaceSettings(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['workspaceSettings', workspaceId],
    queryFn: async () => {
      const res = await WorkspaceService.getSettings(workspaceId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      const res = await AuthService.getProfile(profileId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!profileId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settingsData: Partial<WorkspaceSettings>) => {
      // Validate with Zod
      WorkspaceSettingsSchema.parse(settingsData);
      
      const res = await WorkspaceService.updateSettings(workspaceId, settingsData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceSettings', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      // Validate with Zod as a partial update
      ProfileSchema.partial().parse(profileData);

      const res = await AuthService.updateProfile(profileId, profileData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  return {
    settings: settingsQuery.data || null,
    profile: profileQuery.data || null,
    isLoading: settingsQuery.isLoading || profileQuery.isLoading,
    updateSettings: updateSettingsMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
  };
}
export default useWorkspaceSettings;
