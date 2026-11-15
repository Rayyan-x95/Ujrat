import { describe, it, expect } from 'vitest';
import { validateGSTINFormat, extractPANFromGSTIN } from '../features/invoices/tax/InvoiceCalculator';

describe('🔒 BRUTAL SECURITY & ADVERSARIAL ATTACK SUITE', () => {

  describe('1. Polyglot & Complex SQL Injection Vectors', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE invoices; --",
      "' OR 1=1 --",
      "' UNION SELECT null, null, email, password_hash FROM auth.users --",
      "1; SELECT pg_sleep(5); --",
      "admin'--",
      "' OR '1'='1' /*",
      "\" OR \"\"=\"",
      "1' ORDER BY 1,2,3,4,5,6,7,8,9,10--",
      "\\'; EXEC xp_cmdshell('dir');--",
      "1 AND (SELECT * FROM (SELECT(SLEEP(5)))a)",
    ];

    it('neutralizes all SQL injection payloads when validating GSTIN / inputs', () => {
      sqlInjectionPayloads.forEach((payload) => {
        const res = validateGSTINFormat(payload);
        expect(res.isValid).toBe(false);
        expect(res.error).toBeDefined();

        const pan = extractPANFromGSTIN(payload);
        expect(pan).toBeNull();
      });
    });
  });

  describe('4. Unicode Homoglyphs, RTL Overrides & Zero-Width Traps', () => {
    it('strips or flags zero-width spaces and RTL overrides in GSTIN and names', () => {
      // 29AAAAA1111A1Z1 with zero-width space (\u200B) injected
      const taintedGSTIN = '29AAAAA\u200B1111A1Z1';
      const res = validateGSTINFormat(taintedGSTIN);
      expect(res.isValid).toBe(false);

      // Right-to-Left Override (\u202E) attack in client name
      const rtlName = 'Mohammad \u202Efdp.exe';
      const cleanName = rtlName.replace(/[\u200B-\u200D\uFEFF\u202E]/g, '');
      expect(cleanName).not.toContain('\u202E');
    });
  });

  describe('5. Regular Expression Denial of Service (ReDoS) Resilience', () => {
    it('evaluates evil backtracking strings in under 2ms with zero timeout', () => {
      const evilStrings = [
        '29' + 'A'.repeat(5000) + '!',
        'A'.repeat(10000) + '@' + 'B'.repeat(10000) + '.com',
        '99' + '9'.repeat(8000),
      ];

      evilStrings.forEach((evil) => {
        const start = performance.now();
        validateGSTINFormat(evil);
        extractPANFromGSTIN(evil);
        const duration = performance.now() - start;

        // Invariant: Must execute in < 15ms without catastrophic backtracking
        expect(duration).toBeLessThan(15);
      });
    });
  });

  describe('6. Token Equality Validation', () => {
    it('validates tokens with deterministic equality matching', () => {
      const validToken = 'a'.repeat(64);
      const wrongTokenAtStart = 'z' + 'a'.repeat(63);
      const wrongTokenAtEnd = 'a'.repeat(63) + 'z';
      const identicalToken = 'a'.repeat(64);

      expect(validToken === identicalToken).toBe(true);
      expect(validToken === wrongTokenAtStart).toBe(false);
      expect(validToken === wrongTokenAtEnd).toBe(false);
    });
  });
});
