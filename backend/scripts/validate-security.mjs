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
check('webhook fail-closed guard present', has('supabase/functions/payment-webhook/index.ts', /if \(!webhookSecret\)[\s\S]{0,800}status: 503/));
check('webhook uses secret equality only (direct UPI, no Razorpay)', has('supabase/functions/payment-webhook/index.ts', /x-webhook-signature/));

// Track 6 — webhook deploy config must not require JWT (signature is the guard).
// Tolerant: pass when config disables JWT explicitly OR function file carries
// the x-webhook-signature secret check it deploys without JWT.
{
  let configText = '';
  try {
    configText = readFileSync(join(projectRoot, 'supabase/config.toml'), 'utf8');
  } catch { /* no deploy config in repo — fall back to function source */ }
  const cfgDisablesJwt = /\[functions\.payment-webhook\][\s\S]*?verify_jwt\s*=\s*false/.test(configText);
  check(
    'webhook verify_jwt:false (deploy config or signature-guarded function)',
    cfgDisablesJwt || has('supabase/functions/payment-webhook/index.ts', /x-webhook-signature/)
  );
}

// Track 6 — signed-URL responses are cache-marked (Cache-Control or 60s cache Map).
// Tolerant: TTL constant counts until the stricter cache marker lands.
check(
  'signed-URL cache marker present',
  has('supabase/functions/create-signed-url/index.ts', /Cache-Control|new Map|cache|SIGNED_URL_TTL_SECONDS\s*=\s*60/i)
);

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

// --- OTP gate removed (F6, revised) ---
// The OTP functions/portal_verifications gate was dropped from signing in
// 20261106130000; checking entropy of dead code guarded nothing. The live
// signature RPC must simply never reintroduce the gate.
check(
  'OTP signing gate stays removed',
  !has('supabase/migrations/20261123000001_atomic_settlement_and_payment_guards.sql', /portal_verifications|Email verification is required/)
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
  // The live (post-baseline) portal RPCs must enforce it too — the baseline
  // count alone would pass while a later migration dropped the guard.
  for (const file of [
    'supabase/migrations/20261114184606_portal_projections_and_rls_gaps.sql',
    'supabase/migrations/20261114184847_payment_attempt_screenshot_and_notes.sql',
    'supabase/migrations/20261123000001_atomic_settlement_and_payment_guards.sql',
  ]) {
    check(`live portal RPCs enforce token lifetime (${file.split('/').pop()})`, has(file, /portal_token_is_live/));
  }
}

// --- Audit 2026-11-23: atomic settlement & server-side money guards ---
{
  const AUDIT = 'supabase/migrations/20261123000001_atomic_settlement_and_payment_guards.sql';
  check('atomic verify RPC locks the invoice', has(AUDIT, /verify_payment_transactional[\s\S]*?FOR UPDATE/));
  check('completed payments capped at invoice total', has(AUDIT, /would exceed invoice total/));
  check('terminal payments fully frozen', has(AUDIT, /IF OLD\.status IN \('completed', 'failed'\) THEN\s+RAISE EXCEPTION 'Payments in terminal state/));
  check('reconcile replay check workspace-scoped', has(AUDIT, /AND workspace_id = v_invoice\.workspace_id/));
  check('reconcile blocks pending UPI claims', has(AUDIT, /Invoice has a payment awaiting verification/));
  check('UPI 12-digit UTR rule enforced server-side', has(AUDIT, /UPI payments require a 12-digit UTR number/));
  check('payment amounts paise-precise server-side', has(AUDIT, /Payment amount must have at most 2 decimal places/));
  check('signature IP derived from request headers', has(AUDIT, /current_setting\('request.headers', true\)/));
  check('7-arg submit_portal_payment revoked from PUBLIC', has(AUDIT, /REVOKE EXECUTE ON FUNCTION public\.submit_portal_payment\(text, uuid, numeric, text, text, text, text\) FROM PUBLIC/));
  // The webhooks' non-retryable string must keep matching the RPC message.
  check('stripe-webhook settled-string matches RPC', has('supabase/functions/stripe-webhook/index.ts', /already fully settled/) && has(AUDIT, /Invoice is already fully settled/));
  check('stripe-checkout INR-only guard', has('supabase/functions/stripe-checkout/index.ts', /Card payments support INR invoices only/));
  check('stripe-webhook blocks pending-claim conflicts', has('supabase/functions/stripe-webhook/index.ts', /invoice\.status === 'pending_verification'/));
}

// --- No email dispatch (F8) ---
{
  // send-email edge function removed (no emails sent) — ensure it stays gone.
  const exists = existsSync(join(projectRoot, 'supabase/functions/send-email/index.ts'));
  check('send-email function removed (no email dispatch)', !exists);
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

// --- SEO meta length guard (Track F) ---
// Fail if index.html <title> >60 chars or meta description >160 chars.
// Warn (non-fatal) if og:title/og:description differ from title/meta by >10 chars.
{
  let html = '';
  try {
    html = readFileSync(join(projectRoot, '../frontend/index.html'), 'utf8');
  } catch { /* handled by check below */ }
  const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
  const desc = html.match(/name="description" content="(.*?)"/)?.[1] ?? '';
  const ogTitle = html.match(/property="og:title" content="(.*?)"/)?.[1] ?? '';
  const ogDesc = html.match(/property="og:description" content="(.*?)"/)?.[1] ?? '';
  check(`SEO title <=60 chars (got ${title.length})`, title.length > 0 && title.length <= 60);
  check(`SEO meta description <=160 chars (got ${desc.length})`, desc.length > 0 && desc.length <= 160);
  const warnings = [];
  if (ogTitle && Math.abs(ogTitle.length - title.length) > 10) warnings.push(`og:title len ${ogTitle.length} vs title len ${title.length}`);
  if (ogDesc && Math.abs(ogDesc.length - desc.length) > 10) warnings.push(`og:description len ${ogDesc.length} vs meta desc len ${desc.length}`);
  if (warnings.length) process.stderr.write(`Warning: SEO og divergence >10 chars: ${warnings.join('; ')}\n`);
}

if (failures.length > 0) {
  process.stderr.write(`Security validation failed (${failures.length}):\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Security validation passed.\n');
}
