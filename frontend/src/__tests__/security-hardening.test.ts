import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
const SIGNED_URL_SRC = readFileSync(
  path.join(BACKEND, 'supabase/functions/create-signed-url/index.ts'),
  'utf8'
);
const PORTAL_FIXES_SQL = readFileSync(
  path.join(BACKEND, 'supabase/migrations/20261105000000_portal_payment_otp_dashboard_fixes.sql'),
  'utf8'
);
const INVOICE_REPO_SRC = readFileSync(
  path.join(FRONTEND, 'src/features/invoices/repositories/InvoiceRepository.ts'),
  'utf8'
);

describe('F1/F2 — gateway webhook settlement is authenticated and schema-correct', () => {
  it('payment-webhook fails closed when no webhook secret is configured', () => {
    // Direct UPI: no Razorpay/HMAC path; secret equality is the only guard.
    expect(WEBHOOK_SRC).not.toMatch(/Razorpay|razorpay|crypto\.subtle|HMAC/);
    expect(WEBHOOK_SRC).toMatch(/if \(!webhookSecret\)[\s\S]*?status: 503/);
    expect(WEBHOOK_SRC).toMatch(/x-webhook-signature/);
    expect(WEBHOOK_SRC).toMatch(/Direct UPI/);
    // The old "verify only when configured" pattern must not return.
    expect(WEBHOOK_SRC).not.toMatch(/if \(webhookSecret\) \{/);
  });

  it('webhook uses direct UPI payload only (no gateway fallback)', () => {
    expect(WEBHOOK_SRC).toContain('invoice_id');
    expect(WEBHOOK_SRC).not.toMatch(/payment\.captured|description.*INV/);
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
    expect(fn).toContain("crypt(v_code, extensions.gen_salt('bf', 8))");
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

describe('F8/F15 — no email dispatch surface remains', () => {
  it('send-email function is removed (no emails sent)', () => {
    // send-email edge function was deleted locally; PortalService no longer invokes it.
    const portalService = readFileSync(
      path.join(FRONTEND, 'src/features/portal/services/PortalService.ts'),
      'utf8'
    );
    expect(portalService).not.toContain("invoke('send-email'");
    expect(portalService).toContain("invoke('create-signed-url'");
  });

  it('error responses never reflect internal/provider messages', () => {
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

describe('Portal payment and OTP hardening (2026-11-05)', () => {
  it('deliverable downloads are escrowed until every issued invoice is paid', () => {
    expect(SIGNED_URL_SRC).toContain('Downloads unlock once all invoices are paid');
    expect(SIGNED_URL_SRC).toContain("rpc('get_portal_invoices'");
  });

  it('signature requires a verified, unexpired OTP row instead of a client boolean', () => {
    expect(PORTAL_FIXES_SQL).toContain('verified = true');
    expect(PORTAL_FIXES_SQL).toContain('Email verification is required before signing');
  });

  it('drafts are neither readable nor payable through the portal', () => {
    expect(PORTAL_FIXES_SQL).toMatch(/inv\.status <> 'draft'/);
    expect(PORTAL_FIXES_SQL).toContain('Invoice has not been issued yet');
  });

  it('a second payment attempt cannot be queued while one awaits verification', () => {
    expect(PORTAL_FIXES_SQL).toContain('A payment for this invoice is already awaiting verification');
  });

  it('portal tokens have an explicit 90-day default and backfill', () => {
    expect(PORTAL_FIXES_SQL).toContain("SET DEFAULT (now() + interval '90 days')");
    expect(PORTAL_FIXES_SQL).toMatch(/SET portal_token_expires_at = created_at \+ interval '90 days'/);
  });
});

// --- Track 6 safety nets (static-text only; tolerant during parallel build) ---

const DASH_SERVICE_SRC = readFileSync(
  path.join(FRONTEND, 'src/features/dashboard/services/DashboardService.ts'),
  'utf8'
);
const PORTAL_REPO_SRC = readFileSync(
  path.join(FRONTEND, 'src/features/portal/repositories/PortalRepository.ts'),
  'utf8'
);

describe('Track 6 — dashboard is RPC-only (no table fallback)', () => {
  it('DashboardService calls get_dashboard_data RPC and has no table-based fallback', () => {
    expect(DASH_SERVICE_SRC).toMatch(/rpc\(.*get_dashboard_data/);
    // F5-track regression guard: the 6-query table fallback must stay deleted.
    expect(DASH_SERVICE_SRC).not.toContain('getDashboardDataFromTables');
  });
});

describe('Track 6 — portal bundle is a single RPC (with fallback)', () => {
  it('PortalRepository uses get_portal_bundle or the per-entity RPCs', () => {
    expect(PORTAL_REPO_SRC).toMatch(/get_portal_bundle|get_portal_project/);
  });
});

describe('Track 6 — overdue sweep cron marker', () => {
  it('an overdue-sweep migration or ujrat overdue cron.schedule exists', () => {
    const migrationsDir = path.join(BACKEND, 'supabase/migrations');
    const names = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.sql'))
      .map((d) => d.name);
    const dirHasOverdue = names.some((n) => /overdue|sweep/i.test(n));
    let sqlHasCron = false;
    if (dirHasOverdue) {
      sqlHasCron = names.some((n) => {
        if (!/overdue|sweep/i.test(n)) return false;
        const sql = readFileSync(path.join(migrationsDir, n), 'utf8');
        return /cron\.schedule\(\s*['"]ujrat-(overdue-sweep|mark-overdue)/.test(sql);
      });
    }
    expect(dirHasOverdue || sqlHasCron).toBe(true);
  });
});
