import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import type { Payment, PaymentInsert, PaymentUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class PaymentRepository {
  static async getAll(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Payment>> {
    const { page, pageSize, from, to } = getPaginationBounds(options);

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (options.search) {
      const term = sanitizeSearchTerm(options.search);
      if (term) {
        query = query.or(`transaction_reference.ilike.%${term}%`);
      }
    }

    if (options.filter?.status) {
      query = query.eq('status', options.filter.status as Payment['status']);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return toPaginatedResult(data as Payment[], count, page, pageSize);
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
    if (status === 'completed') {
      throw new Error('Use verifyPayment() to complete a payment — verifier attribution is required');
    }
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
    return softDeleteRecord('payments', workspaceId, id);
  }
}