import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * validate-security.mjs — CI gate for security invariants that must hold in
 * the repository's authoritative sources (migrations + edge functions).
 * Complements scripts/validate-migrations.mjs. Fails with exit code 1 when
 * any control regresses.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function check(label, condition) {
  if (!condition) failures.push(label);
}

function has(file, pattern) {
  try {
    return new RegExp(pattern).test(readFileSync(join(projectRoot, file), 'utf8'));
  } catch {
    return false;
  }
}

const HARDENING = existsSync(join(projectRoot, 'supabase/migrations/20260824000000_security_hardening.sql'))
  ? 'supabase/migrations/20260824000000_security_hardening.sql'
  : 'supabase/migrations/000_baseline.sql';

// --- Webhook settlement (F1/F2) ---
check('webhook fail-closed guard present', has('supabase/functions/payment-webhook/index.ts', /FAIL-CLOSED[\s\S]{0,800}status: 503/));
check('webhook uses constant-time HMAC verify', has('supabase/functions/payment-webhook/index.ts', /crypto\.subtle\.verify\('HMAC'/));

// --- Invoice/payment DB integrity (F3/F4/F5/F14) ---
for (const marker of [
  'enforce_invoice_insert_defaults',
  "NEW\\.status := 'draft'",
  'Paid invoices cannot be deleted',
  'Invoices with completed payments cannot be deleted',
  'Payment amount is immutable after creation',
  'Completing a payment requires verifier attribution',
  'Settled payments are part of the financial record and cannot be deleted',
  'payments_delete_guard_trigger',
  'payment_attempts_amount_positive',
]) {
  check(`hardening migration contains "${marker}"`, has(HARDENING, marker));
}

// --- OTP entropy (F6) ---
check(
  'OTP generation uses pgcrypto CSPRNG',
  has(HARDENING, /gen_random_bytes\(4\)[\s\S]{0,600}% 900000/)
);

// --- Portal settings projection (F7, revised) ---
{
  const sql = readFileSync(join(projectRoot, HARDENING), 'utf8');
  const start = sql.indexOf('get_portal_settings(token_val text)');
  const end = sql.indexOf('get_portal_proposal(token_val text)');
  const fn = start >= 0 && end > start ? sql.slice(start, end) : '';
  check(
    'portal settings exposes invoice-legal fields only',
    fn.length > 0 &&
      fn.includes('bank_account_no') && // required on GST invoice print view
      !fn.includes('default_tds_section') &&
      !fn.includes('preferred_currency') &&
      !/SELECT s\.(id|workspace_id|updated_at)\b/.test(fn)
  );
}

// --- Portal token lifetime (F9) ---
{
  const sql = readFileSync(join(projectRoot, HARDENING), 'utf8');
  const calls = (sql.match(/public\.portal_token_is_live\(/g) || []).length;
  check('portal_token_is_live enforced across portal functions', calls >= 12);
}

// --- Email relay lockdown (F8) ---
{
  const src = readFileSync(join(projectRoot, 'supabase/functions/send-email/index.ts'), 'utf8');
  check('send-email has no user-JWT dispatch branch', !src.includes('auth.getUser()'));
  check('send-email restricts direct sends to service role', src.includes('service-role'));
}

// --- Storage policies in repo (F13) ---
{
  const sql = readFileSync(join(projectRoot, HARDENING), 'utf8');
  check(
    'storage policy generator covers every application bucket',
    /\[\s*'avatars','branding','contracts','proposals','invoices','deliverables'\s*\]/.test(sql)
  );
  for (const op of ['select', 'insert', 'update', 'delete']) {
    check(`storage owner-${op} policies generated`, sql.includes(`'Owner ${op} '`));
  }
}

if (failures.length > 0) {
  process.stderr.write(`Security validation failed (${failures.length}):\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Security validation passed.\n');
}
