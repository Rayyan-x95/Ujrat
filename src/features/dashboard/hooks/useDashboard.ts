import { useQuery } from '@tanstack/react-query';
import { DashboardService } from '@/features/dashboard';

export function useDashboard(workspaceId: string, profileId: string) {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', workspaceId, profileId],
    queryFn: async () => {
      const res = await DashboardService.getDashboardData(workspaceId, profileId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30000,
    retry: 1,
  });

  return {
    metrics: dashboardQuery.data,
    isLoading: dashboardQuery.isLoading,
    isPending: dashboardQuery.isPending,
    isFetching: dashboardQuery.isFetching,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  };
}
export default useDashboard;
