import { supabase } from '@/shared/lib/supabaseClient';
import type { Invoice, InvoiceWithItems, InvoiceInsert, InvoiceUpdate, InvoiceItemInsert, QueryOptions, PaginatedResult } from '@/shared/types';

export class InvoiceRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<InvoiceWithItems>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = (supabase.from('invoices') as any)
      .select('*, projects(id, name)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.filter?.status) {
      query = query.eq('status', String(options.filter.status));
    }
    if (options.filter?.project_id) {
      query = query.eq('project_id', String(options.filter.project_id));
    }
    if (options.search) {
      query = query.ilike('invoice_number', `%${options.search}%`);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
      .select('*, projects(id, name)')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((inv: any) => ({ ...inv, invoice_items: [] }));
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
    const { data, error } = await (supabase.from('invoices') as any)
      .update(invoiceData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await (supabase.from('invoices') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
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
