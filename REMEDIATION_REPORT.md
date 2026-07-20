# Ujrat remediation report

## Verified findings

| Issue ID | Category | Severity | Status | Implementation and validation |
| --- | --- | --- | --- | --- |
| P0-1 | Portal authorization | P0 | Resolved | All portal read RPCs now reject expired tokens in `supabase/migrations/000_baseline.sql`; the migration validator asserts expiry checks for each audited RPC. |
| P0-2 | Contract persistence | P0 | Resolved | `ContractRepository` now writes and reads only `introduction`, `payment_schedule`, and `terms`. Generated contract/RPC types and portal mapping were synchronized. Typecheck and unit tests pass. |
| P0-3 | E2E reliability | P0 | Resolved | The lifecycle test is one sequential test, uses the exact signup placeholder, runs in a single worker, and no longer brute-forces OTP hashes. Playwright discovers all 70 tests. |
| P0-4 | Signed URL authorization | P0 | Resolved | `create-signed-url` requires the Supabase anon bearer key, validates its input and bucket, verifies portal ownership, uses a one-hour URL TTL, and fails closed if its limiter is unavailable. |
| P1-1 | Lint and type quality | P1 | Partially resolved | Typecheck has no errors and `npm run lint` exits successfully. Remaining advisory warnings are concentrated in pre-existing `any` usages and must be removed before claiming zero-warning certification. |
| P1-2 | Storage authorization | P1 | Resolved | Anonymous direct storage SELECT policies were removed. Authenticated workspace-owner policies remain; portal files are available only through the signed-URL function. |

## Additional certified hardening

| Issue ID | Category | Status | Implementation and validation |
| --- | --- | --- | --- |
| H-1 | Rate limiting | Resolved | Added an atomic, service-role-only fixed-window counter and shared Edge Function rate-limit client for signed URL requests. |
| H-2 | Accessibility | Resolved | `Dialog` now has modal semantics, keyboard trapping, Escape handling, and focus restoration, covered by three focused unit tests. |
| H-3 | Migration hygiene | Resolved | Removed the 36-file legacy migration archive and retained one consolidated baseline. `npm run validate:migrations` checks layout, portal TTL invariants, rate-limit objects, and anonymous storage policy regressions. |
| H-4 | Delivery security | Resolved | CI runs lint, typecheck, unit tests, build, E2E, dependency audit, secret scanning, CodeQL, and migration validation. Vercel headers include CSP, HSTS, frame protection, and restrictive browser policies. |

## Validation evidence

- `npx tsc -b --noEmit` — passed
- `npm test` — passed: 8 files, 49 tests
- `npm run validate:migrations` — passed
- `npm run build` — passed
- `npm run test:e2e -- --list` — passed: 70 tests discovered
- `npm audit --audit-level=high` — passed: 0 vulnerabilities
- `npm run lint` — passed with advisory warnings still reported

## Release assessment

The P0 release blockers and P1 storage vulnerability are remediated. Production certification remains **blocked** on the zero-warning requirement in P1-1 and on running the live E2E suite against an isolated Supabase environment; this workstation only performed Playwright discovery to avoid creating or modifying live customer data.
