# Ujrat Execution Plan — Improvements to Existing Features (No Agency)

Date: 2026-11-07
Owner: Crouton Alpha
Status: Ready to build

## Non-negotiables
- No new tables except where noted (1: `activity_logs` reuse, 1 RPC `get_portal_bundle`, 1 cron for overdue).
- No weakening of RLS / SECURITY DEFINER boundaries. `workspace_id` scoping on every query. Soft-delete `deleted_at` respected everywhere.
- No float money. All new sums in paise integers (`toPaise/fromPaise`). Existing `NUMERIC(12,2)` stays.
- State machines (`Project`/`Invoice`/`Payment`/`Proposal`/`Contract` in `shared/utils/StateMachine.ts`) are law — transitions validate, happy.
- Deletion > addition. No new dependency unless `zod`/`qrcode.react`/`lucide-react` already in `frontend/package.json`. `PapaParse` via `csvExport` helper, not new dep.
- Every track ships: code + Vitest (frontend) or `unittest` (backend) + `typecheck` + `build` + `validate:security` green. No partial merges.

## Track map (file ownership — no two tracks share a file)

### Track 1 — Dashboard + overdue engine (highest value)
**Goal:** kill the fallback scan, add aging buckets, auto-overdue.
**Files:** `frontend/src/features/dashboard/services/DashboardService.ts`, `dashboard/hooks/useDashboard.ts`, `dashboard/components/DashboardTemplate.tsx`, `backend/supabase/migrations/20261108000000_dashboard_aging_overdue.sql`, `frontend/src/features/payments/hooks/*` untouched.
**Changes:**
- Delete `getDashboardDataFromTables` 6-query fallback. `getDashboardData` = single `rpc('get_dashboard_data')`, error → throw (no JS recompute).
- RPC returns `aging: {overdue, due_7d, later}` from `due_date` + `outstanding_balance`. Dashboard renders 3 stat buckets with counts.
- Cron (pg_cron `ujrat-overdue-sweep` daily 06:00 IST): `UPDATE invoices SET status='overdue' WHERE due_date < CURRENT_DATE AND status IN ('sent','viewed','partially_paid') AND deleted_at IS NULL`. Add matching state-machine rule `sent/viewed/partially_paid → overdue`.
- **Tests:** `utils-hooks.test.ts` update (RPC-only), new `dashboard-aging.test.ts` (3 invoices across buckets), migration header check.
**Done when:** `npm run typecheck`, `npm test`, `npm run build`, `validate:migrations` all green; dashboard makes exactly 1 RPC on load (check Network tab proof in PR).

### Track 2 — Lists + UPI service (throughput)
**Goal:** 1 round-trip per list, no `select('*')` on hot paths.
**Files:** `frontend/src/shared/utils/repository.ts`, `features/clients|projects|invoices|payments/repositories/*`, `features/payments/services/PaymentService.ts`, `features/payments/components/UPIPaymentCard.tsx`, `features/invoices/tax/InvoiceCalculator.ts` (read-only).
**Changes:**
- New RPC `get_workspace_list_counts` not needed — instead: `getListPage(table, page, pageSize)` helper that does `.range()` once + `count: exact`. Replace `fetchAllPages` 100-row loops in `useClients/useProjects/useInvoices`.
- Slim selects on list queries to needed cols (`id, name, status, total, outstanding_balance, created_at`). Detail queries keep `*` (small, single-row).
- Move UPI intent building out of components into `PaymentService.generateUpiLink({vpa, amountPaise, note})` — enforce `currency=INR`, validate VPA with `^[\w.-]+@[\w.-]+$` (reuse `WorkspaceSettingsSchema` regex), paise integer in/out.
- Webhook: remove float `amount/100` → paise integer in `payment-webhook/index.ts`; keep Direct UPI `{invoice_id, amount (paise int), transaction_id}` contract. Redeploy with `verify_jwt=false` + `x-webhook-signature` secret check (already in code).
- **Tests:** `payments-upi-system.test.ts` add VPA fuzz + paise round-trip, `repository-pagination.test.ts` (page 2 of 250 rows = 1 query).
**Done when:** lists fire exactly 1 query per page (Vitest mock counts calls), VPA `paytm` without `@` rejected, webhook test with paise int passes.

