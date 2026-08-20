import { useQuery } from '@tanstack/react-query';
import { PaymentService } from '@/features/payments';
import type { QueryOptions } from '@/shared/types';

export function usePayments(workspaceId: string, options: QueryOptions = {}) {
  const query = useQuery({
    queryKey: ['payments', workspaceId, options],
    queryFn: async () => {
      const res = await PaymentService.listPayments(workspaceId, options);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  return {
    paymentsResult: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export default usePayments;
