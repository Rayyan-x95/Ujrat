/**
 * Ujrat Payment System - Unified Payment Service
 * Handles Payment Listings, Submissions, UTR Verification, Fraud Protection & Receipt Generation
 */

import { supabase } from '@/shared/lib/supabaseClient';
import { PaymentRepository } from '@/features/payments/repositories/PaymentRepository';
import { InvoiceRepository } from '@/features/invoices/repositories/InvoiceRepository';
import type { Result, QueryOptions, PaginatedResult, Payment, InvoiceStatus } from '@/shared/types';
import { UTR_REGEX } from '../constants/PaymentConstants';
import { PaymentStateMachine, InvoiceStateMachine } from '@/shared/utils/StateMachine';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { toPaise } from '@/shared/utils/currency';

export class PaymentService {
  /**
   * Log payment event into payment_audit_logs table (inlined audit helper)
   */
  static async logEvent(
    workspaceId: string,
    invoiceId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    try {
      const { error } = await (supabase as any).from('payment_audit_logs').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        event_type: eventType,
        payload,
        performed_by: userId || null,
      });

      if (error) {
        LoggingService.logWarning(`Payment audit log insert failed: ${error.message}`, {
          workspaceId,
          invoiceId,
          eventType,
          errorCode: error.code,
        });
      }
    } catch (err: any) {
      LoggingService.logWarning(`Payment audit log exception: ${err?.message || String(err)}`, {
        workspaceId,
        invoiceId,
        eventType,
      });
    }
  }

  /**
   * Undo a just-created attempt (and payment) when a later write fails.
   * Failures are logged, never swallowed: an orphaned pending payment would
   * block every future claim on the invoice.
   */
  private static async compensateAttempt(workspaceId: string, attemptId: string, paymentId?: string): Promise<void> {
    if (paymentId) {
      // Soft-delete: a hard delete raises once the invoice has settled.
      const { error } = await (supabase.from('payments') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('workspace_id', workspaceId);
      if (error) {
        LoggingService.logWarning(`Payment compensation failed: ${error.message}`, { workspaceId, paymentId });
      }
    }
    const { error } = await (supabase as any)
      .from('payment_attempts')
      .delete()
      .eq('id', attemptId)
      .eq('workspace_id', workspaceId);
    if (error) {
      LoggingService.logWarning(`Payment attempt compensation failed: ${error.message}`, { workspaceId, attemptId });
    }
  }

  /**
   * Validates UTR 12-digit format
   */
  static validateUTR(utr: string): { isValid: boolean; error?: string } {
    if (!utr || !utr.trim()) {
      return { isValid: false, error: 'UTR number is required' };
    }
    const clean = utr.trim();
    if (!UTR_REGEX.test(clean)) {
      return { isValid: false, error: 'Invalid UTR Number. Must be exactly 12 digits (e.g. 423156789012)' };
    }
    return { isValid: true };
  }

  /**
   * Generates a UPI deep link (paise integer in). Rejects non-INR currency,
   * a malformed VPA, and non-positive / non-integer paise amounts.
   */
  static generateUpiLink(params: {
    vpa: string;
    amountPaise: number;
    note?: string;
    payeeName?: string;
    reference?: string;
    currency?: string;
  }): string {
    const currency = (params.currency || 'INR').toUpperCase();
    if (currency !== 'INR') {
      throw new Error('UPI payments require INR currency.');
    }
    const vpa = (params.vpa || '').trim();
    if (!/^[\w.-]+@[\w.-]+$/.test(vpa)) {
      throw new Error('Invalid UPI VPA.');
    }
    if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
      throw new Error('Payment amount must be a positive integer (paise).');
    }

    const query = new URLSearchParams({
      pa: vpa,
      pn: (params.payeeName || 'Payee').trim() || 'Payee',
      am: (params.amountPaise / 100).toFixed(2),
      cu: currency,
      ...(params.reference ? { tr: params.reference } : {}),
      ...(params.note?.trim() ? { tn: params.note.trim() } : {}),
    }).toString();
    return `upi://pay?${query}`;
  }

  static async listPayments(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<Payment>>> {
    try {
      const data = await PaymentRepository.getAll(workspaceId, options);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  /**
   * Client submits UTR Number and optional screenshot for an invoice
   */
  static async submitClientPaymentAttempt(
    workspaceId: string,
    params: {
      invoiceId: string;
      utrNumber: string;
      amount: number;
      screenshotUrl?: string | null;
      notes?: string | null;
    }
  ): Promise<Result<{ attemptId: string; message: string }>> {
    try {
      const utrVal = this.validateUTR(params.utrNumber);
      if (!utrVal.isValid) {
        throw new Error(utrVal.error);
      }

      const invoice = await InvoiceRepository.getById(workspaceId, params.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('This invoice has already been fully paid');
      }

      if (typeof params.amount !== 'number' || !Number.isFinite(params.amount) || params.amount <= 0) {
        throw new Error('Payment amount must be a positive finite number.');
      }
      if (Number(params.amount.toFixed(2)) !== params.amount) {
        throw new Error('Payment amount must have at most 2 decimal places.');
      }

      const outstandingBalance = invoice.outstanding_balance ?? invoice.total ?? 0;
      if (params.amount > outstandingBalance) {
        throw new Error(`Submitted payment amount (${params.amount}) exceeds outstanding invoice balance (${outstandingBalance}).`);
      }

      // Duplicate UTRs are caught by the DB unique constraint on insert below.

      let nextInvoiceStatus = invoice.status;
      if (invoice.status !== 'pending_verification') {
        const transition = InvoiceStateMachine.transition(
          invoice.status as InvoiceStatus,
          'pending_verification' as InvoiceStatus,
          { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number }
        );
        nextInvoiceStatus = transition.next as InvoiceStatus;
      }

      const attemptId = crypto.randomUUID();
      const { error: insertErr } = await (supabase as any).from('payment_attempts').insert({
        id: attemptId,
        workspace_id: workspaceId,
        invoice_id: params.invoiceId,
        payment_request_id: null,
        utr_number: params.utrNumber.trim(),
        amount: params.amount,
        screenshot_url: params.screenshotUrl || null,
        notes: params.notes || null,
        status: 'pending_verification',
      });
      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error('This 12-digit UTR Number has already been submitted.');
        }
        throw new Error(`Database error recording payment attempt: ${insertErr.message}`);
      }

      let createdPayment: Payment | null = null;
      try {
        createdPayment = await PaymentRepository.create(workspaceId, {
          workspace_id: workspaceId,
          invoice_id: params.invoiceId,
          amount: params.amount,
          payment_method: 'UPI',
          transaction_reference: params.utrNumber.trim(),
          payment_date: new Date().toISOString(),
          status: 'pending',
          notes: params.notes || null,
          verifier_id: null,
          verified_at: null,
        });
      } catch (err: any) {
        if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('23505')) {
          const { data: existingPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('transaction_reference', params.utrNumber.trim())
            .maybeSingle();

          // Only a still-pending claim is idempotent success. A completed
          // payment (e.g. gateway-reconciled) must not regress the invoice
          // back to pending_verification.
          if (existingPayment && (existingPayment.status === 'pending' || existingPayment.status === 'pending_verification')) {
            if (nextInvoiceStatus !== invoice.status) {
              await InvoiceRepository.update(workspaceId, invoice.id, { status: nextInvoiceStatus }, invoice.status as InvoiceStatus);
            }

            await this.logEvent(
              workspaceId,
              params.invoiceId,
              'UTR_SUBMITTED',
              { utr: params.utrNumber.trim(), amount: params.amount }
            );

            return {
              success: true,
              data: {
                attemptId,
                message: 'Payment attempt with this UTR has already been recorded and is pending verification.',
              },
            };
          }
          await this.compensateAttempt(workspaceId, attemptId);
          throw new Error('This 12-digit UTR Number has already been submitted.');
        }
        await this.compensateAttempt(workspaceId, attemptId);
        throw err;
      }

      if (!createdPayment) {
        await this.compensateAttempt(workspaceId, attemptId);
        throw new Error('Failed to create payment record');
      }

      if (nextInvoiceStatus !== invoice.status) {
        try {
          // Race guard: if the invoice settled between the read and this
          // write, undo the rows we just created instead of orphaning a
          // pending payment on a paid invoice.
          await InvoiceRepository.update(workspaceId, invoice.id, { status: nextInvoiceStatus }, invoice.status as InvoiceStatus);
        } catch (statusErr) {
          await this.compensateAttempt(workspaceId, attemptId, createdPayment.id);
          throw statusErr;
        }
      }

      await this.logEvent(
        workspaceId,
        params.invoiceId,
        'UTR_SUBMITTED',
        { utr: params.utrNumber.trim(), amount: params.amount }
      );

      return {
        success: true,
        data: {
          attemptId,
          message: 'Payment attempt submitted successfully. Awaiting freelancer verification.',
        },
      };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async verifyPayment(
    workspaceId: string,
    profileId: string,
    paymentId: string,
    status: 'completed' | 'failed',
    notes?: string
  ): Promise<Result<Payment>> {
    try {
      const payment = await PaymentRepository.getById(workspaceId, paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }
      // Terminal payments are history: re-verifying would overwrite the first
      // verifier's attribution (the DB freeze enforces this too).
      if (payment.status === 'completed' || payment.status === 'failed') {
        throw new Error('This payment has already been verified.');
      }

      const nextPaymentStatus = status === 'completed' ? 'completed' : 'failed';
      const transitionPayment = PaymentStateMachine.transition(payment.status, nextPaymentStatus, {
        paymentId,
        utr: payment.transaction_reference || '',
      });

      const invoice = await InvoiceRepository.getById(workspaceId, payment.invoice_id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Fast UX preflight only — the RPC re-checks every guard under the
      // invoice row lock, so a stale pre-read can never corrupt the balance.
      if (status === 'completed') {
        const allPayments = await PaymentRepository.getByInvoiceId(workspaceId, invoice.id);
        const otherPending = allPayments.filter(
          p => p.id !== payment.id && (p.status === 'pending' || p.status === 'pending_verification')
        );
        if (otherPending.length > 0) {
          throw new Error('Other payment attempts are still pending verification for this invoice.');
        }
        const invoiceTotalPaise = toPaise(Number(invoice.total || 0));
        const otherCompletedSumPaise = allPayments
          .filter(p => p.id !== payment.id && p.status === 'completed')
          .reduce((sum, p) => sum + toPaise(Number(p.amount)), 0);
        if (toPaise(Number(payment.amount)) > invoiceTotalPaise - otherCompletedSumPaise) {
          throw new Error('Payment amount exceeds outstanding invoice balance.');
        }
      }

      // One atomic RPC for approve AND reject, partial AND full: it locks the
      // invoice, moves exactly this payment, recomputes the balance from the
      // completed payments and returns the actual DB rows.
      const { payment: updatedPayment, invoice: updatedInvoice } =
        await PaymentRepository.verifyPaymentTransactional(
          workspaceId,
          profileId,
          invoice.id,
          paymentId,
          status === 'completed',
          notes
        );

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        action: transitionPayment.activityLog.action,
        details: transitionPayment.activityLog.details,
      });

      if (updatedInvoice && updatedInvoice.status !== invoice.status) {
        const transitionInvoice = InvoiceStateMachine.transition(
          invoice.status as InvoiceStatus,
          updatedInvoice.status as InvoiceStatus,
          { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number }
        );
        await LoggingService.logActivity({
          workspaceId,
          profileId,
          action: transitionInvoice.activityLog.action,
          details: transitionInvoice.activityLog.details,
        });
      }

      return { success: true, data: updatedPayment };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
