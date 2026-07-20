import { EmailLogRepository } from '@/features/auth/repositories/EmailLogRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';
import type { Result, EmailLog, Invoice } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';

export class InvoiceGatewayService {
  static async getEmailLogs(workspaceId: string, projectId: string): Promise<Result<EmailLog[]>> {
    try {
      const data = await EmailLogRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async generateInvoice(
    workspaceId: string,
    profileId: string,
    projectId: string,
    invoiceData: {
      invoice_number: string;
      amount: number;
      note: string;
    }
  ): Promise<Result<Invoice>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const invoice = await InvoiceService.createInvoice(workspaceId, profileId, projectId, {
        invoice_number: invoiceData.invoice_number,
        invoice_date: new Date().toISOString().split('T')[0] || '',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
        notes: invoiceData.note || '',
        items: [{
          description: invoiceData.note || 'Project milestone',
          quantity: 1,
          rate: invoiceData.amount,
          gst_rate: 18,
          hsn_code: '998314',
        }],
      });

      if (!invoice.success) {
        throw invoice.error || new Error('Failed to generate invoice');
      }

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: 'Invoice Generated',
        details: { invoiceId: invoice.data.id, invoiceNumber: invoice.data.invoice_number, amount: invoiceData.amount },
      });

      return { success: true, data: invoice.data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
