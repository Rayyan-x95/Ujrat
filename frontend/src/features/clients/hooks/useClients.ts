import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClientService } from '@/features/clients';
import type { Client, QueryOptions } from '@/shared/types';

export function useClients(workspaceId: string, profileId: string, options: QueryOptions = {}) {
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients', workspaceId, options],
    queryFn: async () => {
      // One page per request: the repository issues a single .range() call
      // with an exact count, so the table never holds more than a page.
      // Pickers that need every row pass { pageSize: 1000 }.
      const res = await ClientService.listClients(workspaceId, { page: 1, pageSize: 25, ...options });
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const addClientMutation = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const res = await ClientService.addClient(workspaceId, profileId, clientData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', workspaceId] });
    },
  });

  const editClientMutation = useMutation({
    mutationFn: async ({ id, ...clientData }: { id: string } & Partial<Client>) => {
      const res = await ClientService.editClient(workspaceId, profileId, id, clientData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', workspaceId] });
    },
  });

  const removeClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await ClientService.removeClient(workspaceId, profileId, clientId);
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', workspaceId] });
    },
  });

  return {
    clients: clientsQuery.data?.data || [],
    clientsResult: clientsQuery.data,
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
    addClient: addClientMutation.mutateAsync,
    editClient: editClientMutation.mutateAsync,
    removeClient: removeClientMutation.mutateAsync,
  };
}
export default useClients;
