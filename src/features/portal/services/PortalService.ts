import { PortalRepository } from '@/features/portal';
import type { Project, Client, WorkspaceSettings, Proposal, Contract, InvoiceWithItems, Deliverable, Result } from '@/shared/types';
import { PaymentSchema, ContractSignatureSchema } from '@/shared/validation/schemas';
import { supabase } from '@/shared/lib/supabaseClient';

export interface PortalData {
  project: Project;
  client: Client | null;
  settings: WorkspaceSettings | null;
  proposal: Proposal | null;
  contract: Contract | null;
  invoices: InvoiceWithItems[];
  deliverables: Deliverable[];
}

import { ContractStateMachine, InvoiceStateMachine } from '@/shared/utils/StateMachine';

export class PortalService {
  static async getPortalData(token: string): Promise<Result<PortalData>> {
    try {
      if (!token) throw new Error('Portal token is required');

      // Fetch all portal info in parallel securely
      const [project, client, settings, proposal, contract, invoices, deliverables] = await Promise.all([
        PortalRepository.getProject(token),
        PortalRepository.getClient(token),
        PortalRepository.getSettings(token),
        PortalRepository.getProposal(token),
        PortalRepository.getContract(token),
        PortalRepository.getInvoices(token),
        PortalRepository.getDeliverables(token),
      ]);

      if (!project) throw new Error('Invalid security token or project not found');

      return {
        success: true,
        data: {
          project,
          client,
          settings,
          proposal,
          contract,
          invoices,
          deliverables,
        },
      };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async generateVerificationCode(token: string): Promise<Result<string>> {
    try {
      const email = await PortalRepository.generateVerificationCode(token);
      try {
        const { error: funcErr } = await supabase.functions.invoke('send-email', {
          body: { portalToken: token }
        });
        if (funcErr) {
          console.error('[PortalService] Failed to trigger OTP email dispatch:', funcErr);
        }
      } catch (invokeErr) {
        console.error('[PortalService] Exception during OTP email invoke:', invokeErr);
      }
      return { success: true, data: email };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async verifyCode(token: string, code: string): Promise<Result<boolean>> {
    try {
      const isVerified = await PortalRepository.verifyCode(token, code);
      return { success: true, data: isVerified };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async signContract(
    token: string,
    signatureData: { signatureName: string; ipAddress?: string | null; emailVerified: boolean }
  ): Promise<Result<void>> {
    try {
      if (!signatureData.emailVerified) {
        throw new Error('Identity verification required before signing.');
      }

      const contract = await PortalRepository.getContract(token);
      if (!contract) {
        throw new Error('Contract details not found.');
      }

      // Enforce State Machine validation
      const nextStatus = 'signed';
      if (!ContractStateMachine.validate(contract.status as any, nextStatus as any)) {
        throw new Error(`Invalid contract transition from '${contract.status}' to '${nextStatus}'`);
      }

      // Validate digital signature data using Zod
      const validated = ContractSignatureSchema.parse({
        signature_name: signatureData.signatureName,
        ip_address: signatureData.ipAddress,
      });

      await PortalRepository.submitSignature(
        token,
        validated.signature_name,
        validated.ip_address || '',
        true
      );

      return { success: true, data: undefined };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async submitPayment(
    token: string,
    paymentData: { invoiceId: string; amount: number; paymentMethod?: string; transactionReference: string }
  ): Promise<Result<void>> {
    try {
      const invoices = await PortalRepository.getInvoices(token);
      const invoice = invoices.find(i => i.id === paymentData.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Enforce State Machine validation
      const nextStatus = 'pending_verification';
      if (!InvoiceStateMachine.validate(invoice.status as any, nextStatus)) {
        throw new Error(`Invalid invoice transition from '${invoice.status}' to '${nextStatus}'`);
      }

      // Validate payment notification using Zod
      const validated = PaymentSchema.parse({
        invoice_id: paymentData.invoiceId,
        amount: paymentData.amount,
        payment_method: paymentData.paymentMethod || 'UPI',
        transaction_reference: paymentData.transactionReference,
      });

      try {
        await PortalRepository.submitPayment(
          token,
          validated.invoice_id,
          validated.amount,
          validated.payment_method || 'UPI',
          validated.transaction_reference
        );
      } catch (err: any) {
        if (err.message.includes('unique_transaction_reference') || err.message.includes('duplicate key')) {
          throw new Error('This transaction reference (UTR) has already been submitted for payment.');
        }
        throw err;
      }

      return { success: true, data: undefined };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async submitFeedback(token: string, feedback: string): Promise<Result<void>> {
    try {
      if (!feedback.trim()) throw new Error('Feedback content cannot be empty');
      await PortalRepository.submitFeedback(token, feedback);
      return { success: true, data: undefined };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async approveProposal(token: string): Promise<Result<void>> {
    try {
      await PortalRepository.approveProposal(token);
      return { success: true, data: undefined };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }

  static async getSignedDownloadUrl(token: string, fileUrl: string): Promise<Result<string>> {
    try {
      const project = await PortalRepository.getProject(token);
      if (!project) {
        throw new Error('Unauthorized portal token');
      }
      const deliverables = await PortalRepository.getDeliverables(token);
      const hasDeliverable = deliverables.some(d => d.file_url === fileUrl);
      if (!hasDeliverable) {
        throw new Error('Access denied: Deliverable does not belong to this project');
      }
      // Call Edge Function to safely generate signed URL via admin privileges server-side
      const { data, error } = await supabase.functions.invoke('create-signed-url', {
        body: { token, filePath: fileUrl, bucket: 'deliverables' }
      });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Failed to generate signed URL');
      }
      return { success: true, data: data.signedUrl };
    } catch (e: any) {
      return { success: false, error: e };
    }
  }
}
