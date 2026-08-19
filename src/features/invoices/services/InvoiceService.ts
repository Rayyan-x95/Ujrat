import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { InvoiceSchema } from '@/shared/validation/schemas';
import type { Invoice, InvoiceWithItems, Result, QueryOptions, PaginatedResult, InvoiceStatus } from '@/shared/types';
import { InvoiceStateMachine } from '@/shared/utils/StateMachine';
import { WorkspaceService } from '@/features/workspace/services/WorkspaceService';
import { calculateInvoiceTax } from '@/features/invoices/utils/TaxEngine';
import { supabase } from '@/shared/lib/supabaseClient';
import { LoggingService } from '@/features/auth/services/LoggingService';

export class InvoiceService {
  static async listInvoices(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<InvoiceWithItems>>> {
    try {
      const data = await InvoiceRepository.getAll(workspaceId, options);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getInvoiceDetails(workspaceId: string, id: string): Promise<Result<InvoiceWithItems | null>> {
    try {
      const data = await InvoiceRepository.getById(workspaceId, id);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async createInvoice(
    workspaceId: string,
    _profileId: string,
    projectId: string,
    invoiceData: {
      invoice_number: string;
      invoice_date: string;
      due_date: string;
      notes?: string | null;
      gstin?: string | null;
      items: {
        description: string;
        quantity: number;
        rate: number;
        gst_rate: number;
        hsn_code?: string | null;
      }[];
      freelancer_gstin?: string | null;
      client_gstin?: string | null;
      freelancer_state?: string | null;
      client_state?: string | null;
    }
  ): Promise<Result<InvoiceWithItems>> {
    try {
      // Validate invoice data using Zod
      const validated = InvoiceSchema.parse({
        ...invoiceData,
        project_id: projectId,
        workspace_id: workspaceId,
      });

      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Project not found');

      const client = project.clients;
      if (!client) throw new Error('Client not found');

      const workspaceSettingsResult = await WorkspaceService.getSettings(workspaceId);
      if (!workspaceSettingsResult.success || !workspaceSettingsResult.data) {
        throw new Error('Failed to load workspace settings');
      }
      const workspaceSettings = workspaceSettingsResult.data;

      const { breakdown, lineItems } = calculateInvoiceTax({
        freelancer: {
          is_gst_registered: workspaceSettings.is_gst_registered || false,
          state: workspaceSettings.state,
          gstin: workspaceSettings.gstin,
          tax_scheme: (workspaceSettings.tax_scheme as any) || 'regular',
          lut_number: workspaceSettings.lut_number,
        },
        client: {
          state: client.state,
          gstin: client.gstin,
        },
        items: validated.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          hsn_code: item.hsn_code ?? null,
          sac_code: item.sac_code ?? null,
          unit: item.unit || 'NOS',
          discount_amount: item.discount_amount || 0,
          cess_rate: item.cess_rate || 0,
        })),
        currency: (validated.currency as any) || 'INR',
        exchangeRate: validated.exchange_rate || 1,
      });

      const itemsWithGST = lineItems.map((li, idx) => ({
        description: validated.items[idx]?.description ?? li.description,
        quantity: validated.items[idx]?.quantity ?? li.quantity,
        rate: validated.items[idx]?.rate ?? li.rate,
        gst_rate: validated.items[idx]?.gst_rate ?? li.gst_rate,
        hsn_code: li.hsn_code || null,
        sac_code: li.sac_code || null,
        unit: li.unit || 'NOS',
        cess_rate: li.cess_rate,
        discount_amount: li.discount_amount,
        cgst: li.cgst_amount,
        sgst: li.sgst_amount,
        igst: li.igst_amount,
        amount: li.line_total,
      }));

      // Generate invoice number with prefix, year, and serial
      let prefix = validated.prefix || 'INV';
      let finalInvoiceNumber = validated.invoice_number;
      let serial_number: number = 0;
      let year: number = 0;

      if (!validated.invoice_number) {
        const now = new Date();
        year = now.getFullYear();

        const { data: lastInvoice } = await supabase
          .from('invoices')
          .select('serial_number, year')
          .eq('workspace_id', workspaceId)
          .eq('year', year)
          .eq('prefix', prefix)
          .order('serial_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        serial_number = lastInvoice ? lastInvoice.serial_number + 1 : 1;
        finalInvoiceNumber = `${prefix}-${year}-${String(serial_number).padStart(4, '0')}`;
      } else {
        const parts = validated.invoice_number.split('-');
        if (parts.length >= 3) {
          prefix = parts[0] || 'INV';
          year = parseInt(parts[1] || String(new Date().getFullYear()), 10);
          serial_number = parseInt(parts[2] || '0', 10);
        }
      }

      // Create invoice
      const newInvoice = await InvoiceRepository.create(
        workspaceId,
        {
          workspace_id: workspaceId,
          project_id: projectId,
          invoice_number: finalInvoiceNumber,
          invoice_date: validated.invoice_date,
          due_date: validated.due_date,
          notes: validated.notes ?? null,
          gstin: validated.gstin ?? null,
          subtotal: breakdown.subtotal,
          cgst: breakdown.cgst,
          sgst: breakdown.sgst,
          igst: breakdown.igst,
          total: breakdown.grand_total,
          status: 'draft',
          pdf_url: null,
          freelancer_gstin: workspaceSettings?.gstin,
          client_gstin: client.gstin,
          freelancer_state: workspaceSettings?.state,
          client_state: client.state,
          is_interstate: breakdown.is_interstate,
          is_zero_rated: breakdown.is_zero_rated,
          is_reverse_charge: breakdown.is_reverse_charge,
          outstanding_balance: breakdown.grand_total,
          prefix,
          year,
          serial_number,
          revision_number: 0,
        },
        itemsWithGST
      );

      return { success: true, data: newInvoice };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updateInvoiceStatus(
    workspaceId: string,
    profileId: string,
    id: string,
    status: InvoiceStatus
  ): Promise<Result<Invoice>> {
    try {
      const currentInvoice = await InvoiceRepository.getById(workspaceId, id);
      if (!currentInvoice) {
        throw new Error('Invoice not found');
      }

      const currentStatus = currentInvoice.status as InvoiceStatus;
      if (currentStatus !== status) {


        const transition = InvoiceStateMachine.transition(currentStatus as InvoiceStatus, status as InvoiceStatus, {
          invoiceId: id,
          invoiceNumber: currentInvoice.invoice_number,
        });

        await LoggingService.logActivity({
          workspaceId,
          profileId,
          action: transition.activityLog.action,
          details: transition.activityLog.details,
        });
      }

      const invoice = await InvoiceRepository.update(workspaceId, id, { status });
      return { success: true, data: invoice };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async markInvoicePaid(workspaceId: string, profileId: string, id: string): Promise<Result<Invoice>> {
    try {
      const result = await InvoiceRepository.markInvoicePaidTransactional(workspaceId, profileId, id);
      if (!result.success || !result.invoice) {
        throw result.error || new Error('Failed to mark invoice as paid');
      }
      return { success: true, data: result.invoice };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getInvoicesByProject(
    workspaceId: string,
    projectId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<InvoiceWithItems>>> {
    try {
      const data = await InvoiceRepository.getAll(workspaceId, {
        ...options,
        filter: { ...options.filter, project_id: projectId }
      });
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}