import { supabase } from '@/shared/lib/supabaseClient';
import type { Invoice, InvoiceWithItems, InvoiceInsert, InvoiceUpdate, InvoiceItemInsert, QueryOptions, PaginatedResult } from '@/shared/types';
import { buildPaginatedQuery, buildGetByIdQuery, buildGetByProjectIdQuery, buildUpdateQuery, buildSoftDeleteQuery } from '@/shared/lib/queryBuilder';

export class InvoiceRepository {
  private static readonly config = {
    table: 'invoices',
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
    const invoice = await buildGetByIdQuery<Invoice>(workspaceId, id, this.config.table);
    if (!invoice) return null;

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .eq('workspace_id', workspaceId);

    return {
      ...invoice,
      invoice_items: items || [],
    };
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

    const itemsToInsert = items.map(item => ({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      gst_rate: item.gst_rate,
      hsn_code: item.hsn_code ?? null,
      amount: item.amount,
    }));

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
