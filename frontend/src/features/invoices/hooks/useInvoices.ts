import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceService } from '@/features/invoices';
import type { InvoiceItem, InvoiceWithItems, PaginatedResult } from '@/shared/types';

export function useInvoices(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', workspaceId],
    queryFn: async (): Promise<PaginatedResult<InvoiceWithItems>> => {
      // Single round-trip: repository getListPage issues one .range() +
      // count:exact (1000 = Supabase per-request cap, not a 100-row loop).
      const res = await InvoiceService.listInvoices(workspaceId, { page: 1, pageSize: 1000 });
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const addInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: {
      project_id: string;
      invoice_number: string;
      invoice_date: string;
      due_date: string;
      notes?: string | null;
      gstin?: string | null;
      isInterstate: boolean;
      items: Omit<InvoiceItem, 'id' | 'workspace_id' | 'invoice_id' | 'amount'>[];
    }) => {
      const { project_id, ...rest } = invoiceData;
      const res = await InvoiceService.createInvoice(workspaceId, profileId, project_id, rest);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await InvoiceService.markInvoicePaid(workspaceId, profileId, invoiceId);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['payments', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const editInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, ...invoiceData }: {
      invoiceId: string;
      invoice_date: string;
      due_date: string;
      notes?: string | null;
      items: { description: string; quantity: number; rate: number; gst_rate: number; hsn_code?: string | null }[];
    }) => {
      const res = await InvoiceService.editInvoiceDraft(workspaceId, profileId, invoiceId, invoiceData);
      if (res.success === false) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const removeInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await InvoiceService.removeInvoice(workspaceId, profileId, invoiceId);
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
    },
  });

  const getInvoiceDetails = async (invoiceId: string) => {
    const res = await InvoiceService.getInvoiceDetails(workspaceId, invoiceId);
    if (res.success === false) throw res.error;
    return res.data;
  };

  return {
    invoices: invoicesQuery.data?.data || [],
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    addInvoice: addInvoiceMutation.mutateAsync,
    editInvoice: editInvoiceMutation.mutateAsync,
    removeInvoice: removeInvoiceMutation.mutateAsync,
    payInvoice: payInvoiceMutation.mutateAsync,
    getInvoiceDetails,
  };
}
export default useInvoices;
