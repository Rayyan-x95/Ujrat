import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectService } from '../services/ProjectService';
import type { Project } from '@/shared/types';

export function useProjects(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      const res = await ProjectService.listProjects(workspaceId, { pageSize: 1000 });
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const addProjectMutation = useMutation({
    mutationFn: async (projectData: Omit<Project, 'id' | 'workspace_id' | 'portal_token' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const res = await ProjectService.addProject(workspaceId, profileId, projectData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Project['status'] }) => {
      const res = await ProjectService.updateProjectStatus(workspaceId, profileId, id, status);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const getPortalToken = async (projectId: string) => {
    const res = await ProjectService.getProjectPortalToken(workspaceId, projectId);
    if (res.success === false) throw res.error;
    return res.data;
  };

  return {
    projects: projectsQuery.data?.data || [],
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    addProject: addProjectMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    getPortalToken,
  };
}
export default useProjects;
