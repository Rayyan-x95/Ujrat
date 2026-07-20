import { PaymentRepository } from '@/features/payments';
import { InvoiceRepository } from '@/features/invoices';
import type { Result, QueryOptions, PaginatedResult, Payment, InvoiceStatus } from '@/shared/types';
import { PaymentStateMachine, InvoiceStateMachine } from '@/shared/utils/StateMachine';
import { PaymentSchema } from '@/shared/validation/schemas';
import { LoggingService } from '@/features/auth/services/LoggingService';

export class PaymentService {
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

  static async submitPayment(
    workspaceId: string,
    paymentData: {
      invoice_id: string;
      amount: number;
      payment_method?: string;
      transaction_reference: string;
    }
  ): Promise<Result<Payment>> {
    try {
      // Validate payment notification using Zod
      const validated = PaymentSchema.parse(paymentData);

      const invoice = await InvoiceRepository.getById(workspaceId, validated.invoice_id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Create payment attempt in pending status
      const payment = await PaymentRepository.create(workspaceId, {
        workspace_id: workspaceId,
        invoice_id: validated.invoice_id,
        amount: validated.amount,
        payment_method: validated.payment_method || 'UPI',
        transaction_reference: validated.transaction_reference,
        payment_date: new Date().toISOString(),
        status: 'pending',
        notes: null,
        verifier_id: null,
        verified_at: null,
      });

      // Update invoice status to pending_verification (standard lifecycle)
      if (invoice.status !== 'pending_verification') {
        const currentInvoiceStatus = invoice.status as InvoiceStatus;
        const transition = InvoiceStateMachine.transition(currentInvoiceStatus, 'pending_verification' as InvoiceStatus, {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
        });

        await LoggingService.logActivity({
          workspaceId,
          profileId: '',
          action: transition.activityLog.action,
          details: transition.activityLog.details,
        });

        await InvoiceRepository.update(workspaceId, invoice.id, { status: 'pending_verification' as InvoiceStatus });
      }

      return { success: true, data: payment };
    } catch (e) {
      if (e instanceof Error && (e.message.includes('duplicate key') || e.message.includes('unique_transaction_reference'))) {
        return { success: false, error: new Error('This transaction reference (UTR) has already been submitted.') };
      }
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

      const nextPaymentStatus = status === 'completed' ? 'completed' : 'failed';
      
      // Perform state machine checks (pure transition)
      const transitionPayment = PaymentStateMachine.transition(payment.status, nextPaymentStatus, {
        paymentId,
        utr: payment.transaction_reference || '',
      });

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        action: transitionPayment.activityLog.action,
        details: transitionPayment.activityLog.details,
      });

      // Update payment status and log verifier details
      const updatedPayment = await PaymentRepository.verifyPayment(
        workspaceId,
        paymentId,
        profileId,
        status,
        notes
      );

      // Re-evaluate parent invoice outstanding balance
      const invoice = await InvoiceRepository.getById(workspaceId, payment.invoice_id);
      if (invoice) {
        const allPayments = await PaymentRepository.getByInvoiceId(workspaceId, invoice.id);
        const completedSum = allPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const outstandingBalance = Math.max(0, Number(invoice.total) - completedSum);
        
        let nextInvoiceStatus: InvoiceStatus = invoice.status as InvoiceStatus;
        if (completedSum >= Number(invoice.total)) {
          nextInvoiceStatus = 'paid' as InvoiceStatus;
        } else if (completedSum > 0) {
          nextInvoiceStatus = 'sent' as InvoiceStatus;
        } else {
          nextInvoiceStatus = 'sent' as InvoiceStatus;
        }

        if (invoice.status !== nextInvoiceStatus) {
          const currentInvoiceStatus = invoice.status as InvoiceStatus;
          const transitionInvoice = InvoiceStateMachine.transition(currentInvoiceStatus, nextInvoiceStatus, {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
          });

          await LoggingService.logActivity({
            workspaceId,
            profileId,
            action: transitionInvoice.activityLog.action,
            details: transitionInvoice.activityLog.details,
          });
        }

        await InvoiceRepository.update(workspaceId, invoice.id, {
          outstanding_balance: outstandingBalance,
          status: nextInvoiceStatus,
        });
      }

      return { success: true, data: updatedPayment };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}