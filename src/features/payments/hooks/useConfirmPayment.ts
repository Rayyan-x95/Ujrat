import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceService } from '@/features/invoices';

interface UseConfirmPaymentOptions {
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export function useConfirmPayment(workspaceId: string, profileId: string, options: UseConfirmPaymentOptions) {
  const queryClient = useQueryClient();
  const { addToast } = options;

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await InvoiceService.markInvoicePaid(workspaceId, profileId, invoiceId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Payment Confirmed', 'The invoice has been transitioned to paid.');
    },
    onError: (err: unknown) => {
      addToast('error', 'Action Failed', (err as Error).message);
    },
  });
}