import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * SECURITY HARDENING INVARIANTS
 *
 * These tests parse the authoritative sources of truth (SQL migrations,
 * Edge Function sources, app repositories) and FAIL if a security control
 * regresses. They are CI-enforceable without a live database.
 *
 * Every assertion maps to an audit finding (F1-F14). If you change schema,
 * edge functions, or storage validation in a way that removes one of these
 * controls, this suite must fail — that is its purpose.
 */

const ROOT = process.cwd();
const BACKEND = existsSync(path.join(ROOT, 'backend/supabase'))
  ? path.join(ROOT, 'backend')
  : path.resolve(ROOT, '../backend');
const FRONTEND = existsSync(path.join(ROOT, 'frontend/src'))
  ? path.join(ROOT, 'frontend')
  : ROOT;

const HARDENING_FILE = existsSync(
  path.join(BACKEND, 'supabase/migrations/20260824000000_security_hardening.sql')
)
  ? path.join(BACKEND, 'supabase/migrations/20260824000000_security_hardening.sql')
  : path.join(BACKEND, 'supabase/migrations/000_baseline.sql');
const HARDENING_SQL = readFileSync(HARDENING_FILE, 'utf8');
const BASELINE_SQL = readFileSync(
  path.join(BACKEND, 'supabase/migrations/000_baseline.sql'),
  'utf8'
);
const WEBHOOK_SRC = readFileSync(
  path.join(BACKEND, 'supabase/functions/payment-webhook/index.ts'),
  'utf8'
);
const SEND_EMAIL_SRC = readFileSync(
  path.join(BACKEND, 'supabase/functions/send-email/index.ts'),
  'utf8'
);
const SIGNED_URL_SRC = readFileSync(
  path.join(BACKEND, 'supabase/functions/create-signed-url/index.ts'),
  'utf8'
);
const INVOICE_REPO_SRC = readFileSync(
  path.join(FRONTEND, 'src/features/invoices/repositories/InvoiceRepository.ts'),
  'utf8'
);

