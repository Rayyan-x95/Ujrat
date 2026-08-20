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

## 2. Automated Test Suite (22 Suites / 160 Tests Passing)

Ujrat maintains an exhaustive, domain-organized test harness using **Vitest**:

```text
Domain Test Suite Organization (22 Test Files / 160 Tests Passing):

🔐 Authentication & Access Control
✓ src/__tests__/auth-signup.test.ts (3 tests) - Registration bootstrap, mock validation, error handling
✓ src/__tests__/auth-otp-zero-trust.test.ts (5 tests) - Brute-force resistance, timing attack defense

💰 Finance, Tax & Invoicing Engine
✓ src/__tests__/finance-tax-engine.test.ts (20 tests) - GST, CGST/SGST/IGST, interstate splits, rounding
✓ src/__tests__/finance-stress-precision.test.ts (11 tests) - 100k transaction paise invariant, ₹100 Cr invoices, TDS cliffs, discounts
✓ src/__tests__/finance-milestones-advance.test.ts (8 tests) - Milestone breakdown, advance calculations
✓ src/__tests__/finance-invariants-race.test.ts (10 tests) - Payment settlement & multi-installment reconciliations

💳 Payments & UPI Provider
✓ src/__tests__/payments-upi-system.test.ts (7 tests) - NPCI URI formatting, QR generation, deep links, UTR fuzzing
✓ src/__tests__/payments-security-policy.test.ts (11 tests) - Password security, financial invariants

🛡️ Security & Multi-Tenancy
✓ src/__tests__/security-multi-tenant-isolation.test.ts (9 tests) - Workspace ID scoping, cross-tenant isolation
✓ src/__tests__/security-definer-rpc.test.ts (7 tests) - Public client portal token authorization
✓ src/__tests__/security-input-fuzzing.test.ts (6 tests) - SQL injection & XSS fuzzing payloads
✓ src/__tests__/security-adversarial-attacks.test.ts (6 tests) - Polyglot SQLi, XSS, prototype pollution, ReDoS

⚡ Concurrency & Performance SLAs
✓ src/__tests__/concurrency-race-conditions.test.ts (3 tests) - Double-spend settlement race, state transition storms
✓ src/__tests__/performance-benchmarks.test.ts (4 tests) - 500 tax calculations (<150ms), 2,500 UPI URIs (<100ms)

⚙️ Core Domain & State Machines
✓ src/__tests__/core-state-machines.test.ts (16 tests) - Project & invoice state machine transitions
✓ src/__tests__/core-qol-features.test.ts (6 tests) - Keyboard shortcuts, WhatsApp sharing URL generation, SAC presets
✓ src/__tests__/core-waitlist.test.ts (7 tests) - Priority onboarding, referral tracking

🛠️ Utilities & Helpers
✓ src/__tests__/utils-currency.test.ts (5 tests) - Indian numbering format (Lakhs/Crores)
✓ src/__tests__/utils-date.test.ts (4 tests) - IST timezone & billing cycle calculations
✓ src/__tests__/utils-hooks.test.ts (5 tests) - Theme switching, viewport reactivity

🎨 UI Presentation & Primitives
✓ src/__tests__/ui-dialog.test.tsx (3 tests) - Modal accessibility, trap focus
✓ src/__tests__/ui-components.test.tsx (4 tests) - Button, Badge, and Avatar component integrity
```

### Running Test Harness:
```bash
# Run all 22 test suites once in headless mode
npm test -- --run

# Run TypeScript compiler check
npx tsc --noEmit
```
