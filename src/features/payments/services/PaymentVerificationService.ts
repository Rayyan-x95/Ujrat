/**
 * Ujrat Payment System - Payment Verification Service
 * 12-Digit UTR Format Checking • Fraud Protection • State Machine Transitions
 */

import { supabase } from '@/shared/lib/supabaseClient';
import { InvoiceRepository } from '@/features/invoices/repositories/InvoiceRepository';
import { PaymentRepository } from '@/features/payments/repositories/PaymentRepository';
import { UTR_REGEX } from '../constants/PaymentConstants';
import { PaymentReceiptService } from './PaymentReceiptService';
import { PaymentAuditService } from './PaymentAuditService';
import type { Result, InvoiceStatus } from '@/shared/types';
import { InvoiceStateMachine, PaymentStateMachine, PaymentRequestStateMachine } from '@/shared/utils/StateMachine';
import { toPaise, fromPaise } from '@/features/invoices/tax/TaxUtilities';

export class PaymentVerificationService {
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
      appName?: string;
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

      // Enforce invoice balance server-side
      const outstandingBalance = invoice.outstanding_balance ?? invoice.total ?? 0;
      if (params.amount > outstandingBalance) {
        throw new Error(`Submitted payment amount (${params.amount}) exceeds outstanding invoice balance (${outstandingBalance}).`);
      }

      // Check for duplicate UTR number in workspace
      const { data: existing, error: dupError } = await (supabase as any)
        .from('payment_attempts')
        .select('id, status')
        .eq('workspace_id', workspaceId)
        .eq('utr_number', params.utrNumber.trim())
        .limit(1);

      if (dupError && dupError.code !== '42P01' && !dupError.message?.includes('schema cache')) {
        throw new Error(`Database error checking duplicate UTR: ${dupError.message}`);
      }
      if (existing && existing.length > 0) {
        throw new Error('This 12-digit UTR Number has already been submitted for verification.');
      }

      // Resolve or fetch active payment_request_id
      let paymentRequestId: string | null = null;
      try {
        const { data: reqData } = await (supabase as any)
          .from('payment_requests')
          .select('id, status')
          .eq('workspace_id', workspaceId)
          .eq('invoice_id', params.invoiceId)
          .limit(1)
          .maybeSingle();
        if (reqData?.id) {
          paymentRequestId = reqData.id;
          let currStatus = reqData.status || 'pending';
          if (currStatus !== 'awaiting_verification') {
            if (PaymentRequestStateMachine.validate(currStatus, 'initiated')) {
              currStatus = PaymentRequestStateMachine.transition(currStatus, 'initiated', { requestId: paymentRequestId! }).next;
            }
            if (PaymentRequestStateMachine.validate(currStatus, 'awaiting_verification')) {
              currStatus = PaymentRequestStateMachine.transition(currStatus, 'awaiting_verification', { requestId: paymentRequestId! }).next;
            }
            await (supabase as any)
              .from('payment_requests')
              .update({ status: currStatus })
              .eq('id', paymentRequestId);
          }
        }
      } catch {
        // Table fallback
      }

      // Validate invoice state transition before DB write
      let nextInvoiceStatus = invoice.status;
      if (invoice.status !== 'pending_verification') {
        const transition = InvoiceStateMachine.transition(
          invoice.status as InvoiceStatus,
          'pending_verification' as InvoiceStatus,
          { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number }
        );
        nextInvoiceStatus = transition.next as InvoiceStatus;
      }

      // Save payment attempt
      const attemptId = crypto.randomUUID();
      try {
        const { error: insertErr } = await (supabase as any).from('payment_attempts').insert({
          id: attemptId,
          workspace_id: workspaceId,
          invoice_id: params.invoiceId,
          payment_request_id: paymentRequestId,
          utr_number: params.utrNumber.trim(),
          amount: params.amount,
          screenshot_url: params.screenshotUrl || null,
          notes: params.notes || null,
          app_name: params.appName || 'UPI_GENERIC',
          status: 'pending_verification',
        });
        if (insertErr && insertErr.code === '23505') {
          throw new Error('This 12-digit UTR Number has already been submitted.');
        }
      } catch (err: any) {
        if (err.message?.includes('already been submitted')) throw err;
      }

