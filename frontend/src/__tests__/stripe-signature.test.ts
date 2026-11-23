import { describe, it, expect } from 'vitest';
import {
  verifyStripeSignature,
  invoiceAmountPaise,
  SIGNATURE_TOLERANCE_SECONDS,
} from '@/supabase/functions/_shared/stripe.ts';

// Real behavior tests for the Stripe money/security helpers shared by the
// edge functions. These exercise the exact code the functions import — a
// bug in HMAC parsing, tolerance, or paise conversion fails here.

const SECRET = 'whsec_test_secret';

async function sign(timestamp: number, body: string, secret: string = SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyStripeSignature', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const nowMs = 1_700_000_000_000;
  const t = Math.floor(nowMs / 1000);

  it('accepts a valid signature over "<t>.<raw body>"', async () => {
    const header = `t=${t},v1=${await sign(t, body)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const header = `t=${t},v1=${await sign(t, body)}`;
    expect(await verifyStripeSignature(body + ' ', SECRET, header, nowMs)).toBe(false);
  });

  it('rejects a wrong endpoint secret', async () => {
    const header = `t=${t},v1=${await sign(t, body, 'whsec_other')}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(false);
  });

  it('rejects an expired timestamp beyond the tolerance', async () => {
    const old = t - SIGNATURE_TOLERANCE_SECONDS - 1;
    const header = `t=${old},v1=${await sign(old, body)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(false);
  });

  it('rejects a future timestamp beyond the tolerance', async () => {
    const future = t + SIGNATURE_TOLERANCE_SECONDS + 1;
    const header = `t=${future},v1=${await sign(future, body)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(false);
  });

  it('accepts a timestamp inside the tolerance window', async () => {
    const edge = t - SIGNATURE_TOLERANCE_SECONDS;
    const header = `t=${edge},v1=${await sign(edge, body)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(true);
  });

  it('accepts when any of multiple v1 signatures matches (key rotation)', async () => {
    const header = `t=${t},v1=${'0'.repeat(64)},v1=${await sign(t, body)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(true);
  });

  it('accepts uppercase hex signatures (case-insensitive compare)', async () => {
    const header = `t=${t},v1=${(await sign(t, body)).toUpperCase()}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(true);
  });

  it('rejects malformed headers', async () => {
    expect(await verifyStripeSignature(body, SECRET, '', nowMs)).toBe(false);
    expect(await verifyStripeSignature(body, SECRET, 'garbage', nowMs)).toBe(false);
    expect(await verifyStripeSignature(body, SECRET, `t=notanumber,v1=${await sign(t, body)}`, nowMs)).toBe(false);
    expect(await verifyStripeSignature(body, SECRET, `t=${t}`, nowMs)).toBe(false);
    expect(await verifyStripeSignature(body, SECRET, `v1=${await sign(t, body)}`, nowMs)).toBe(false);
  });

  it('rejects a truncated signature (length mismatch)', async () => {
    const header = `t=${t},v1=${(await sign(t, body)).slice(0, 32)}`;
    expect(await verifyStripeSignature(body, SECRET, header, nowMs)).toBe(false);
  });
});

describe('invoiceAmountPaise (server-side charge derivation)', () => {
  it('prefers the outstanding balance over the total', () => {
    expect(invoiceAmountPaise({ outstanding_balance: 600, total: 1000 })).toBe(60000);
  });

  it('falls back to the total when the balance is null/undefined', () => {
    expect(invoiceAmountPaise({ outstanding_balance: null, total: 1000 })).toBe(100000);
    expect(invoiceAmountPaise({ total: 1000 })).toBe(100000);
  });

  it('converts rupees to integer paise with half-up rounding', () => {
    expect(invoiceAmountPaise({ outstanding_balance: 118.5 })).toBe(11850);
    expect(invoiceAmountPaise({ outstanding_balance: 0.01 })).toBe(1);
    expect(invoiceAmountPaise({ outstanding_balance: 10.005 })).toBe(1001);
  });

  it('accepts numeric strings (PostgREST numerics arrive as strings)', () => {
    expect(invoiceAmountPaise({ outstanding_balance: '600.25' })).toBe(60025);
  });

  it('fails closed for missing amounts (NaN or zero — the caller rejects both)', () => {
    expect(Number.isNaN(invoiceAmountPaise({}))).toBe(true);
    // null ?? null → Number(null) = 0; checkout rejects amountPaise <= 0.
    expect(invoiceAmountPaise({ outstanding_balance: null, total: null })).toBe(0);
  });
});
