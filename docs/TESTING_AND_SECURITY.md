# 🛡️ Testing & Security Infrastructure Documentation

This document covers Ujrat's security architecture, zero-trust cryptographic guarantees, and the automated test harness.

---

## 1. Security Architecture & Threat Defense

### 1.1 Multi-Tenant Row Level Security (RLS)
PostgreSQL Row-Level Security ensures that tenant queries cannot leak cross-workspace data even in the event of an application-layer bug:
* Every tenant table enforces `workspace_id` verification.
* Direct SQL injection is mitigated via parameterized queries throughout the Supabase client.

### 1.2 Zero-Trust OTP & Authentication
* **Password Policy**: Minimum 12 characters requiring uppercase, lowercase, numeric, and symbol combinations.
* **OTP Rate Limiting**: Max 5 attempts per 15-minute window with exponential backoff.
* **Timing-Attack Safe Comparison**: Cryptographic constant-time string comparisons.

### 1.3 Input Sanitization & Adversarial Attack Defense
* **XSS & HTML Injection Defense**: Strips `<script>`, `<iframe>`, `javascript:`, and nested polyglot payloads.
* **Prototype Pollution Guard**: Blocks `__proto__`, `constructor`, and `prototype` object key tampering.
* **Unicode & RTL Homoglyph Filtering**: Cleanses zero-width spaces (`\u200B` to `\u200D`, `\uFEFF`) and right-to-left override tokens (`\u202E`).
* **ReDoS Protection**: Validates regex evaluation complexity against 10,000-character evil backtracking strings under a strict <15ms SLA.

---

## 2. Automated Test Suite (43 Suites / 328 Tests Passing)

Ujrat maintains an exhaustive, domain-organized test harness using **Vitest**:

```text
Domain Test Suite Organization (43 Test Files / 328 Tests Passing):

🔐 Authentication & Access Control
✓ src/__tests__/auth-signup.test.ts (4 tests) - Registration bootstrap, mock validation, error handling
✓ src/__tests__/auth-otp-zero-trust.test.ts (5 tests) - Brute-force resistance, timing attack defense
✓ src/__tests__/client-error-report.test.ts (7 tests) - Error reporting pipeline, no secret leakage

💰 Finance, Tax & Invoicing Engine
✓ src/__tests__/finance-tax-engine.test.ts (18 tests) - GST, CGST/SGST/IGST, interstate splits, rounding
✓ src/__tests__/finance-stress-precision.test.ts (11 tests) - 100k transaction paise invariant, ₹100 Cr invoices, TDS cliffs, discounts
✓ src/__tests__/finance-milestones-advance.test.ts (9 tests) - Milestone breakdown, advance calculations
✓ src/__tests__/finance-invariants-race.test.ts (10 tests) - Payment settlement & multi-installment reconciliations
✓ src/__tests__/tax-parity.test.ts (1 test) - Tax engine parity against the stored invoice snapshot

💳 Payments & UPI Provider
✓ src/__tests__/payments-upi-system.test.ts (5 tests) - NPCI URI formatting, UTR fuzzing, paise-accurate links
✓ src/__tests__/payments-security-policy.test.ts (11 tests) - Password security, financial invariants
✓ src/__tests__/verify-race-guard.test.ts (3 tests) - Concurrent verification race guard
✓ src/__tests__/invoice-draft-tx.test.ts (4 tests) - Atomic draft invoice edit
✓ src/__tests__/invoice-rail.test.tsx (12 tests) - Invoice money rail, UPI share, verify/reject actions
✓ src/__tests__/invoice-print-stored-values.test.tsx (2 tests) - Printed invoice shows the stored tax, never a recomputed one

🛡️ Security & Multi-Tenancy
✓ src/__tests__/security-hardening.test.ts (30 tests) - RLS baseline posture, hardening invariants
✓ src/__tests__/security-negative-paths.test.ts (12 tests) - Negative paths for auth, storage and portal reads
✓ src/__tests__/security-multi-tenant-isolation.test.ts (10 tests) - Workspace ID scoping, cross-tenant isolation
✓ src/__tests__/security-definer-rpc.test.ts (7 tests) - Public client portal token authorization
✓ src/__tests__/security-input-fuzzing.test.ts (6 tests) - SQL injection & XSS fuzzing payloads
✓ src/__tests__/security-adversarial-attacks.test.ts (4 tests) - Polyglot SQLi, homoglyph/RTL traps, ReDoS

⚡ Concurrency & Performance SLAs
✓ src/__tests__/concurrency-race-conditions.test.ts (3 tests) - Double-spend settlement race, state transition storms
✓ src/__tests__/performance-benchmarks.test.ts (4 tests) - 500 tax calculations (<150ms), 2,500 UPI URIs (<100ms)

⚙️ Core Domain & State Machines
✓ src/__tests__/core-state-machines.test.ts (22 tests) - Project & invoice state machine transitions
✓ src/__tests__/core-qol-features.test.ts (6 tests) - Keyboard shortcuts, WhatsApp sharing URL generation, SAC presets
✓ src/__tests__/contract-tx.test.ts (3 tests) - sign_contract_transactional migration invariants
✓ src/__tests__/repository-pagination.test.ts (4 tests) - Paged repository reads, exact counts

🛰️ Client Portal & Edge Functions
✓ src/__tests__/portal-bundle.test.ts (5 tests) - Portal bundle projections
✓ src/__tests__/portal-followup.test.ts (3 tests) - Follow-up UPI CTA rules
✓ src/__tests__/portal-token-grace.test.ts (3 tests) - Previous-token grace window
✓ src/__tests__/signed-url-cache.test.ts (5 tests) - Signed download URL caching
✓ src/__tests__/edge-deploy.test.ts (3 tests) - Edge function deployment config
✓ src/__tests__/edge-rate-limit.test.ts (4 tests) - Edge rate limiting
✓ src/__tests__/dashboard-aging.test.ts (5 tests) - Dashboard ageing buckets

🛠️ Utilities & Helpers
✓ src/__tests__/utils-currency.test.ts (5 tests) - Indian numbering format (Lakhs/Crores)
✓ src/__tests__/utils-date.test.ts (8 tests) - IST timezone & billing cycle calculations
✓ src/__tests__/utils-hooks.test.ts (5 tests) - Theme switching, viewport reactivity
✓ src/__tests__/whatsapp-share.test.ts (4 tests) - WhatsApp reminder link builder

🎨 UI Presentation & Primitives
✓ src/__tests__/ui-dialog.test.tsx (3 tests) - Modal accessibility, trap focus
✓ src/__tests__/ui-components.test.tsx (5 tests) - Button, Badge, and Avatar component integrity
✓ src/__tests__/empty-states.test.tsx (3 tests) - Empty state guidance
✓ src/__tests__/mobile-layout.test.tsx (13 tests) - Mobile layout regressions
✓ src/__tests__/seo.test.ts (9 tests) - SEO metadata and structured data
✓ src/__tests__/prerender.test.ts (1 test) - Static prerender output
```

