/**
 * Ujrat Payment System - Payment Audit Service
 * Non-Blocking Audit Logger for Statutory Traceability
 */

import { supabase } from '@/shared/lib/supabaseClient';

export class PaymentAuditService {
  /**
   * Log payment event into payment_audit_logs table
   */
  static async logEvent(
    workspaceId: string,
    invoiceId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    await (supabase as any).from('payment_audit_logs').insert({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      event_type: eventType,
      payload,
      performed_by: userId || null,
    }).catch(() => {});
  }
}
