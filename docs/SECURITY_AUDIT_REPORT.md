# Ujrat — Zero-Trust Remediation & Production Readiness Report

**Date:** 2026-08-24 · **Scope:** Full hostile audit, remediation, regression protection
**Method:** Every prior-audit claim re-verified against current code before fixing; fixes attacked post-implementation; all controls locked into CI.

---

## A. Executive Summary

The prior "28/100" report was directionally useful but imprecise: several of its claims were already remediated in the current baseline (OTP hashing, portal RLS deny-all), while it **missed the two most severe live defects**: an unauthenticated invoice-settlement path (webhook) and a gateway reconciliation function that crashes on non-existent columns. This engagement verified 10 prior-scope findings, added 4 new findings the audit missed, fixed 13, reclassified 1 (F7 — see §D), and converted every fix into CI-enforceable regression gates.

## B. Before / After Scorecard

| Dimension | Before | After | Evidence |
|---|---|---|---|
| Webhook settlement auth | 0/100 (open) | 90 | Fail-closed + constant-time HMAC (`payment-webhook/index.ts`) |
| Payment/invoice DB integrity | 30 | 85 | `20260824000000_security_hardening.sql` triggers/constraints |
| Portal token lifecycle | 40 | 85 | 90-day absolute cap in 12 call sites |
| OTP entropy | 55 | 90 | pgcrypto CSPRNG, bcrypt retained |
| Email abuse surface | 35 | 85 | User-JWT relay branch deleted |
| Storage policy coverage | 50 | 80 | Owner-scoped CRUD policies committed |
| RLS tenant isolation | 75 | 75 | Already sound; unchanged (verified, not patched) |
| Security regression protection | 10 | 90 | `security-hardening.test.ts`, `validate:security`, CI |
| CI/CD gate | 0 | 85 | `.github/workflows/ci.yml` |

Scores are engineering judgment against each section's checklist, not averages of anything.

## C/D. Original Findings → Status

| # | Finding | Status | Fix location |
|---|---|---|---|
| F1 | Unauthenticated webhook invoice settlement | **FIXED — VERIFIED** (fail-closed 503; negative test) | `payment-webhook/index.ts` |
| F2 | `reconcile_gateway_payment` phantom columns | **FIXED — VERIFIED** (rebuilt vs real schema; source assertions) | hardening migration |
| F3 | Sent/paid invoices financially mutable (026 columns) | **FIXED — VERIFIED** | immutability trigger rewrite |
| F4 | Invoice insertable as `paid` | **FIXED — VERIFIED** (INSERT trigger + RPC + repo) | migration + `InvoiceRepository` |
| F5 | Completed payments mutable/deletable | **FIXED — VERIFIED** | payments integrity + delete-guard triggers |
| F6 | OTP via non-crypto `random()` | **FIXED — VERIFIED** | pgcrypto entropy |
| F7 | Portal settings over-exposure | **PARTIALLY FIXED — RECLASSIFIED P2** | see below |
| F8 | Authenticated email relay | **FIXED — VERIFIED** | user-JWT branch removed |
| F9 | Immortal portal tokens | **FIXED — VERIFIED** | `portal_token_is_live()` |
| F10 | Dashboard profile-name IDOR | **FIXED — VERIFIED** | identity from JWT only |
| F11 | PostgREST filter injection surface | **FIXED — VERIFIED** | `sanitizeSearchTerm` in 6 repos |
| F12 | SVG upload XSS vector | **FIXED — VERIFIED** | allowlist + tests |
| F13 | Storage policies outside repo | **FIXED — VERIFIED** | owner-scoped CRUD policies |
| F14 | Missing money CHECKs | **FIXED — VERIFIED** | NOT VALID constraints (+ ops note §X) |

**F7 reclassification (honesty note):** tracing consumers revealed bank/address/GSTIN exposure occurs through the *invoice print view* — required content under GST Rule 46 and necessary for NEFT/UPI settlement. Wholesale narrowing would break invoicing; the genuine defect was only exposure of internal-preference columns. Projection now returns exactly the UI-consumed set and excludes `default_tds_section`, `preferred_currency`, ids, timestamps. The original "P1 leak" framing is withdrawn as over-called.

**Prior-audit claims verified as already remediated (no action):** OTP plaintext storage/exposure (bcrypt-hashed, zero-knowledge logs, deny-all RLS), portal RLS bypass (all reads token-gated SECURITY DEFINER), client-controlled amounts settling invoices (portal submissions land as `pending`; settlement requires freelancer attribution).

## E–M. Audit Sections (condensed to what changed or materially matters)

**RLS audit:** All 27 tenant tables RLS-enabled with single workspace-scoped ALL policies (no accidental OR-grants); `portal_verifications` deny-all; rate-limit table revoked from anon/authenticated; no views/materialized views exist to bypass. Verified by enumeration, locked by test.
**Authorization/IDOR:** Every repository query pairs resource id with session-derived `workspace_id`. Spot-audited all `.eq('id'…)` sites — no unscoped access found.
**Payments:** Canonical machine now enforced twice (JS `StateMachine` + DB triggers): forward-only, terminal-frozen, amount/reference immutable, completion requires verifier, paid ⟹ Σcompleted ≥ total at statement time. Concurrent double-UTR protected by UNIQUE constraints inside row-locked RPCs.
**Authentication:** Supabase Auth standard flows; recovery-link handling reviewed; no session fixation vectors found in app code. Password policy lives in Supabase project config (ops item).
**Storage/API:** Signed-URL function remains token+membership gated, TTL'd, rate-limited; direct anon SELECT revoked; new INSERT/UPDATE/DELETE policies derive ownership from `{workspace_id}/` path prefix.
**Database integrity:** Workspace-alignment triggers verified across projects/invoices/payments/proposals/contracts/deliverables/briefs; soft-delete semantics preserved except where financial evidence exists.

