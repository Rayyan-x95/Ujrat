import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PortalService } from '@/features/portal';

export function useClientPortal(portalToken: string) {
  const queryClient = useQueryClient();

  const portalQuery = useQuery({
    queryKey: ['portalData', portalToken],
    queryFn: async () => {
      const res = await PortalService.getPortalData(portalToken);
      if (res.success === false) throw res.error;
      return res.data;
    },
    enabled: !!portalToken,
  });

  const signContractMutation = useMutation({
    mutationFn: async ({
      signatureName,
      signatureImage,
      signatureType,
    }: {
      signatureName: string;
      signatureImage?: string | null;
      signatureType?: string;
    }) => {
      const res = await PortalService.signContract(portalToken, {
        signatureName,
        signatureImage: signatureImage ?? null,
        signatureType: signatureType ?? 'drawn',
      });
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData', portalToken] });
    },
  });

  const submitPaymentMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      method,
      reference,
    }: {
      invoiceId: string;
      amount: number;
      method: string;
      reference: string;
    }) => {
      const res = await PortalService.submitPayment(portalToken, {
        invoiceId,
        amount,
        paymentMethod: method,
        transactionReference: reference,
      });
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData', portalToken] });
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedback: string) => {
      const res = await PortalService.submitFeedback(portalToken, feedback);
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData', portalToken] });
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await PortalService.approveProposal(portalToken);
      if (res.success === false) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData', portalToken] });
    },
  });

  const downloadDeliverable = async (fileUrl: string) => {
    const res = await PortalService.getSignedDownloadUrl(portalToken, fileUrl);
    if (res.success === false) throw res.error;
    return res.data;
  };

  const startCardPayment = async (invoiceId: string) => {
    const res = await PortalService.startStripeCheckout(portalToken, invoiceId);
    if (res.success === false) throw res.error;
    return res.data;
  };

  return {
    portalData: portalQuery.data || null,
    isLoading: portalQuery.isLoading,
    error: portalQuery.error,
    refetch: portalQuery.refetch,
    signContract: signContractMutation.mutateAsync,
    submitPayment: submitPaymentMutation.mutateAsync,
    submitFeedback: submitFeedbackMutation.mutateAsync,
    approveProposal: approveProposalMutation.mutateAsync,
    downloadDeliverable,
    startCardPayment,
  };
}

export default useClientPortal;
