import { describe, it, expect } from 'vitest';
import { PaymentVerificationService } from '@/features/payments/services/PaymentVerificationService';
import { PaymentSchema, ClientSchema } from '@/shared/validation/schemas';

describe('Input Fuzzing, Schema Validation & Injection Defense Suite', () => {
  describe('UTR Number Format Fuzzing', () => {
    it('accepts strictly valid 12-digit numeric Indian bank UTRs', () => {
      const validUtrs = ['123456789012', '987654321098', '000123456789', ' 123456789012 '];
      for (const utr of validUtrs) {
        const val = PaymentVerificationService.validateUTR(utr);
        expect(val.isValid).toBe(true);
      }
    });

    it('rejects XSS, SQLi, and malformed strings in UTR input', () => {
      const hostileUtrs = [
        '<script>alert("XSS")</script>',
        "'; DROP TABLE payments; --",
        "' OR '1'='1",
        '12345678901',       // 11 digits
        '1234567890123',     // 13 digits
        '12345678901A',      // contains alpha
        '1234 5678 9012',    // contains space inside
        '../../etc/passwd',
        'NaN',
        'undefined',
        'null',
      ];

      for (const utr of hostileUtrs) {
        const val = PaymentVerificationService.validateUTR(utr);
        expect(val.isValid).toBe(false);
      }
    });
  });

  describe('Payment Schema Zod Fuzzing', () => {
    it('rejects non-positive, NaN, and negative amounts', () => {
      const badPayloads = [
        { invoice_id: 'inv-1', amount: -500, payment_method: 'UPI', transaction_reference: '123456789012' },
        { invoice_id: 'inv-1', amount: 0, payment_method: 'UPI', transaction_reference: '123456789012' },
        { invoice_id: 'inv-1', amount: NaN, payment_method: 'UPI', transaction_reference: '123456789012' },
      ];

      for (const payload of badPayloads) {
        const parseResult = PaymentSchema.safeParse(payload);
        expect(parseResult.success).toBe(false);
      }
    });
  });

  describe('Client Schema Email & Phone Fuzzing', () => {
    it('rejects invalid email addresses and injection strings', () => {
      const badEmails = [
        'plainaddress',
        '@missingusername.com',
        'username@.com',
        '<script>alert(1)</script>@xss.com',
        'admin" --@test.com',
      ];

      for (const email of badEmails) {
        const result = ClientSchema.safeParse({
          name: 'Acme Corp',
          email,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Screenshot URL Validation Defense', () => {
    it('rejects dangerous protocols in screenshot attachments', () => {
      const maliciousUrls = [
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'vbscript:msgbox(1)',
        'ftp://evil.com/payload.exe',
      ];

      for (const urlStr of maliciousUrls) {
        let isValidHttpUrl = false;
        try {
          const parsed = new URL(urlStr);
          isValidHttpUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          isValidHttpUrl = false;
        }

        expect(isValidHttpUrl).toBe(false);
      }
    });

    it('accepts legitimate HTTPS screenshot URLs', () => {
      const validUrls = [
        'https://storage.googleapis.com/ujrat-bucket/proofs/screenshot1.png',
        'https://s3.amazonaws.com/uploads/receipt.jpg',
      ];

      for (const urlStr of validUrls) {
        const parsed = new URL(urlStr);
        const isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        expect(isValid).toBe(true);
      }
    });
  });
});