### Track 3 — Auth/workspace cache + portal bundle
**Goal:** instant shell, one portal round-trip, views tracked.
**Files:** `frontend/src/features/auth/hooks/useAuth.ts`, `frontend/src/features/workspace/services/WorkspaceService.ts`, `frontend/src/features/portal/services/PortalService.ts`, `frontend/src/features/portal/repositories/PortalRepository.ts`, `frontend/src/features/portal/hooks/useClientPortal.ts`, `backend/supabase/migrations/20261108000001_portal_bundle.sql`.
**Changes:**
- `useAuth`: delete 200ms sleep + second `getWorkspaces` retry. After first success, `localStorage.setItem('ujrat.workspaceId', id)`. `fetchSession` reads cache synchronously → shell paints instantly, revalidates in background. `onAuthStateChange` same.
- `WorkspaceService.getWorkspaces`: select `id,name,profile_id,created_at` only (was `*`).
- New RPC `get_portal_bundle(token)` → `{project, client, settings, proposal, contract, invoices(with items), deliverables}` in one call. `PortalService.getPortalData` calls it once; old 7-RPC path only as error fallback. `get_portal_invoices` joins items server-side (remove client-side join + throw-on-fail).
- View tracking: `get_portal_bundle` inserts `activity_logs(action='portal_view', ip, ua)` fire-and-forget. Show `lastViewedAt + viewCount` on `ProjectDetailsTemplate`.
- `useWorkspaceSettings`: `staleTime: 5*60_000` (was 30s), `gcTime: 10*60_000`.
- **Tests:** `auth-signup.test.ts` (cache hit = no network), `portal-bundle.test.ts` (bundle returns 7 keys in 1 RPC, items joined), `portal-viewed.test.ts` (view increments).
**Done when:** login shell renders before workspace RPC resolves (E2E `auth-flow.spec.ts` timing), portal opens with 1 RPC (mock count=1), viewed chip appears in project details.

### Track 4 — Contracts transaction + signed-URL cache
**Goal:** no partial-failure money state, cheap downloads.
**Files:** `frontend/src/features/contracts/services/ContractService.ts`, `frontend/src/features/contracts/repositories/ContractRepository.ts`, `backend/supabase/migrations/20261108000002_contract_sign_tx.sql`, `backend/supabase/functions/create-signed-url/index.ts`, `frontend/src/features/settings/services/StorageService.ts`.
**Changes:**
- New RPC `sign_contract_transactional({p_workspace_id, p_project_id, p_signature...})` → inserts `contract_signatures` + updates `contracts=signed` + `projects=contract_signed` + `activity_logs` atomically. `ContractService.signContract` calls RPC; compensating rollback code deleted.
- `create-signed-url`: cache `get_portal_invoices paid-check` for 60s per token (module-level `Map<token, {expires, paid}>`). Second deliverable download within 60s skips the 4th RPC. Signed URL TTL stays 1h, add `Cache-Control: public, max-age=3600, immutable` on returned URL headers.
- `StorageService`: reject >10MB already exists — add 2MB canvas-image downscale warning in UI before upload (canvas offload, no new dep).
- **Tests:** `contract-tx.test.ts` (RPC called, no JS rollback branch), `signed-url-cache.test.ts` (2nd call within 60s = 0 RPCs).
**Done when:** sign failure leaves zero partial rows (rollback test), second download is <50ms from cache.

