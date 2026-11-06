import { supabase } from '@/shared/lib/supabaseClient';
import { getListPage, softDeleteRecord } from '@/shared/utils/repository';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import type { Invoice, InvoiceStatus, InvoiceWithItems, InvoiceInsert, InvoiceUpdate, InvoiceItemInsert, QueryOptions, PaginatedResult } from '@/shared/types';

// List columns only — detail rows come from getById.
export const INVOICE_LIST_COLUMNS =
  'id,invoice_number,status,invoice_date,due_date,subtotal,cgst,sgst,igst,total,outstanding_balance,currency,project_id,created_at,projects(id,name,portal_token)';

export class InvoiceRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<InvoiceWithItems>> {
    let query = (supabase.from('invoices') as any)
      .select(INVOICE_LIST_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.filter?.status) {
      query = query.eq('status', String(options.filter.status));
    }
    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
    }
    if (options.search) {
      query = query.ilike('invoice_number', `%${sanitizeSearchTerm(options.search)}%`);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    return getListPage<InvoiceWithItems>(query, options);
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
    const { data, error } = await (supabase.from('invoices') as any)
      .select('*, invoice_items(*)')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []);
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
    {
      const { data, error } = await (supabase.rpc as any)('create_invoice_transactional', {
        p_workspace_id: workspaceId,
        p_invoice_data: {
          ...invoiceData,
          id: invoiceId,
          outstanding_balance: invoiceData.outstanding_balance ?? invoiceData.total,
        },
        p_invoice_items: itemsToInsert,
      });

      if (error) {
        const msg = String(error?.message || '').toLowerCase();
        const missingFn = msg.includes('could not find') || msg.includes('does not exist') || msg.includes('schema cache') || error?.code === 'PGRST202';
        if (!missingFn) {
          throw new Error(error.message || 'Invoice transactional RPC failed');
        }
        console.error('[InvoiceRepository] create_invoice_transactional unavailable, using fallback:', error.message);
      } else if (data?.invoice) {
        return {
          ...data.invoice,
          invoice_items: data.invoice_items || [],
        } as InvoiceWithItems;
      }
    }

    const { data: invoice, error: invErr } = await (supabase.from('invoices') as any)
      .insert({
        ...invoiceData,
        id: invoiceId,
        workspace_id: workspaceId,
        // F4: invoices are always born as drafts; issuing is an UPDATE.
        status: 'draft',
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
        // Compensating rollback for the just-created header. Scoped to this
        // workspace (defense in depth — RLS already bounds this, but a
        // bare-id delete is one keystroke from cross-tenant if RLS ever
        // loosens) and soft-deleted rather than hard-deleted, matching
        // every other delete path.
        await (supabase.from('invoices') as any)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId);
        throw new Error(itemsErr.message || 'Failed to create invoice items');
      }
      insertedItems = inserted || [];
    }

    return {
      ...invoice,
      invoice_items: insertedItems,
    } as any;
  }

  static async update(workspaceId: string, id: string, invoiceData: InvoiceUpdate, expectedStatus?: InvoiceStatus): Promise<Invoice> {
    let query = (supabase.from('invoices') as any).update(invoiceData).eq('id', id).eq('workspace_id', workspaceId);

    if (expectedStatus !== undefined) {
      // Optimistic concurrency: the verify path re-checks the status it
      // computed from, so a concurrent settlement can't be overwritten.
      query = query.eq('status', expectedStatus);
    }

    const { data, error } = await query.select().single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return softDeleteRecord('invoices', workspaceId, id);
  }

  static async markInvoicePaidTransactional(workspaceId: string, profileId: string, id: string): Promise<{ success: boolean; invoice?: Invoice; error?: Error }> {
    try {
      const { data, error } = await (supabase.rpc as any)('mark_invoice_paid_transactional', {
        p_workspace_id: workspaceId,
        p_profile_id: profileId,
        p_invoice_id: id,
      });

      if (error) {
        throw new Error(error.message || 'Failed to mark invoice as paid');
      }

      return {
        success: true,
        invoice: data?.invoice,
      };
    } catch (e: unknown) {
      return { success: false, error: e as Error };
    }
  }
}