### Running Test Harness:
```bash
# Run all 43 test suites once in headless mode
npm test -- --run

# Run TypeScript compiler check
npx tsc --noEmit
```

---

## 3. End-to-End Coverage (Playwright)

The Playwright suite drives the **production build** (`frontend/dist` served by
`scripts/e2e-server.mjs`) against the live Supabase backend, so it exercises
the same bundles and RPCs that production runs.

```bash
npm run test:e2e                        # all browsers
npx playwright test --project=chromium  # one browser (fastest)
```

> The suite writes into the configured backend: each run creates a test user,
> workspace, client, project, contract and invoice. Run it against a staging
> project before a release, not against production data you care about.

### Covered flows

| Area | Spec | What it proves |
|------|------|----------------|
| Auth | `auth-flow.spec.ts` | Login form, signup/forgot routing, empty-email and weak-password validation |
| Client portal | `client-portal.spec.ts` | Client + project creation, proposal sent → client approves, contract sent → client signs, invoice issued → client submits the UTR → freelancer confirms, portal view tracking, hash-based portal tokens |
| Full lifecycle | `full-lifecycle.spec.ts` | Proposal → approval → contract → signature → invoice → payment → verification → paid, deliverables upload/escrow, invalid portal token never leaks project data |
| Proposal flow | `proposal-contract.spec.ts` | Client + project creation through the UI, proposal draft then share |
| Payment actions | `invoice-payment-actions.spec.ts` | Contract draft stays a draft (project does not advance), client pays in the portal, freelancer rejects the attempt (invoice returns to unpaid), Share builds a real `upi://pay` link, workspace backup downloads every row **without** the portal token hashes |

### Not covered yet

Dashboard widgets, brief editing, client edit/archive, project edit/delete,
invoice draft edit/delete, the printed invoice view (unit-tested instead), the
GSTR-1 CSV export, file-upload deliverables, and the settings tabs other than
Data & Backup.

### Rules the suite encodes

- Portal tokens are **hashed at rest**: a spec mints one and stores only the
  hash, exactly like the freelancer's share action does. Reading
  `projects.portal_token` returns nothing.
- Specs seed the freelancer's Supabase session from an SDK login instead of
  typing the password form, so a stalled auth request cannot fail a flow that
  does not test login. The auth spec still drives the real form.
- The lifecycle order is enforced by the product: proposal sent → client
  approves (`approved`) → contract drafted/sent → client signs
  (`contract_signed`) → only then can an invoice be generated. The invoice tab
  stays disabled before that, by design.
- Passwords are 12+ characters (the signup form and `AuthService` agree).
- Desktop Chrome exposes `navigator.share`; its OS sheet never settles headless,
  so the Share specs stub it and assert the `window.open` path.

