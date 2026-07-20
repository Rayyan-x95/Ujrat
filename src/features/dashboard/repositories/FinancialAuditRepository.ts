import { supabase } from '@/shared/lib/supabaseClient';
import type { FinancialEventType } from '@/shared/types';

export class FinancialAuditRepository {
  static async logEvent(params: {
    workspaceId: string;
    invoiceId?: string | null;
    paymentId?: string | null;
    eventType: FinancialEventType;
    amount?: number | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const { workspaceId, invoiceId, paymentId, eventType, amount = null, details = {} } = params;
    
    const { error } = await supabase
      .from('financial_audit_trail')
      .insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId || null,
        payment_id: paymentId || null,
        event_type: eventType,
        amount,
        details,
      });

    if (error) {
      console.error('Failed to write to financial audit trail:', error.message);
      throw new Error(`Financial audit log failed: ${error.message}`);
    }
  }
}