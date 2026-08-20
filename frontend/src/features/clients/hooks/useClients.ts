import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClientService } from '@/features/clients';
import type { Client } from '@/shared/types';

export function useClients(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients', workspaceId],
    queryFn: async () => {
      const res = await ClientService.listClients(workspaceId, { pageSize: 1000 });
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
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
    addClient: addClientMutation.mutateAsync,
    removeClient: removeClientMutation.mutateAsync,
  };
}
export default useClients;
