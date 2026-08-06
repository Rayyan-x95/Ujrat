import { describe, it, expect } from 'vitest';
import { UPIPaymentProvider } from '@/features/payments/providers/UPIPaymentProvider';
import { PaymentVerificationService } from '@/features/payments/services/PaymentVerificationService';
import { PaymentReceiptService } from '@/features/payments/services/PaymentReceiptService';
import { PaymentRequestStateMachine } from '@/shared/utils/StateMachine';
import { UTR_REGEX } from '@/features/payments/constants/PaymentConstants';

describe('UPI Deep Link Payment System Test Suite', () => {
  const provider = new UPIPaymentProvider();

  it('1. Generates compliant NPCI UPI Deep Link URI', () => {
    const link = provider.generateDeepLink({
      workspaceId: 'ws-123',
      invoiceId: 'inv-456',
      invoiceNumber: 'INV-2026-001',
      amount: 15000,
      currency: 'INR',
      payeeVpa: 'freelancer@upi',
      payeeName: 'Jane Doe Consultancy',
    });

    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=freelancer%40upi');
    expect(link).toContain('pn=Jane%20Doe%20Consultancy');
    expect(link).toContain('am=15000.00');
    expect(link).toContain('cu=INR');
    expect(link).toContain('tn=Invoice%20INV-2026-001');
  });

  it('2. Generates app-specific deep links for GPay, PhonePe, Paytm', () => {
    const params = {
      workspaceId: 'ws-123',
      invoiceId: 'inv-456',
      invoiceNumber: 'INV-2026-001',
      amount: 5000,
      payeeVpa: 'agency@ybl',
      payeeName: 'Agency Acme',
    };

    const gpayLink = provider.generateAppSpecificDeepLink(params, 'tez://upi/pay?');
    expect(gpayLink.startsWith('tez://upi/pay?pa=agency%40ybl')).toBe(true);

    const phonepeLink = provider.generateAppSpecificDeepLink(params, 'phonepe://pay?');
    expect(phonepeLink.startsWith('phonepe://pay?pa=agency%40ybl')).toBe(true);

    const paytmLink = provider.generateAppSpecificDeepLink(params, 'paytmmp://pay?');
    expect(paytmLink.startsWith('paytmmp://pay?pa=agency%40ybl')).toBe(true);
  });

  it('3. Validates 12-Digit UTR format correctly', () => {
    expect(UTR_REGEX.test('423156789012')).toBe(true);
    expect(UTR_REGEX.test('12345')).toBe(false);
    expect(UTR_REGEX.test('4231567890123')).toBe(false);
    expect(UTR_REGEX.test('42315678901A')).toBe(false);

    const valValid = PaymentVerificationService.validateUTR('423156789012');
    expect(valValid.isValid).toBe(true);

    const valInvalid = PaymentVerificationService.validateUTR('abc');
    expect(valInvalid.isValid).toBe(false);
    expect(valInvalid.error).toContain('12 digits');
  });

  it('4. Enforces valid Payment Request State Machine transitions', () => {
    expect(PaymentRequestStateMachine.validate('pending', 'viewed')).toBe(true);
    expect(PaymentRequestStateMachine.validate('viewed', 'awaiting_verification')).toBe(true);
    expect(PaymentRequestStateMachine.validate('awaiting_verification', 'paid')).toBe(true);

    // Paid is immutable
    expect(PaymentRequestStateMachine.validate('paid', 'pending')).toBe(false);
    expect(PaymentRequestStateMachine.validate('paid', 'awaiting_verification')).toBe(false);
  });

  it('5. Generates official Payment Receipt data', async () => {
    const res = await PaymentReceiptService.generateReceipt('ws-123', {
      invoiceId: 'inv-456',
      amount: 25000,
      utrNumber: '423156789012',
      clientName: 'Acme Corp',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.receiptNumber).toMatch(/^REC-\d{8}-[A-Z0-9]+$/);
      expect(res.data.amount).toBe(25000);
      expect(res.data.paymentMethod).toBe('UPI');
      expect(res.data.utrNumber).toBe('423156789012');
    }
  });
});
