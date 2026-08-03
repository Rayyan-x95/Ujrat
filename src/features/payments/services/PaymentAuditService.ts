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
    const insertPayload = {
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      event_type: eventType,
      payload,
      performed_by: userId || null,
    };

    try {
      const dbPromise = (supabase as any).from('payment_audit_logs').insert(insertPayload);

      const raceResult = await Promise.race([
        dbPromise,
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 100)),
      ]) as any;

      if (raceResult && raceResult.error) {
        console.error('[PaymentAuditService] Audit log insert error:', raceResult.error);
        dbPromise.catch((err: any) => {
          console.error('[PaymentAuditService] Background audit insert error:', err);
        });
      } else if (raceResult?.timeout) {
        dbPromise.catch((err: any) => {
          console.error('[PaymentAuditService] Delayed background audit insert error:', err);
        });
      }
    } catch (e: any) {
      console.error('[PaymentAuditService] Audit logging exception:', e);
    }
  }
}
