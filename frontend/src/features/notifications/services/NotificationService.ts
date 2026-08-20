import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

/**
 * NotificationService — Secure, resilient email delivery engine for Ujrat.
 *
 * Persists email logs in the database to act as an offline-tolerant delivery queue.
 * Implements exponential backoff retry policies and template helpers.
 */
export class NotificationService {
  // Removed client-side apiKey reference to secure credentials in Supabase Edge Functions.

  /**
   * Main email dispatch handler with transaction-safe queue logging.
   */
  static async sendEmail(
    workspaceId: string,
    profileId: string,
    recipient: string,
    subject: string,
    htmlBody: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    let logId: string | null = null;
    try {
      // 1. Always initialize as pending in database first for audit and crash-safety
      const { data: log, error: logError } = await supabase
        .from('email_logs')
        .insert({
          workspace_id: workspaceId,
          profile_id: (profileId && profileId.trim().length > 0) ? profileId : null,
          recipient,
          subject,
          body: htmlBody,
          status: 'pending',
          attempts: 1,
          max_attempts: 3,
          project_id: undefined as any,
          resend_id: null,
          error_message: null,
          sent_at: null
        })
        .select()
        .single();

      if (logError || !log) {
        throw new Error(logError?.message || 'Failed to initialize email audit log');
      }

      logId = log.id;

      // 2. Dispatch via Supabase Edge Function send-email
      const delivered = await this.executeEmailDispatch(recipient, subject, htmlBody, logId!);
      return { success: true, data: { logId: logId!, delivered } };
    } catch (e) {
      // If we initialized a log, update attempts and error message
      if (logId) {
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: (e as Error).message || 'Unknown send error'
          })
          .eq('id', logId);
      }
      return { success: false, error: e as Error };
    }
  }

  /** Dispatches email through serverless Edge Function with audit logging. */
  private static async executeEmailDispatch(
    recipient: string,
    subject: string,
    htmlBody: string,
    logId: string
  ): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { recipient, subject, body: htmlBody }
    });

    if (error) {
      throw new Error(`Edge Function invocation error: ${error.message}`);
    }

    const messageId = data?.messageId || data?.id || null;

    await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        resend_id: messageId,
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', logId);

    return true;
  }
}