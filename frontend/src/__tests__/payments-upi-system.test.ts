import { describe, it, expect } from 'vitest';
import { PaymentService } from '@/features/payments/services/PaymentService';
import { UTR_REGEX } from '@/features/payments/constants/PaymentConstants';

describe('UPI Deep Link Payment System Test Suite', () => {
  it('1. Generates compliant NPCI UPI Deep Link URI', () => {
    const link = PaymentService.generateUpiLink({
      vpa: 'freelancer@upi',
      amountPaise: 1500000,
      payeeName: 'Jane Doe Consultancy',
      reference: 'INV-2026-001',
      note: 'Invoice INV-2026-001',
      currency: 'INR',
    });

    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=freelancer%40upi');
    expect(link).toContain('pn=Jane+Doe+Consultancy');
    expect(link).toContain('am=15000.00');
    expect(link).toContain('cu=INR');
    expect(link).toContain('tn=Invoice+INV-2026-001');
  });

  it('3. Validates 12-Digit UTR format correctly', () => {
    expect(UTR_REGEX.test('423156789012')).toBe(true);
    expect(UTR_REGEX.test('12345')).toBe(false);
    expect(UTR_REGEX.test('4231567890123')).toBe(false);
    expect(UTR_REGEX.test('42315678901A')).toBe(false);

    const valValid = PaymentService.validateUTR('423156789012');
    expect(valValid.isValid).toBe(true);

    const valInvalid = PaymentService.validateUTR('abc');
    expect(valInvalid.isValid).toBe(false);
    expect(valInvalid.error).toContain('12 digits');
  });

  it('5. Strictly encodes adversarial characters in Payee Names and Notes', () => {
    const uri = PaymentService.generateUpiLink({
      vpa: 'freelancer@hdfcbank',
      amountPaise: 450050,
      payeeName: 'Jane & John "Studio" <Design> #1',
      reference: 'INV/2026/001&DISCOUNT=100%',
    });
    // Invariant: Must not produce unencoded ampersands or angle brackets
    expect(uri).not.toContain('<Design>');
    expect(uri).not.toContain('"Studio"');
    expect(uri).toContain('am=4500.50');
  });

  it('6. Rejects malformed and fuzz UTR submissions', () => {
    const maliciousUTRs = [
      '',
      ' ',
      '12345678901', // 11 digits
      '1234567890123', // 13 digits
      '42315678901X', // Alphanumeric
      '<script>123456789012</script>',
      'DROP TABLE payments;--',
      '1234 5678 9012',
      '1234-5678-9012',
      'null',
      'undefined',
    ];

    maliciousUTRs.forEach((utr) => {
      const res = PaymentService.validateUTR(utr);
      expect(res.isValid).toBe(false);
    });
  });

  it('7. PaymentService.generateUpiLink builds an INR paise link and rejects bad VPAs / amounts', () => {
    const link = PaymentService.generateUpiLink({
      vpa: 'freelancer@upi',
      amountPaise: 1500000,
      note: 'Invoice INV-2026-001',
    });

    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=freelancer%40upi');
    expect(link).toContain('am=15000.00');
    expect(link).toContain('cu=INR');
    expect(link).toContain('tn=Invoice+INV-2026-001');

    expect(() =>
      PaymentService.generateUpiLink({ vpa: 'paytm', amountPaise: 10000 }),
    ).toThrow('Invalid UPI VPA.');
    expect(() =>
      PaymentService.generateUpiLink({ vpa: 'payee@upe', amountPaise: 0 }),
    ).toThrow('Payment amount must be a positive integer (paise).');
    expect(() =>
      PaymentService.generateUpiLink({ vpa: 'payee@upe', amountPaise: 150.5 }),
    ).toThrow('Payment amount must be a positive integer (paise).');
    expect(() =>
      PaymentService.generateUpiLink({ vpa: 'payee@upe', amountPaise: 10000, currency: 'USD' }),
    ).toThrow('require INR');
  });
});
