import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_DIR = existsSync(path.join(ROOT, 'backend/supabase/functions'))
  ? path.join(ROOT, 'backend/supabase/functions')
  : path.resolve(ROOT, '../backend/supabase/functions');

const PAYMENT_WEBHOOK_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'payment-webhook/index.ts'), 'utf8');
const SIGNED_URL_SRC = readFileSync(path.join(FUNCTIONS_DIR, 'create-signed-url/index.ts'), 'utf8');

describe('edge deploy config', () => {
  it('has no stale send-email/health function folders', () => {
    const entries = readdirSync(FUNCTIONS_DIR);
    expect(entries).not.toContain('send-email');
    expect(entries).not.toContain('health');
  });

  it('payment-webhook verifies x-webhook-signature, not Razorpay/HMAC', () => {
    expect(PAYMENT_WEBHOOK_SRC).toContain('x-webhook-signature');
    expect(PAYMENT_WEBHOOK_SRC).not.toContain('Razorpay');
    expect(PAYMENT_WEBHOOK_SRC).not.toContain('HMAC');
  });

  it('create-signed-url sets Cache-Control on its response', () => {
    expect(SIGNED_URL_SRC).toContain('Cache-Control');
  });
});
