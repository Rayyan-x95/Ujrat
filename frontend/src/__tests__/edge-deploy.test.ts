import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_DIR = existsSync(path.join(ROOT, 'backend/supabase/functions'))
  ? path.join(ROOT, 'backend/supabase/functions')
  : path.resolve(ROOT, '../backend/supabase/functions');

const PAYMENT_WEBHOOK_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'payment-webhook/index.ts'), 'utf8');
const SIGNED_URL_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'create-signed-url/index.ts'), 'utf8');
const STRIPE_CHECKOUT_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'stripe-checkout/index.ts'), 'utf8');
const STRIPE_WEBHOOK_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'stripe-webhook/index.ts'), 'utf8');

describe('edge deploy config', () => {
  it('has no stale send-email/health function folders', () => {
    const entries = readdirSync(FUNCTIONS_DIR);
    expect(entries).not.toContain('send-email');
    expect(entries).not.toContain('health');
  });

  it('payment-webhook verifies HMAC x-webhook-signature, not Razorpay', () => {
    expect(PAYMENT_WEBHOOK_SRC).toContain('x-webhook-signature');
    expect(PAYMENT_WEBHOOK_SRC).not.toContain('Razorpay');
    // HMAC-SHA256 of the raw body compared in constant time — the secret
    // itself must never be the signature (static compare leaked the secret).
    expect(PAYMENT_WEBHOOK_SRC).toContain('HMAC');
    expect(PAYMENT_WEBHOOK_SRC).toContain('verifyHmacSignature');
    // reconcile_gateway_payment() stores rupees — paise must be converted.
    expect(PAYMENT_WEBHOOK_SRC).toContain('amountPaise / 100');
  });

  it('create-signed-url sets Cache-Control on its response', () => {
    expect(SIGNED_URL_SRC).toContain('Cache-Control');
  });

  it('stripe-checkout derives the charge server-side and fails closed without keys', () => {
    // The client sends only token + invoice id; amount comes from the portal bundle.
    expect(STRIPE_CHECKOUT_SRC).toContain('get_portal_bundle');
    expect(STRIPE_CHECKOUT_SRC).toContain('outstanding_balance');
    expect(STRIPE_CHECKOUT_SRC).not.toContain('body.amount');
    // No STRIPE_SECRET_KEY → 503, so the scaffold is inert until configured.
    expect(STRIPE_CHECKOUT_SRC).toMatch(/if \(!stripeSecretKey\)[\s\S]{0,200}503/);
  });

  it('stripe-webhook verifies Stripe-Signature over the raw body before parsing JSON', () => {
    expect(STRIPE_WEBHOOK_SRC).toContain('stripe-signature');
    expect(STRIPE_WEBHOOK_SRC).toContain('verifyStripeSignature');
    expect(STRIPE_WEBHOOK_SRC).toContain('SIGNATURE_TOLERANCE_SECONDS = 300');
    // Signature check must precede JSON.parse (body is untrusted until verified).
    const signatureIndex = STRIPE_WEBHOOK_SRC.indexOf('stripe-signature');
    expect(signatureIndex).toBeGreaterThan(-1);
    expect(signatureIndex).toBeLessThan(STRIPE_WEBHOOK_SRC.indexOf('JSON.parse'));
    // Settles through the service-role RPC, paise → rupees, gateway 'stripe'.
    expect(STRIPE_WEBHOOK_SRC).toContain('reconcile_gateway_payment');
    expect(STRIPE_WEBHOOK_SRC).toContain('amountPaise / 100');
    expect(STRIPE_WEBHOOK_SRC).toContain("p_gateway: 'stripe'");
  });
});