describe('F1/F2 — gateway webhook settlement is authenticated and schema-correct', () => {
  it('payment-webhook fails closed when no webhook secret is configured', () => {
    expect(WEBHOOK_SRC).toContain('FAIL-CLOSED');
    expect(WEBHOOK_SRC).toMatch(/if \(!webhookSecret\)[\s\S]*?status: 503/);
    // The old "verify only when configured" pattern must not return.
    expect(WEBHOOK_SRC).not.toMatch(/if \(webhookSecret\) \{/);
  });

  it('signature verification is constant-time (crypto.subtle.verify, not string equality)', () => {
    expect(WEBHOOK_SRC).toContain("crypto.subtle.verify('HMAC'");
    expect(WEBHOOK_SRC).not.toMatch(/expectedHex\.toLowerCase\(\)\s*===/);
  });

  it('reconcile_gateway_payment references only real columns', () => {
    // Regression guard for F2: these phantom columns crashed reconciliation
    // (public.payments has no currency/updated_at; audit trail uses event_type).
    const fn = HARDENING_SQL.slice(
      HARDENING_SQL.indexOf('reconcile_gateway_payment('),
      HARDENING_SQL.indexOf('-- F6:')
    );
    expect(fn).not.toMatch(/INSERT INTO public\.payments\s*\([^)]*\bcurrency\b/);
    expect(fn).not.toMatch(/INSERT INTO public\.payments\s*\([^)]*\bupdated_at\b/);
    expect(fn).not.toContain('action,');
    expect(fn).toContain('event_type');
    // Hardened settlement semantics.
    expect(fn).toContain('already fully settled');
    expect(fn).toContain('exceeds outstanding balance');
  });
});

describe('F3/F4/F19 — invoice financial integrity at the database boundary', () => {
  it('immutability trigger covers tax-engine-2.0 fields and outstanding_balance', () => {
    const trigger = HARDENING_SQL.slice(
      HARDENING_SQL.indexOf('enforce_invoice_immutability()'),
      HARDENING_SQL.indexOf('F5: Payment integrity')
    );
    for (const col of [
      'taxable_amount', 'discount_amount', 'cess_amount', 'tds_amount',
      'net_receivable', 'round_off', 'inr_total', 'outstanding_balance',
      'freelancer_gstin', 'client_gstin', 'revision_number',
    ]) {
      expect(trigger).toContain(col);
    }
  });

  it('invoices with completed payments or paid status cannot be deleted', () => {
    expect(HARDENING_SQL).toContain('Paid invoices cannot be deleted');
    expect(HARDENING_SQL).toContain('Invoices with completed payments cannot be deleted');
  });

  it('invoices are forced to draft at INSERT (trigger + RPC)', () => {
    expect(HARDENING_SQL).toContain('enforce_invoice_insert_defaults');
    expect(HARDENING_SQL).toMatch(/NEW\.status := 'draft'/);
    // RPC ignores client-supplied status.
    expect(HARDENING_SQL).toMatch(/'draft', -- F4: server-authoritative/);
    // App fallback insert also forces draft.
    expect(INVOICE_REPO_SRC).toMatch(/\/\/ F4: invoices are always born as drafts[\s\S]*?status: 'draft'/);
  });

  it('money columns carry non-negativity CHECK constraints', () => {
    for (const c of [
      'invoices_subtotal_nonnegative',
      'invoices_total_nonnegative',
      'invoices_outstanding_nonnegative',
      'invoice_items_quantity_nonnegative',
      'projects_budget_nonnegative',
      'proposals_pricing_nonnegative',
      'payment_attempts_amount_positive',
      'payment_receipts_amount_positive',
    ]) {
      expect(HARDENING_SQL).toContain(c);
    }
  });
});

describe('F5 — payment state integrity at the database boundary', () => {
  const guard = HARDENING_SQL;

  it('amounts and transaction references are immutable after creation', () => {
    expect(guard).toContain('Payment amount is immutable after creation');
    expect(guard).toContain('Payment transaction reference is immutable after creation');
  });

  it('only forward transitions are permitted and terminals are frozen', () => {
    expect(guard).toMatch(
      /OLD\.status = 'pending' AND NEW\.status IN \('pending_verification', 'completed', 'failed'\)/
    );
    expect(guard).toMatch(
      /OLD\.status = 'pending_verification' AND NEW\.status IN \('completed', 'failed'\)/
    );
    expect(guard).toContain('Payments in terminal state');
  });

  it('completion requires verifier attribution for interactive callers', () => {
    expect(guard).toContain('Completing a payment requires verifier attribution');
  });

  it('settled payments cannot be deleted or soft-deleted', () => {
    expect(guard).toContain('Completed payments cannot be deleted');
    expect(guard).toContain('Settled payments are part of the financial record and cannot be deleted');
    expect(guard).toContain('payments_delete_guard_trigger');
  });
});

describe('F6 — OTP generation uses cryptographic randomness', () => {
  it('generate_portal_verification derives codes from pgcrypto entropy', () => {
    const fn = HARDENING_SQL.slice(
      HARDENING_SQL.indexOf('generate_portal_verification(token_val text)'),
      HARDENING_SQL.indexOf('F9: Absolute portal-token lifetime')
    );
    expect(fn).toContain('gen_random_bytes(4)');
    expect(fn).not.toMatch(/random\(\)\s*\*/);
    expect(fn).toContain("crypt(v_code, gen_salt('bf', 8))");
  });
});

describe('F7 (revised) — portal settings projection is UI-scoped', () => {
  it('exposes invoice-legal fields but never internal preference columns', () => {
    const fn = HARDENING_SQL.slice(
      HARDENING_SQL.indexOf('get_portal_settings(token_val text)'),
      HARDENING_SQL.indexOf('get_portal_proposal(token_val text)')
    );
    // Required by GST Rule 46 supplier particulars + payment instructions.
    for (const required of ['company_name', 'gstin', 'upi_id', 'state', 'address', 'bank_account_no']) {
      expect(fn).toContain(required);
    }
    // Internal-only preferences must never be selected into the projection.
    expect(fn).not.toMatch(/SELECT s\.(id|workspace_id|updated_at|default_tds_section|preferred_currency)\b/);
  });
});

describe('F9 — portal tokens have an absolute lifetime', () => {
  it('all portal functions enforce portal_token_is_live (90-day absolute cap)', () => {
    expect(HARDENING_SQL).toContain("now() - interval '90 days'");
    const calls = [...HARDENING_SQL.matchAll(/public\.portal_token_is_live\(/g)].length;
    // 7 getters + verify/signature/payment/feedback/approve = 12 call sites.
    expect(calls).toBeGreaterThanOrEqual(12);
  });
});

describe('F10 — dashboard RPC derives identity from JWT', () => {
  it('ignores the spoofable p_profile_id parameter', () => {
    const fn = HARDENING_SQL.slice(
      HARDENING_SQL.indexOf('get_dashboard_data(p_workspace_id UUID, p_profile_id UUID)'),
      HARDENING_SQL.indexOf('Consolidated execution grants')
    );
    expect(fn).toContain('v_caller_profile := auth.uid()');
    expect(fn).toMatch(/WHERE id = v_caller_profile/);
  });
});

describe('F13 — storage policies are committed to the repository', () => {
  it('owner-scoped CRUD policies are generated for every application bucket', () => {
    expect(HARDENING_SQL).toMatch(
      /\[\s*'avatars','branding','contracts','proposals','invoices','deliverables'\s*\]/
    );
    for (const op of ['select', 'insert', 'update', 'delete']) {
      expect(HARDENING_SQL).toContain(`'Owner ${op} '`);
    }
  });
});

describe('RLS baseline posture remains intact', () => {
  const TENANT_TABLES = [
    'profiles', 'workspaces', 'workspace_settings', 'clients', 'projects',
    'project_briefs', 'proposals', 'proposal_sections', 'contracts',
    'contract_signatures', 'invoices', 'invoice_items', 'invoice_versions',
    'payments', 'deliverables', 'file_uploads', 'activity_logs',
    'email_logs', 'financial_audit_trail', 'portal_verifications',
    'tds_certificates', 'tax_audit_logs', 'payment_requests',
    'payment_attempts', 'payment_verifications', 'payment_audit_logs',
    'payment_receipts',
  ];

  it.each(TENANT_TABLES)('RLS enabled on %s', (table) => {
    expect(BASELINE_SQL).toMatch(
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)
    );
  });

  it('portal_verifications is deny-all at the table boundary', () => {
    expect(BASELINE_SQL).toContain('"RPC only" ON public.portal_verifications FOR ALL USING (false)');
  });

  it('rate-limit consumption is service-role-only', () => {
    expect(BASELINE_SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consume_edge_rate_limit\(text, integer, integer\) TO service_role/
    );
  });
});

describe('F8/F15 — email dispatch surface is locked down', () => {
  it('send-email no longer accepts user-JWT direct dispatch', () => {
    expect(SEND_EMAIL_SRC).not.toContain('auth.getUser()');
    expect(SEND_EMAIL_SRC).toContain('service-role');
  });

  it('error responses never reflect internal/provider messages', () => {
    expect(SEND_EMAIL_SRC).not.toMatch(/\{ error: error\.message \}/);
    expect(WEBHOOK_SRC).not.toMatch(/\{ error: error\.message \}/);
  });
});

describe('Signed-URL authorization surface', () => {
  it('bucket allowlist remains closed and token-gated', () => {
    expect(SIGNED_URL_SRC).toContain('SUPPORTED_BUCKETS');
    expect(SIGNED_URL_SRC).toContain('get_portal_project');
    expect(SIGNED_URL_SRC).toContain('does not belong to this project portal');
  });
});
