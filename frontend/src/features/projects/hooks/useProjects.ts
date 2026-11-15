import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectService } from '../services/ProjectService';
import type { Project, QueryOptions } from '@/shared/types';

export function useProjects(workspaceId: string, profileId: string, options: QueryOptions = {}) {
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId, options],
    queryFn: async () => {
      // One page per request: the repository issues a single .range() call
      // with an exact count, so the table never holds more than a page.
      // Pickers that need every row pass { pageSize: 1000 }.
      const res = await ProjectService.listProjects(workspaceId, { page: 1, pageSize: 25, ...options });
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const addProjectMutation = useMutation({
    mutationFn: async (projectData: Omit<Project, 'id' | 'workspace_id' | 'portal_token' | 'portal_token_hash' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const res = await ProjectService.addProject(workspaceId, profileId, projectData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const editProjectMutation = useMutation({
    mutationFn: async ({ id, ...projectData }: { id: string } & Partial<Project>) => {
      const res = await ProjectService.editProject(workspaceId, profileId, id, projectData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const removeProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await ProjectService.removeProject(workspaceId, profileId, id);
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  return {
    projects: projectsQuery.data?.data || [],
    projectsResult: projectsQuery.data,
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    addProject: addProjectMutation.mutateAsync,
    editProject: editProjectMutation.mutateAsync,
    removeProject: removeProjectMutation.mutateAsync,
  };
}
export default useProjects;