      // Save to main payments table
      const createdPayment = await PaymentRepository.create(workspaceId, {
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

      if (!createdPayment) {
        throw new Error('Failed to create payment record');
      }

      if (nextInvoiceStatus !== invoice.status) {
        await InvoiceRepository.update(workspaceId, invoice.id, { status: nextInvoiceStatus });
      }

      // Log audit event
      await PaymentAuditService.logEvent(
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

  /**
   * Freelancer manual verification approval or rejection
   */
  static async verifyClientPayment(
    workspaceId: string,
    verifierId: string,
    paymentId: string,
    verificationStatus: 'approved' | 'rejected',
    notes?: string
  ): Promise<Result<{ status: string; receiptId?: string }>> {
    try {
      const payment = await PaymentRepository.getById(workspaceId, paymentId);
      if (!payment) {
        throw new Error('Payment submission not found');
      }

      const nextPaymentStatus = verificationStatus === 'approved' ? 'completed' : 'failed';
      PaymentStateMachine.transition(payment.status, nextPaymentStatus, {
        paymentId,
        utr: payment.transaction_reference || '',
      });

      // Update payment record in repository
      await PaymentRepository.verifyPayment(
        workspaceId,
        paymentId,
        verifierId,
        nextPaymentStatus as any,
        notes
      );

      let receiptId: string | undefined = undefined;

      if (verificationStatus === 'approved') {
        const invoice = await InvoiceRepository.getById(workspaceId, payment.invoice_id);
        if (invoice) {
          const allPayments = await PaymentRepository.getByInvoiceId(workspaceId, invoice.id);
          const invoiceTotalPaise = toPaise(Number(invoice.total || 0));
          const completedSumPaise = allPayments
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + toPaise(Number(p.amount)), 0);

          const outstandingPaise = Math.max(0, invoiceTotalPaise - completedSumPaise);
          const outstanding = fromPaise(outstandingPaise);

          const isOverdue = invoice.due_date ? new Date(invoice.due_date).getTime() < Date.now() : false;
          let nextInvoiceStatus: InvoiceStatus = 'paid';
          if (outstandingPaise > 0) {
            nextInvoiceStatus = isOverdue ? 'overdue' : 'sent';
          }

          await InvoiceRepository.update(workspaceId, invoice.id, {
            outstanding_balance: outstanding,
            status: nextInvoiceStatus,
          });

          // Resolve linked payment request lifecycle to paid via StateMachine
          try {
            const { data: attempts } = await (supabase as any)
              .from('payment_attempts')
              .select('payment_request_id')
              .eq('workspace_id', workspaceId)
              .eq('invoice_id', invoice.id)
              .eq('utr_number', payment.transaction_reference || '')
              .limit(1);

            const targetRequestId = attempts?.[0]?.payment_request_id;
            if (targetRequestId) {
              const { data: reqData } = await (supabase as any)
                .from('payment_requests')
                .select('id, status')
                .eq('id', targetRequestId)
                .maybeSingle();

              if (reqData && reqData.status !== 'paid') {
                const transition = PaymentRequestStateMachine.transition(reqData.status, 'paid', { requestId: targetRequestId });
                await (supabase as any)
                  .from('payment_requests')
                  .update({ status: transition.next })
                  .eq('id', targetRequestId);
              }
            }
          } catch (e: any) {
            console.warn('[PaymentVerificationService] Payment request lifecycle fallback:', e.message);
          }

          // Generate official Payment Receipt
          const receiptRes = await PaymentReceiptService.generateReceipt(workspaceId, {
            invoiceId: invoice.id,
            amount: Number(payment.amount),
            utrNumber: payment.transaction_reference || '',
            clientName: invoice.projects?.clients?.name || 'Client',
          });
          if (receiptRes.success) {
            receiptId = receiptRes.data.id;
          }
        }
      }

      // Log audit trail
      await PaymentAuditService.logEvent(
        workspaceId,
        payment.invoice_id,
        verificationStatus === 'approved' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
        { paymentId, verifierId, notes },
        verifierId
      );

      return {
        success: true,
        data: {
          status: verificationStatus,
          ...(receiptId ? { receiptId } : {}),
        },
      };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
