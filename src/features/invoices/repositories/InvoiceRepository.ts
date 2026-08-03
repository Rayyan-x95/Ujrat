import { supabase } from '@/shared/lib/supabaseClient';
import type { Invoice, InvoiceWithItems, InvoiceInsert, InvoiceUpdate, InvoiceItemInsert, QueryOptions, PaginatedResult } from '@/shared/types';
import { buildPaginatedQuery, buildGetByProjectIdQuery, buildUpdateQuery, buildSoftDeleteQuery } from '@/shared/lib/queryBuilder';

export class InvoiceRepository {
  private static readonly config = {
    table: 'invoices' as const,
    selectColumns: '*, projects(portal_token)',
    allowedFilters: ['status', 'project_id'],
    allowedSearches: ['invoice_number'],
    defaultSortBy: 'created_at',
    defaultSortOrder: 'desc' as const,
  };

  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<InvoiceWithItems>> {
    return buildPaginatedQuery<InvoiceWithItems>(workspaceId, options, this.config);
  }

  static async getById(workspaceId: string, id: string): Promise<InvoiceWithItems | null> {
    const { data, error } = await (supabase.from('invoices') as any)
      .select('*, invoice_items(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return data as InvoiceWithItems;
  }

  static async getByProjectId(workspaceId: string, projectId: string): Promise<InvoiceWithItems[]> {
    const invoices = await buildGetByProjectIdQuery<Invoice>(workspaceId, projectId, this.config.table);
    return invoices.map(inv => ({ ...inv, invoice_items: [] }));
  }

  static async create(
    workspaceId: string,
    invoiceData: InvoiceInsert,
    items: InvoiceItemInsert[]
  ): Promise<InvoiceWithItems> {
    const invoiceId = (invoiceData as any).id || crypto.randomUUID();

    const itemsToInsert = items.map(item => {
      const discount = (item as any).discount_amount ?? 0;
      const preTaxTaxable = (item as any).taxable_amount ?? Math.max(0, (item.rate * item.quantity) - discount);
      return {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        gst_rate: item.gst_rate,
        hsn_code: item.hsn_code ?? null,
        sac_code: (item as any).sac_code ?? item.hsn_code ?? null,
        unit: (item as any).unit ?? 'NOS',
        discount_amount: discount,
        taxable_amount: preTaxTaxable,
        cess_rate: (item as any).cess_rate ?? 0,
        cess_amount: (item as any).cess_amount ?? 0,
        cgst_amount: (item as any).cgst_amount ?? (item as any).cgst ?? 0,
        sgst_amount: (item as any).sgst_amount ?? (item as any).sgst ?? 0,
        igst_amount: (item as any).igst_amount ?? (item as any).igst ?? 0,
        line_total: (item as any).line_total ?? item.amount,
        amount: item.amount,
      };
    });

    // Attempt database-level atomic transaction via RPC first
    try {
      const { data, error } = await (supabase.rpc as any)('create_invoice_transactional', {
        p_workspace_id: workspaceId,
        p_invoice_data: {
          ...invoiceData,
          id: invoiceId,
          outstanding_balance: invoiceData.outstanding_balance ?? invoiceData.total,
        },
        p_invoice_items: itemsToInsert,
      });

      if (!error && data?.invoice) {
        return {
          ...data.invoice,
          invoice_items: data.invoice_items || [],
        } as InvoiceWithItems;
      }
    } catch {
      // Fallback if RPC function is not yet present on backend
    }

    const { data: invoice, error: invErr } = await (supabase.from('invoices') as any)
      .insert({
        ...invoiceData,
        id: invoiceId,
        workspace_id: workspaceId,
        outstanding_balance: invoiceData.outstanding_balance ?? invoiceData.total,
      } as any)
      .select()
      .single();

    if (invErr || !invoice) {
      throw new Error(invErr?.message || 'Failed to create invoice header');
    }

    let insertedItems: any[] = [];
    if (itemsToInsert.length > 0) {
      const { data: inserted, error: itemsErr } = await (supabase.from('invoice_items') as any)
        .insert(itemsToInsert as any[])
        .select();

      if (itemsErr) {
        await (supabase.from('invoices') as any).delete().eq('id', invoiceId);
        throw new Error(itemsErr.message || 'Failed to create invoice items');
      }
      insertedItems = inserted || [];
    }

    return {
      ...invoice,
      invoice_items: insertedItems,
    } as any;
  }

  static async update(workspaceId: string, id: string, invoiceData: InvoiceUpdate): Promise<Invoice> {
    return buildUpdateQuery<InvoiceUpdate, Invoice>(workspaceId, id, invoiceData, this.config.table);
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return buildSoftDeleteQuery(workspaceId, id, this.config.table);
  }

  static async markInvoicePaidTransactional(workspaceId: string, _profileId: string, id: string): Promise<{ success: boolean; invoice?: Invoice; error?: Error }> {
    try {
      const { data: invoice, error: invErr } = await (supabase.from('invoices') as any)
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (invErr || !invoice) {
        throw new Error(invErr?.message || 'Failed to update invoice status');
      }

      return {
        success: true,
        invoice,
      };
    } catch (e: unknown) {
      return { success: false, error: e as Error };
    }
  }
}