### Track 5 — UI polish + money rail + WhatsApp
**Goal:** mobile without overflow, one-click UPI from list, nudges without email.
**Files:** `frontend/src/app/layouts/DashboardLayout.tsx`, `frontend/src/app/layouts/MobileLayout.tsx`, `frontend/src/shared/hooks/useIsMobile.ts`, `frontend/src/shared/ui/Table.tsx`, `frontend/src/shared/utils/StateMachine.ts` (read), `frontend/src/features/invoices/components/InvoicesTemplate.tsx`, `frontend/src/features/payments/hooks/usePayments.ts`.
**Changes:**
- Drawer: copy `CommandPalette` Escape handling (close on Escape + `role=dialog` + scroll-lock via `document.body.style.overflow`).
- 320px fix: bottom dock 5×`max-w-[64px]` → `max-w-[56px]`, hide labels at `max-width:360px` (Tailwind `min-[360px]:label`). FAB `bottom-20` → `bottom-[72px]` + `pb-32` on main.
- `Table` skeleton: fixed `w-[12ch]` / `w-[16ch]` columns (kill `%` widths) → zero CLS.
- Invoice rows: `Copy UPI ID | Share | Mark paid` from `WorkspaceService.getSettings` (no extra fetch). `Share` = `navigator.share` with `upi://pay` link from Track 2 service.
- WhatsApp nudge: `whatsappShare.ts` already exists — add `buildReminderLink({phone, invoiceNo, amount, upi})` + `Overdue` chip on `InvoicesTemplate` when `status='overdue'`. Client form: consent checkbox `whatsapp_reminders` (nullable boolean, no migration — runtime-only if column absent, guarded).
- **Tests:** `mobile-layout.test.tsx` (drawer Escape closes, 320px no overflow), `invoice-rail.test.tsx` (copy/share/mark-paid hit correct service), `whatsapp-share.test.ts` (deep-link shape + phone encode).
**Done when:** Lighthouse CLS <0.1 on dashboard, 320px E2E `Mobile Chrome` passes, WhatsApp link opens with correct UPI QR.

## Track 6 — safety nets (runs last, blocks merge)
**Files:** `frontend/src/__tests__/security-hardening.test.ts`, `backend/scripts/validate-security.mjs`, `backend/scripts/validate-migrations.mjs`, `.github/workflows/ci.yml`, `backend/k6/*`, `e2e/*`.
**Changes:**
- `security-hardening`: dashboard-RPC-only assertion, portal-bundle single-RPC assertion, overdue cron marker.
- `validate-security`: webhook `verify_jwt: false` + secret header check, signed-URL cache marker.
- k6: add `POST /rest/v1/rpc/get_dashboard_data` threshold `p(95)<800ms` + `create_invoice_transactional` smoke (counts only, no money write — dry-run workspace).
- Playwright: `Mobile Chrome` project gets `viewport: 360x740` + portal-viewed spec (open portal twice → chip = 2).
- Migration validator: assert new 20261108* files sort last, no `archive/` dir, `portal_verifications` not re-created.
- **Tests:** Track 6 is tests. Full suite must pass: `npm run test`, `npm run test:backend`, `npm run validate:migrations`, `npm run validate:security`, `npm run typecheck`, `npm run build`.

## Global acceptance (every track)
- `npm run typecheck` → 0 errors. `npm run build` → succeeds in <5s. `npm run test` → 257+ (Track 1–5 each +5..10 new). `npm run test:backend` → green. `validate:migrations` + `validate:security` → pass.
- No new dependency in `package.json`. No `select('*')` added. Every new query has `.eq('workspace_id', ...)` + `.is('deleted_at', null)`.
- Manual proof per track attached (Network tab screenshot count or mock call count in Vitest output).

## Rollout order
1. Track 1 + 2 launch first (dashboard + lists fix p95 globally).
2. Track 3 (auth/portal) second — makes Track 1/2 results visible faster.
3. Track 4 + 5 in parallel (no file overlap).
4. Track 6 last — locks everything, adds k6 thresholds before prod traffic.

## Risks
- Dropping dashboard fallback: if RPC returns 500, dashboard is blank. Mitigation: Track 6 adds RPC smoke in k6 + Sentry `captureException` in `useDashboard` error state (already 1 retry).
- Portal bundle RPC: token-validity must be byte-identical to 7-RPC path or portal leaks. Track 6 includes portal-bundle parity test vs old path on seeded workspace.
- Overdue cron: timezone — run in IST (`Africa/Abidjan`? No: use `Asia/Kolkata` in cron string) and test with due_date boundary (23:59 vs 00:00).
