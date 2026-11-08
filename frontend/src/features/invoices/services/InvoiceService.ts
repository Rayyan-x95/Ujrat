import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { ClientRepository } from '@/features/clients/repositories/ClientRepository';
import { InvoiceSchema } from '@/shared/validation/schemas';
import type { Invoice, InvoiceWithItems, Result, QueryOptions, PaginatedResult, InvoiceStatus } from '@/shared/types';
import { InvoiceStateMachine } from '@/shared/utils/StateMachine';
import { WorkspaceService } from '@/features/workspace/services/WorkspaceService';
import { calculateInvoiceTax } from '../tax/InvoiceCalculator';
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
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Project not found');

      let client: any = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      if (!client && project.client_id) {
        client = await ClientRepository.getById(workspaceId, project.client_id);
      }
      if (!client) throw new Error('Client not found');

      const clientId = (invoiceData as any).client_id || project.client_id || client?.id;

      // Validate invoice data using Zod
      const validated = InvoiceSchema.parse({
        ...invoiceData,
        client_id: clientId,
        project_id: projectId,
        workspace_id: workspaceId,
      });

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
        // Use the engine's paise-precise taxable value instead of recomputing
        // it from the line in floating point.
        taxable_amount: li.taxable_amount,
        cgst: li.cgst_amount,
        sgst: li.sgst_amount,
        igst: li.igst_amount,
        amount: li.line_total,
      }));

      // Generate invoice number with prefix, year, and serial
      let prefix = validated.prefix || 'INV';
      let finalInvoiceNumber = validated.invoice_number;
      let serial_number: number = 0;
      let year: number = new Date().getFullYear();

      // Check if candidate invoice number already exists in this workspace
      let isDuplicate = false;
      if (finalInvoiceNumber) {
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('invoice_number', finalInvoiceNumber)
          .maybeSingle();
        if (existing) {
          isDuplicate = true;
        }
      }

      if (!finalInvoiceNumber || isDuplicate) {
        const { data: latest } = await supabase
          .from('invoices')
          .select('serial_number')
          .eq('workspace_id', workspaceId)
          .order('serial_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        let seq = (Number(latest?.serial_number) || 0) + 1;
        let candidate = `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
        finalInvoiceNumber = candidate;
        serial_number = seq;
      } else {
        const parts = validated.invoice_number.split('-');
        if (parts.length >= 3) {
          prefix = parts[0] || 'INV';
          year = parseInt(parts[1] || String(new Date().getFullYear()), 10);
          serial_number = parseInt(parts[2] || '0', 10);
        }
      }

      // Create invoice
      let newInvoice: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          newInvoice = await InvoiceRepository.create(
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
          taxable_amount: breakdown.taxable_amount,
          discount_amount: breakdown.discount_amount,
          discount_type: breakdown.discount_type,
          discount_scope: breakdown.discount_scope,
          cess_amount: breakdown.cess,
          cgst: breakdown.cgst,
          sgst: breakdown.sgst,
          igst: breakdown.igst,
          tds_section: breakdown.tds_section,
          tds_rate: breakdown.tds_rate,
          tds_amount: breakdown.tds_amount,
          net_receivable: breakdown.net_receivable,
          round_off: breakdown.round_off,
          currency: breakdown.currency,
          exchange_rate: breakdown.exchange_rate,
          exchange_rate_date: breakdown.exchange_rate_date,
          inr_total: breakdown.inr_grand_total,
          supply_type: breakdown.supply_type,
          tax_scheme: breakdown.tax_scheme,
          lut_number: workspaceSettings.lut_number ?? null,
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
          break;
        } catch (e: any) {
          const msg = String(e?.message || e).toLowerCase();
          const isDup = msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505');
          if (!isDup || attempt === 2) throw e;
          const { data: latest } = await supabase
            .from('invoices')
            .select('serial_number')
            .eq('workspace_id', workspaceId)
            .order('serial_number', { ascending: false })
            .limit(1)
            .maybeSingle();
          let seq2 = (Number(latest?.serial_number) || 0) + 1 + attempt;
          let cand = `${prefix}-${year}-${String(seq2).padStart(3, '0')}`;
          finalInvoiceNumber = cand;
          serial_number = seq2;
        }
      }

      return { success: true, data: newInvoice };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async editInvoiceDraft(
    workspaceId: string,
    profileId: string,
    id: string,
    invoiceData: {
      invoice_date: string;
      due_date: string;
      notes?: string | null;
      items: {
        description: string;
        quantity: number;
        rate: number;
        gst_rate: number;
        hsn_code?: string | null;
      }[];
    }
  ): Promise<Result<InvoiceWithItems>> {
    try {
      const current = await InvoiceRepository.getById(workspaceId, id);
      if (!current) {
        throw new Error('Invoice not found');
      }
      if (current.status !== 'draft') {
        throw new Error('Only draft invoices can be edited. Void or credit-note them instead.');
      }

      const project = await ProjectRepository.getById(workspaceId, current.project_id);
      if (!project) throw new Error('Project not found');
      let client: any = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      if (!client && project.client_id) {
        client = await ClientRepository.getById(workspaceId, project.client_id);
      }
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
        items: invoiceData.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          hsn_code: item.hsn_code ?? null,
          sac_code: null,
          unit: 'NOS',
          discount_amount: 0,
          cess_rate: 0,
        })),
        currency: (current.currency as any) || 'INR',
        exchangeRate: current.exchange_rate || 1,
      });

      const itemsWithGST = lineItems.map((li, idx) => ({
        description: invoiceData.items[idx]?.description ?? li.description,
        quantity: invoiceData.items[idx]?.quantity ?? li.quantity,
        rate: invoiceData.items[idx]?.rate ?? li.rate,
        gst_rate: invoiceData.items[idx]?.gst_rate ?? li.gst_rate,
        hsn_code: li.hsn_code || null,
        sac_code: li.sac_code || null,
        unit: li.unit || 'NOS',
        cess_rate: li.cess_rate,
        discount_amount: li.discount_amount,
        taxable_amount: li.taxable_amount,
        cgst: li.cgst_amount,
        sgst: li.sgst_amount,
        igst: li.igst_amount,
        amount: li.line_total,
      }));

      const updated = await InvoiceRepository.updateDraftTransactional(
        workspaceId,
        id,
        {
          invoice_date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          notes: invoiceData.notes ?? null,
          subtotal: breakdown.subtotal,
          taxable_amount: breakdown.taxable_amount,
          discount_amount: breakdown.discount_amount,
          discount_type: breakdown.discount_type,
          discount_scope: breakdown.discount_scope,
          cess_amount: breakdown.cess,
          cgst: breakdown.cgst,
          sgst: breakdown.sgst,
          igst: breakdown.igst,
          tds_section: breakdown.tds_section,
          tds_rate: breakdown.tds_rate,
          tds_amount: breakdown.tds_amount,
          net_receivable: breakdown.net_receivable,
          round_off: breakdown.round_off,
          inr_total: breakdown.inr_grand_total,
          supply_type: breakdown.supply_type,
          tax_scheme: breakdown.tax_scheme,
          total: breakdown.grand_total,
          outstanding_balance: breakdown.grand_total,
          is_interstate: breakdown.is_interstate,
          is_zero_rated: breakdown.is_zero_rated,
          is_reverse_charge: breakdown.is_reverse_charge,
        },
        itemsWithGST as any
      );

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId: current.project_id,
        action: 'Invoice Updated',
        details: { invoiceId: id, invoiceNumber: current.invoice_number },
      });

      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async removeInvoice(
    workspaceId: string,
    profileId: string,
    id: string
  ): Promise<Result<void>> {
    try {
      const current = await InvoiceRepository.getById(workspaceId, id);
      if (!current) {
        throw new Error('Invoice not found');
      }
      if (current.status !== 'draft') {
        throw new Error('Only draft invoices can be deleted. Void or credit-note them instead.');
      }
      const outstanding = (current as any).outstanding_balance ?? current.total ?? 0;
      if (outstanding < (current.total ?? 0)) {
        throw new Error('This invoice has recorded payments and cannot be deleted.');
      }

      await InvoiceRepository.softDelete(workspaceId, id);

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId: current.project_id,
        action: 'Invoice Deleted',
        details: { invoiceId: id, invoiceNumber: current.invoice_number },
      });

      return { success: true, data: undefined };
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
      // 'paid' settles money — it may only be set by the verified-payment
      // path (markInvoicePaid → mark_invoice_paid_transactional, which
      // requires completed payments covering the total). A direct UPDATE
      // here would settle the invoice with zero proof of payment.
      if (status === 'paid') {
        throw new Error('Use markInvoicePaid (requires a verified payment) — direct status updates cannot settle invoices');
      }

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