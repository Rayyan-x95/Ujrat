import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BriefService } from '@/features/briefs';

export function useBrief(workspaceId: string, projectId: string, profileId: string) {
  const queryClient = useQueryClient();

  const briefQuery = useQuery({
    queryKey: ['brief', workspaceId, projectId],
    queryFn: async () => {
      const res = await BriefService.getBrief(workspaceId, projectId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId && !!projectId,
  });

  const saveBrief = useMutation({
    mutationFn: async (data: {
      description: string;
      goals: string;
      deadline?: string;
      budget?: number;
      references?: string;
    }) => {
      const res = await BriefService.saveBrief(workspaceId, profileId, projectId, data);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brief', workspaceId, projectId] });
    },
  });

  return {
    brief: briefQuery.data,
    isLoading: briefQuery.isLoading,
    saveBrief: saveBrief.mutateAsync,
    isSaving: saveBrief.isPending,
  };
}