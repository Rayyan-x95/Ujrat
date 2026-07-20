import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectService } from '../services/ProjectService';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';
import { PaymentService } from '@/features/payments/services/PaymentService';
import { StorageService } from '@/features/settings/services/StorageService';

interface UseProjectDetailsOptions {
  workspaceId: string;
  profileId: string;
  projectId: string;
  onShowInvoice: (invoiceId: string) => void;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

function unwrapResult<T>(result: { success: true; data: T } | { success: false; error: Error }): T {
  if (!result.success) throw result.error;
  return result.data;
}

export function useProjectDetails({
  workspaceId,
  profileId,
  projectId,
  onShowInvoice,
  addToast,
}: UseProjectDetailsOptions) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'brief' | 'proposal' | 'contract' | 'deliverables' | 'invoices' | 'emails'>('brief');

  // Project details query
  const { data: projectResult, isLoading, error } = useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: async () => {
      const res = await ProjectService.getProjectDetails(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const project = projectResult || null;

  // Proposal query
  const { data: proposalResult } = useQuery({
    queryKey: ['proposal', workspaceId, projectId],
    queryFn: async () => {
      const res = await ProjectService.getProposal(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const proposal = proposalResult || null;

  // Contract query
  const { data: contractResult } = useQuery({
    queryKey: ['contract', workspaceId, projectId],
    queryFn: async () => {
      const res = await ProjectService.getContract(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const contract = contractResult || null;

  // Invoices query
  const { data: invoicesResult } = useQuery({
    queryKey: ['invoices', workspaceId, projectId],
    queryFn: async () => {
      const res = await InvoiceService.getInvoicesByProject(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const invoices = invoicesResult?.data || [];

  // Deliverables query
  const { data: deliverablesResult } = useQuery({
    queryKey: ['deliverables', workspaceId, projectId],
    queryFn: async () => {
      const res = await ProjectService.getDeliverables(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const deliverables = deliverablesResult || [];

  // Email logs query
  const { data: emailLogsResult } = useQuery({
    queryKey: ['emailLogs', workspaceId, projectId],
    queryFn: async () => {
      const res = await ProjectService.getEmailLogs(workspaceId, projectId);
      return unwrapResult(res);
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  const emailLogs = emailLogsResult || [];

  // Proposal mutations - matching template's expected interface
  const saveProposal = useMutation({
    mutationFn: async (data: { proposalId: string | undefined; proposalData: any; status: 'draft' | 'sent' }) =>
      unwrapResult(await ProjectService.saveProposal(workspaceId, profileId, projectId, data.proposalId, data.proposalData, data.status)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Proposal Saved', 'Draft saved successfully');
    },
    onError: (e: any) => addToast('error', 'Save Failed', e.message),
  });

  const sendProposal = useMutation({
    mutationFn: async (data: { proposalId: string | undefined; proposalData: any; status: 'draft' | 'sent' }) =>
      unwrapResult(await ProjectService.saveProposal(workspaceId, profileId, projectId, data.proposalId, data.proposalData, data.status)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Proposal Sent', 'Proposal has been shared with the client');
    },
    onError: (e: any) => addToast('error', 'Send Failed', e.message),
  });

  // Contract mutations - matching template's expected interface (content, status)
  const saveContract = useMutation({
    mutationFn: async (args: [string, 'draft' | 'sent']) =>
      unwrapResult(await ProjectService.saveContract(workspaceId, profileId, projectId, contract?.id, args[0], args[1])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, projectId] });
      addToast('success', 'Contract Saved', 'Draft saved successfully');
    },
    onError: (e: any) => addToast('error', 'Save Failed', e.message),
  });

  const sendContract = useMutation({
    mutationFn: async (args: [string, 'draft' | 'sent']) =>
      unwrapResult(await ProjectService.saveContract(workspaceId, profileId, projectId, contract?.id, args[0], args[1])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Contract Sent', 'Contract has been shared with the client');
    },
    onError: (e: any) => addToast('error', 'Send Failed', e.message),
  });

  const signContract = useMutation({
    mutationFn: async (signatureData: { signature_name: string; ip_address?: string; }) =>
      unwrapResult(await ProjectService.signContract(workspaceId, profileId, projectId, contract?.id || '', signatureData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Contract Signed', 'Signature recorded successfully');
    },
    onError: (e: any) => addToast('error', 'Sign Failed', e.message),
  });

  // Deliverable mutations
  const uploadDeliverable = useMutation({
    mutationFn: async (file: File) => {
      const uploadRes = await StorageService.uploadFile(workspaceId, 'deliverables', `${projectId}/${crypto.randomUUID()}-${file.name}`, file);
      if (!uploadRes.success) throw uploadRes.error;
      return ProjectService.addDeliverable(workspaceId, profileId, projectId, {
        name: file.name,
        file_url: uploadRes.data.path,
        file_type: file.type,
        file_size: file.size,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', workspaceId, projectId] });
      addToast('success', 'Deliverable Uploaded', 'File uploaded successfully');
    },
    onError: (e: any) => addToast('error', 'Upload Failed', e.message),
  });

  const addDeliverableLink = useMutation({
    mutationFn: (data: { name: string; linkUrl: string }) =>
      ProjectService.addDeliverableLink(workspaceId, profileId, projectId, data.name, data.linkUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', workspaceId, projectId] });
      addToast('success', 'Link Added', 'External link saved as deliverable');
    },
    onError: (e: any) => addToast('error', 'Add Failed', e.message),
  });

  // Invoice mutations - matching template's expected interface
  const generateInvoice = useMutation({
    mutationFn: async (args: [string, number, string]) =>
      unwrapResult(await ProjectService.generateInvoice(workspaceId, profileId, projectId, {
        invoice_number: args[0],
        amount: args[1],
        note: args[2],
      })),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      if (invoice.id) onShowInvoice(invoice.id);
      addToast('success', 'Invoice Generated', 'Invoice created successfully');
    },
    onError: (e: any) => addToast('error', 'Generation Failed', e.message),
  });

  // Payment mutations
  const submitPayment = useMutation({
    mutationFn: async (data: { invoice_id: string; amount: number; payment_method?: string; transaction_reference: string }) =>
      unwrapResult(await PaymentService.submitPayment(workspaceId, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Payment Submitted', 'Payment reference sent for verification');
    },
    onError: (e: any) => addToast('error', 'Submit Failed', e.message),
  });

  const verifyPayment = useMutation({
    mutationFn: async (data: { paymentId: string; status: 'completed' | 'failed'; notes?: string }) =>
      unwrapResult(await PaymentService.verifyPayment(workspaceId, profileId, data.paymentId, data.status, data.notes)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Payment Verified', 'Payment status updated');
    },
    onError: (e: any) => addToast('error', 'Verification Failed', e.message),
  });

  // Status change mutation
  const changeStatus = useMutation({
    mutationFn: (status: string) => ProjectService.updateProjectStatus(workspaceId, profileId, projectId, status as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId, profileId] });
      addToast('success', 'Status Updated', 'Project status changed successfully');
    },
    onError: (e: any) => addToast('error', 'Status Change Failed', e.message),
  });

  return {
    project,
    proposal,
    contract,
    invoices,
    deliverables,
    emailLogs,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    saveProposal: saveProposal.mutateAsync,
    sendProposal: sendProposal.mutateAsync,
    saveContract: saveContract.mutateAsync,
    sendContract: sendContract.mutateAsync,
    signContract: signContract.mutateAsync,
    uploadDeliverable: uploadDeliverable.mutateAsync,
    addDeliverableLink: addDeliverableLink.mutateAsync,
    generateInvoice: generateInvoice.mutateAsync,
    submitPayment: submitPayment.mutateAsync,
    verifyPayment: verifyPayment.mutateAsync,
    changeStatus: changeStatus.mutateAsync,
  };
}