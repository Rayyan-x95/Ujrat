import { supabase } from '@/shared/lib/supabaseClient';
import type { Payment, PaymentInsert, PaymentUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class PaymentRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Payment>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      query = query.or(`transaction_reference.ilike.%${options.search}%`);
    }

    if (options.filter?.status) {
      query = query.eq('status', options.filter.status as Payment['status']);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: (data as Payment[]) || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getById(workspaceId: string, paymentId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data as Payment;
  }

  static async getByInvoiceId(workspaceId: string, invoiceId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data as Payment[]) || [];
  }

  static async create(workspaceId: string, paymentData: PaymentInsert): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...paymentData,
        workspace_id: workspaceId,
        status: paymentData.status || 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Payment;
  }

  static async updateStatus(workspaceId: string, paymentId: string, status: Payment['status']): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .update({ status })
      .eq('id', paymentId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Payment;
  }

  static async verifyPayment(
    workspaceId: string,
    paymentId: string,
    verifierId: string,
    status: 'completed' | 'failed',
    notes?: string
  ): Promise<Payment> {
    const updateData: PaymentUpdate = {
      status,
      verifier_id: verifierId,
      verified_at: new Date().toISOString(),
      notes: notes || null,
    };

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Payment;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ deleted_at: new Date().toISOString() } as Partial<PaymentUpdate>)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  }
}