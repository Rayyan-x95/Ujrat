import { describe, it, expect } from 'vitest';
import { sanitizeSearchTerm, redactPortalToken, deepRedact } from '@/shared/utils/sanitize';
import { StorageService } from '@/features/settings/services/StorageService';
import {
  InvoiceStateMachine,
  PaymentStateMachine,
  ContractStateMachine,
} from '@/shared/utils/StateMachine';

describe('sanitizeSearchTerm — PostgREST filter-injection defense (F11)', () => {
  it('strips structural filter tokens used by .or() expressions', () => {
    // Attempting to inject an additional OR arm / close the group.
    expect(sanitizeSearchTerm('x,id.eq.victim-uuid)')).toBe('xid.eq.victim-uuid');
    expect(sanitizeSearchTerm('(a,b)')).toBe('ab');
  });

  it('removes ilike wildcards and escapes so callers cannot reshape matching', () => {
    expect(sanitizeSearchTerm('%admin%')).toBe('admin');
    expect(sanitizeSearchTerm('a\\b*c')).toBe('abc');
  });

  it('strips control characters and enforces a length cap', () => {
    const hostile = 'a\u0000b\u001Fc'.padEnd(150, 'z');
    const out = sanitizeSearchTerm(hostile);
    expect(out).toHaveLength(100);
    expect(out.startsWith('abc')).toBe(true);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeSearchTerm(undefined)).toBe('');
    expect(sanitizeSearchTerm(42)).toBe('');
    expect(sanitizeSearchTerm({})).toBe('');
  });
});

describe('redactPortalToken — portal bearer token never leaves the browser', () => {
  it('redacts the token in relative and absolute portal URLs', () => {
    expect(redactPortalToken('/portal/abc123?x=1')).toBe('/portal/[redacted]?x=1');
    expect(redactPortalToken('https://app.ujrat.in/portal/deadbeef/sign')).toBe('https://app.ujrat.in/portal/[redacted]/sign');
  });

  it('leaves non-portal URLs untouched', () => {
    expect(redactPortalToken('/dashboard?tab=invoices')).toBe('/dashboard?tab=invoices');
  });
});

describe('deepRedact — analytics events never carry the portal token at any depth', () => {
  it('redacts the real leak shapes Sentry emitted live: spans[].description and span data', () => {
    const transaction = {
      request: { url: 'http://127.0.0.1:5210/portal/e6c1195cea4a4e55928d7d8f1ab20e68' },
      spans: [
        { description: 'http://127.0.0.1:5210/portal/e6c1195cea4a4e55928d7d8f1ab20e68', data: { 'url.full': 'http://127.0.0.1:5210/portal/e6c1195cea4a4e55928d7d8f1ab20e68' } },
      ],
      tags: { url: '/portal/e6c1195cea4a4e55928d7d8f1ab20e68' },
    };
    const out = deepRedact(transaction) as typeof transaction;
    expect(JSON.stringify(out)).not.toContain('e6c1195cea4a4e55928d7d8f1ab20e68');
    expect(out.spans[0]?.description).toContain('[redacted]');
  });

  it('survives circular self-references (Sentry span data) without overflowing', () => {
    const span: { description: string; self?: unknown } = { description: '/portal/e6c1195cea4a4e55928d7d8f1ab20e68' };
    span.self = span;
    const out = deepRedact(span) as typeof span;
    expect(out.description).toBe('/portal/[redacted]');
    expect(out.self).toBe(span);
  });

  it('leaves token-free strings and non-strings alone', () => {
    const ev = { a: 1, b: null, c: '/dashboard', nested: { d: [{ e: 42 }] } };
    expect(deepRedact(ev)).toEqual(ev);
  });
});

describe('F12 — storage upload validation', () => {
  it('rejects SVG uploads on every bucket (stored-XSS vector)', () => {
    for (const bucket of ['branding', 'deliverables'] as const) {
      const svg = new File(['<svg onload="alert(1)"/>'], 'evil.svg', { type: 'image/svg+xml' });
      const res = StorageService.validateFile(bucket, svg);
      expect(res.valid).toBe(false);
    }
  });

  it('rejects oversized files', () => {
    const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.bin', { type: 'application/zip' });
    expect(StorageService.validateFile('deliverables', big).valid).toBe(false);
  });

  it('still accepts legitimate formats', () => {
    const pdf = new File(['%PDF-'], 'doc.pdf', { type: 'application/pdf' });
    expect(StorageService.validateFile('deliverables', pdf).valid).toBe(true);
    const png = new File([''], 'logo.png', { type: 'image/png' });
    expect(StorageService.validateFile('branding', png).valid).toBe(true);
  });
});

describe('Financial state-machine negative paths (Gate 3/4 backstop)', () => {
  it('cancelled invoices can never transition to paid in app logic', () => {
    expect(() =>
      InvoiceStateMachine.transition('cancelled', 'paid', {})
    ).toThrow();
  });

  it('settled invoices are terminal in app logic', () => {
    expect(() =>
      InvoiceStateMachine.transition('paid', 'draft', {})
    ).toThrow();
    expect(InvoiceStateMachine.validate('paid', 'pending_verification')).toBe(false);
  });

  it('completed payments are frozen in app logic', () => {
    expect(PaymentStateMachine.validate('completed', 'failed')).toBe(false);
    expect(PaymentStateMachine.validate('failed', 'completed')).toBe(false);
  });

  it('payments cannot regress backwards once verification started', () => {
    expect(PaymentStateMachine.validate('pending', 'completed')).toBe(true);
    expect(() =>
      PaymentStateMachine.transition('pending_verification', 'pending', {})
    ).toThrow();
    expect(PaymentStateMachine.validate('pending_verification', 'completed')).toBe(true);
  });
});

describe('Workflow authorization boundaries preserved', () => {
  it('contracts cannot jump from draft straight past signature states', () => {
    expect(ContractStateMachine.validate('draft', 'signed')).toBe(false);
  });
});
