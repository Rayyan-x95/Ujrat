import { supabase } from '@/shared/lib/supabaseClient';
import { sanitizeSearchTerm } from '@/shared/utils/sanitize';
import { getPaginationBounds, toPaginatedResult, softDeleteRecord } from '@/shared/utils/repository';
import type { Payment, PaymentInsert, PaymentUpdate, QueryOptions, PaginatedResult } from '@/shared/types';

export class PaymentRepository {
  private static readonly sortableColumns = new Set(['created_at', 'payment_date', 'amount', 'status']);

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

    const sortBy = options.sortBy && this.sortableColumns.has(options.sortBy)
      ? options.sortBy
      : 'created_at';
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
    // Whitelist mutable fields — callers must not smuggle privileged columns
    // (e.g. status: 'completed') through the insert payload.
    const insertPayload = {
      workspace_id: workspaceId,
      invoice_id: paymentData.invoice_id,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method || 'UPI',
      transaction_reference: paymentData.transaction_reference,
      payment_date: paymentData.payment_date,
      status: 'pending' as const,
      notes: paymentData.notes || null,
      verifier_id: null,
      verified_at: null,
    };
    const { data, error } = await supabase
      .from('payments')
      .insert(insertPayload)
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
    notes?: string,
    // Optimistic concurrency: when supplied, the update only applies if the
    // row is still in this status, so a second verifier racing a settled
    // payment matches zero rows instead of writing over the first decision.
    expectedStatus?: Payment['status']
  ): Promise<Payment> {
    const updateData: PaymentUpdate = {
      status,
      verifier_id: verifierId,
      verified_at: new Date().toISOString(),
      notes: notes || null,
    };

    let query = supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .eq('workspace_id', workspaceId);

    if (expectedStatus !== undefined) {
      query = query.eq('status', expectedStatus);
    }

    const { data, error } = await query.select().single();

    if (error) throw new Error(error.message);
    return data as Payment;
  }

  static async softDelete(workspaceId: string, id: string): Promise<void> {
    return softDeleteRecord('payments', workspaceId, id);
  }
}