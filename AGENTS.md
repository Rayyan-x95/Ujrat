# AGENTS.md

Ujrat: React 19 + TypeScript + Vite SPA talking to Supabase directly (RLS + SECURITY DEFINER RPCs + Deno edge functions). The Python FastAPI backend was removed — it was never wired to the frontend.

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run typecheck    # tsc -b --noEmit (project references)
npm test             # Vitest frontend tests (single run)
npm run lint         # oxlint
npm run build        # tsc -b && vite build
```

- Single unit test (frontend): `npx vitest run src/__tests__/finance-tax-engine.test.ts` (add `-t "name"` to filter).
- E2E: `npm run test:e2e`. Playwright auto-starts the dev server, runs **serially** (`workers: 1`, `fullyParallel: false`) because lifecycle specs share external backend state, and executes every spec against 5 projects (chromium, firefox, webkit, Mobile Chrome, Mobile Safari). Load tests (`test:load*`) need k6 installed separately.
- CI (`.github/workflows/ci.yml`, single `verify` job): migration + security validators, secret scan, typecheck, lint, frontend (Vitest) test suite, `npm audit --omit=dev --audit-level=high`, production build. E2E is intentionally NOT in CI (needs seeded external backend) — run `npm run test:e2e` against staging before release.
- Lint baseline is dirty: oxlint reports 0 errors and ~270 warnings (mostly `no-explicit-any`). Don't mass-fix; just don't add new violations.

## Architecture (Monorepo Workspaces)

Ujrat is organized as an npm-workspaces monorepo:

- `frontend/`: React 19 + TypeScript + Vite SPA, UI features (including the Indian GST tax engine in `features/invoices/tax/`), presentation components, Vitest tests, Tailwind CSS 4. Talks to Supabase directly (RLS + `SECURITY DEFINER` RPCs); there is no Python server.
- `backend/supabase/`: Supabase migrations, Deno Edge Functions, migration and security validation scripts, k6 tests.
- `packages/shared-types/`: Common database types and shared contracts.

- Feature-driven DDD in `frontend/src/features/<domain>/` holds `components/`, `hooks/`, `repositories/`, `services/`, and a barrel `index.ts`.
- Layering: components → hooks (TanStack Query wrappers) → services (business logic / state machines) → repositories (static classes owning ALL Supabase queries). Repositories must scope every query by `workspace_id` and respect soft deletes (`deleted_at`). Cross-cutting code lives in `frontend/src/shared/` (`ui/`, `lib/supabaseClient`, `utils/StateMachine`, `validation/`).
- Project/invoice/payment lifecycles are enforced via state machines (`frontend/src/shared/utils/StateMachine.ts`) — use them, not ad-hoc status string mutations.
- Unit tests are centralized in `frontend/src/__tests__/` (not colocated), jsdom env, setup at `frontend/src/__tests__/setup.ts`. Vitest excludes `e2e/**`.
- Path aliases `@/app`, `@/shared`, `@/features`, `@/supabase`, `@ujrat/shared-types` are declared in `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`. Keep them in sync when adding aliases.

## Database & Supabase (Backend Workspace)

- Migrations in `backend/supabase/migrations/`: `000_baseline.sql` plus timestamped files named `YYYYMMDDHHMMSS_name.sql` (strict 14-digit prefix). `npm run validate:migrations` asserts naming, required core tables, and the portal RPCs; it fails if an `archive/` directory exists.
- The client portal is zero-auth: clients never log into Supabase. All portal reads go through `get_portal_*` SECURITY DEFINER RPCs gated by expiring tokens. Preserve this boundary.
- Edge functions (`backend/supabase/functions/`) run in Deno with URL/npm imports. Server secrets (`PLUNK_API_KEY`, SMTP creds) are set via `npx supabase secrets set KEY=...` — never prefix server-side secrets with `VITE_`.
- Security invariant validator (`backend/scripts/validate-security.mjs`) verifies RLS, payment guards, and webhook constant-time HMAC verifications.

## Env & deploy

- Dev requires `.env` (copy `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.
- `vercel.json` owns SPA rewrites and a strict CSP/security headers. Any new external origin (API host, CDN, font/image source) must be added to the matching CSP directive there, or it breaks in production only.

## Conventions & gotchas

- Commits follow Conventional Commits (`feat:`, `fix:`).
- tsconfig is stricter than typical: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly` — expect friction indexing arrays or assigning optional props.
- Some docs drift from reality: a few docs quote stale counts (test suites, tarballs, folder lists). Trust `package.json` and the actual configs over prose.
- Deeper references: `docs/ARCHITECTURE.md`, `docs/TESTING_AND_SECURITY.md`, `docs/TAX_AND_PAYMENTS_GUIDE.md`, and ADRs linked from `docs/INDEX.md`.
