import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { InvoiceSchema } from '@/shared/validation/schemas';
import type { Invoice, InvoiceWithItems, Result, QueryOptions, PaginatedResult, InvoiceStatus } from '@/shared/types';

import { InvoiceStateMachine } from '@/shared/utils/StateMachine';
import { ClientRepository } from '@/features/clients/repositories/ClientRepository';
import { WorkspaceService } from '@/features/workspace/services/WorkspaceService';
import { determineGSTType, calculateGST } from '@/features/invoices/utils/TaxEngine';
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
      if (!project) {
        throw new Error('Project not found');
      }

      const client = await ClientRepository.getById(workspaceId, project.client_id);
      if (!client) {
        throw new Error('Client not found');
      }

      // Determine GST type - expects objects with is_gst_registered, state, gstin
      const workspaceSettingsResult = await WorkspaceService.getSettings(workspaceId);
      if (!workspaceSettingsResult.success || !workspaceSettingsResult.data) {
        throw new Error('Failed to load workspace settings');
      }
      const workspaceSettings = workspaceSettingsResult.data;
      const freelancer = {
        is_gst_registered: workspaceSettings.is_gst_registered || false,
        state: workspaceSettings.state,
        gstin: workspaceSettings.gstin,
      };
      const clientData = {
        state: client.state,
        gstin: client.gstin,
      };
      const gstType = determineGSTType(freelancer, clientData);

      // Calculate GST for each item
      const itemsWithGST = validated.items.map(item => {
        const { cgst, sgst, igst, total: amount } = calculateGST(
          item.rate * item.quantity,
          item.gst_rate,
          gstType.isInterstate,
          gstType.isZeroRated
        );
        return {
          ...item,
          hsn_code: item.hsn_code ?? null,
          cgst,
          sgst,
          igst,
          amount,
        };
      });

      // Calculate totals
      const subtotal = itemsWithGST.reduce((sum, item) => sum + item.rate * item.quantity, 0);
      const cgst = itemsWithGST.reduce((sum, item) => sum + item.cgst, 0);
      const sgst = itemsWithGST.reduce((sum, item) => sum + item.sgst, 0);
      const igst = itemsWithGST.reduce((sum, item) => sum + item.igst, 0);
      const total = subtotal + cgst + sgst + igst;

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

        if (lastInvoice) {
          serial_number = lastInvoice.serial_number + 1;
        } else {
          serial_number = 1;
        }

        finalInvoiceNumber = `${prefix}-${year}-${String(serial_number).padStart(4, '0')}`;
      } else {
        // Parse existing invoice number to extract prefix, year, serial
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
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          status: 'draft',
          pdf_url: null,
          freelancer_gstin: workspaceSettings?.gstin,
          client_gstin: client.gstin,
          freelancer_state: workspaceSettings?.state,
          client_state: client.state,
          is_interstate: gstType.isInterstate,
          is_zero_rated: gstType.isZeroRated,
          is_reverse_charge: gstType.isReverseCharge,
          outstanding_balance: total,
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