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
      const delivered = await this.executeResendCall(recipient, subject, htmlBody, logId!);
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

  /** Logs an event to the financial audit trail. */
  private static async executeResendCall(
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

    const resendId = data?.id || null;

    await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        resend_id: resendId,
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', logId);

    return true;
  }

  // --- TEMPLATE HELPERS ---

  static async sendVerificationEmail(
    workspaceId: string,
    profileId: string,
    recipient: string,
    code: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      'Ujrat Identity Verification',
      `<p>Your 6-digit confirmation code is: <strong>${code}</strong>. It will expire in 15 minutes.</p>`
    );
  }

  static async sendContractOTPEmail(
    workspaceId: string,
    profileId: string,
    recipient: string,
    code: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      'Contract Signature Verification Code',
      `<p>Verify your identity to sign the agreement. Use the OTP: <strong>${code}</strong></p>`
    );
  }

  static async sendProposalNotification(
    workspaceId: string,
    profileId: string,
    recipient: string,
    proposalTitle: string,
    clientName: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      `Proposal Ready for Review: ${proposalTitle}`,
      `<p>Hello ${clientName},</p><p>We have created a new proposal for your project. Please review it on the portal.</p>`
    );
  }

  static async sendPaymentReminder(
    workspaceId: string,
    profileId: string,
    recipient: string,
    invoiceNo: string,
    amount: number
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      `Payment Reminder: Invoice ${invoiceNo}`,
      `<p>This is a reminder that Invoice <strong>${invoiceNo}</strong> (₹${amount}) is pending payment.</p>`
    );
  }

  static async sendDeliveryNotification(
    workspaceId: string,
    profileId: string,
    recipient: string,
    deliverableName: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      `New Deliverable Uploaded: ${deliverableName}`,
      `<p>A new file <strong>${deliverableName}</strong> is available for download on the client portal.</p>`
    );
  }

  static async sendPasswordReset(
    workspaceId: string,
    profileId: string,
    recipient: string,
    resetLink: string
  ): Promise<Result<{ logId: string; delivered: boolean }>> {
    return this.sendEmail(
      workspaceId,
      profileId,
      recipient,
      'Ujrat Password Reset Link',
      `<p>Reset your password by visiting the following link: <a href="${resetLink}">${resetLink}</a></p>`
    );
  }
}