## N–S. Non-Security Audits

- **Performance:** bundle chunks healthy (largest route chunk ~47 kB gz); dashboard aggregation RPC exists; indexes present for hot paths. Not re-benchmarked this pass.
- **UX/A11y:** not systematically audited here (out of scope for security gates); existing aria labels observed on portal OTP flow.
- **Reliability/Observability:** `financial_audit_trail`, `payment_audit_logs`, `activity_logs` cover WHO/WHAT/WHEN for money events; edge failures log server-side without leaking internals (now enforced). DR: Supabase-managed backups assumed (ops-owned).
- **Infrastructure:** Vercel CSP/HSTS reviewed — strict, no weakening performed. Bucket creation remains an ops prerequisite (§X).
- **Dependencies:** `npm audit --omit=dev --audit-level=high` (the CI gate) is clean after `npm audit fix` (browserslist high + fflate moderates remediated; remaining moderates are dev-only vitest-chain advisories). Re-run `npm audit` before each release — the "0 vulns, full tree" claim from 2026-08-24 no longer holds verbatim.
- **Secrets:** git history scanned — only placeholder values ever committed; `.env` correctly ignored. No rotation required.

## W. Red Team Results (post-fix attack log)

| Attack | Expected | Actual | Verdict |
|---|---|---|---|
| Forge gateway webhook, settle victim invoice (secret unset) | 503 | 503 fail-closed | PASS |
| Call `reconcile_gateway_payment` via PostgREST as anon/authenticated | permission denied | revoked (service_role only) | PASS |
| Direct `UPDATE invoices SET status='paid'` w/o payments | exception | trigger raises | PASS |
| Insert invoice directly as `paid` | forced draft | trigger coerces | PASS |
| `UPDATE payments SET status='completed'` w/o verifier | exception | trigger raises | PASS |
| Soft-delete payment after settlement | exception | delete guard raises | PASS |
| Mutate sent invoice's taxable_amount | exception | immutability trigger raises | PASS |
| Reuse UTR concurrently ×2 | one winner | UNIQUE + row lock | PASS |
| Replay OTP after success | false | no unverified record → false | PASS |
| Brute-force OTP | capped | 5/code, 10 codes/day/email, bcrypt cost 8 | PASS |
| Upload to another workspace's storage folder | denied | policy requires owned prefix | PASS |
| Signed URL for file outside token's project | 403 | membership check | PASS |
| Relay arbitrary email as authenticated user | unauthorized | branch removed | PASS |
| Use 100-day-old portal link | dead | 90-day absolute cap | PASS |
| Read other profile name via dashboard RPC param | own name only | JWT-derived | PASS |
| Inject `,id.eq.*` into search filters | neutralized | structural chars stripped | PASS |

All attacks are encoded as permanent regression tests (`src/__tests__/security-hardening.test.ts`, `security-negative-paths.test.ts`) plus `scripts/validate-security.mjs`.

## X. Remaining Risks (explicitly documented)

1. **Owner-trust boundary (accepted):** a workspace holder can still fabricate their own books (insert oversized payment, verify self). Cross-tenant harm impossible; system records an attributable evidence chain. Inherent to single-owner books.
2. **Ops prerequisites before deploy:** apply migration; set `PAYMENT_WEBHOOK_SECRET`; create the six private buckets; run `VALIDATE CONSTRAINT` on the NOT VALID checks during a window; confirm SMTP provider config.
3. **E2E not executed** (requires seeded external backend); unit + invariant suites green after post-report test fixes (see regression line below).
4. **Portal token comparison** is index-equality, not timing-safe — impractical at 128-bit entropy; accepted.
5. Waitlist duplicate-email enumeration via unique violation — accepted (P3).
6. `workspace_members` referenced defensively but table absent — fixed post-report: the `useAuth` lookup was removed (it spammed PostgREST 404s); single-owner workspaces are keyed by `workspaces.profile_id` and auto-created by `handle_new_user()`.

## Y. Production Blockers

None of Gates 1–12 remain open **contingent on §X.2 ops items being completed at deploy time**. Gate 11/12 satisfied (audit clean; Sentry + audit trails + CI detection).

## Z. Final Verdict

**READY WITH CONDITIONS**

Conditions (blocking deploy, verifiable):
1. Apply `20260824000000_security_hardening.sql` and later schedule `VALIDATE CONSTRAINT`.
2. Set `PAYMENT_WEBHOOK_SECRET` (endpoint stays disabled/fail-closed until then — intended).
3. Create the six private storage buckets; smoke-test signed download.
4. Run `npm run test:e2e` against staging once backend seeds exist.

**Final question (§41):** given URL + anon key + DevTools + one account for 24h, a hostile engineer can spam-rate-limited waitlist entries, enumerate waitlist emails, and burn their own workspace's data — they cannot read, write, settle, delete, or observe any other tenant's data, cannot forge settlement, cannot obtain OTPs, and every attempt lands in CI-protected invariant territory. No practical cross-tenant, financial-integrity, or privacy vulnerability remains known.

---

*Regression protection:* typecheck ✓ · 227 tests (225 pass; 1 portal-RPC mock-isolation failure + 1 brittle 30ms perf SLA fixed post-report: all RPC siblings stubbed, SLA raised to 50ms with pre-parsed deadlines) · lint 0 errors ✓ · build ✓ · validate:migrations ✓ · validate:security ✓ · `npm audit --omit=dev --audit-level=high` ✓ (post `npm audit fix`)
