# 🏛️ System Architecture Documentation

**Ujrat** is a modern, modular freelance operating system architected for scalability, zero-trust security, and high performance. Built with **React 19**, **TypeScript 5/6**, **Tailwind CSS 4**, and **Supabase (PostgreSQL + RLS)**.

---

## 1. Architectural Philosophy

Ujrat follows a **Feature-Driven Modular Architecture** combined with **Clean Domain-Driven Design (DDD)** principles:

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Presentation Layer                   │
│      (React Components, Page Layouts, Feedback Skeletons)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Reactive State & Hooks Layer             │
│          (TanStack React Query, Custom Domain Hooks)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Domain & Business Service Layer          │
│       (Tax Engine, UPI Generator, Validation, Formatters)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Repository / Data Access Layer           │
│         (Supabase CRUD, Scoped Workspace ID Queries)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               PostgreSQL Database & Security Definer         │
│         (Row-Level Security Policies, Transaction RPCs)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure (Monorepo Workspaces)

```text
ujrat/ (repo root)
├── package.json                   # Root orchestrator (npm workspaces: ["frontend", "backend", "packages/*"])
├── vercel.json                    # Vercel deployment & security headers (outputDirectory: frontend/dist)
├── .github/workflows/ci.yml       # Workspace-aware CI verification pipeline
│
├── frontend/                      # @ujrat/frontend (React 19 + TypeScript + Vite SPA)
│   ├── package.json               # UI dependencies & scripts
│   ├── vite.config.ts             # Vite configuration & path aliases
│   ├── vitest.config.ts           # Vitest configuration for unit tests
│   ├── public/                    # Static assets & web manifest
│   ├── index.html                 # Single page application entry point
│   └── src/                       # React 19 source application
│       ├── app/                   # Shell, layouts, router, global styles
│       ├── features/              # Feature-driven DDD modules (auth, clients, invoices, etc.)
│       ├── shared/                # Cross-cutting UI, hooks, and Supabase client
│       ├── __tests__/             # 227 unit & integration tests
│       └── main.tsx               # Entry bootstrap
│
├── backend/                       # @ujrat/backend (Python FastAPI + Supabase backend)
│   ├── app/                       # Authoritative Python operations service (FastAPI)
│   │   ├── api/v1/                # REST endpoints (/tax, /payments, /clients, /invoices, /portal)
│   │   ├── core/                  # Settings (config.py), JWT auth (security.py), Supabase (database.py)
│   │   ├── services/              # Indian GST Tax Engine 2.0, UPI links/UTR, state machines
│   │   └── main.py                # FastAPI ASGI application entry point
│   ├── tests/                     # Backend Python unit & integration tests (unittest)
│   ├── supabase/                  # Authoritative Supabase directory
│   │   ├── migrations/            # 000_baseline.sql and timestamped migrations
│   │   └── functions/             # Deno Edge Functions (send-email, payment-webhook, health, etc.)
│   ├── scripts/                   # Validation scripts (validate-migrations.mjs, validate-security.mjs)
│   ├── pyproject.toml             # Python packaging, ruff, pytest settings
│   ├── requirements.txt           # Python backend dependencies
│   ├── package.json               # Backend npm workspace configuration
│   └── k6/                        # Performance and load testing suite
│
└── packages/
    └── shared-types/              # @ujrat/shared-types
        └── src/                   # Shared TypeScript models (database.types.ts)
```

---

## 3. Core Domain State Machines

### 3.1 Project Lifecycle State Machine (`src/shared/utils/StateMachine.ts`)
```
[ LEAD ]
        │
        ▼
[ PROPOSAL ]
        │
        ▼
[ APPROVED ]
        │
        ▼
[ CONTRACT_SIGNED ] ──(advance | start)──> [ ADVANCE_PAID ] / [ IN_PROGRESS ]
        │                                        │
        ▼                                        ▼
[ IN_PROGRESS ] ──> [ DELIVERED ] ──> [ INVOICE_SENT ] ──> [ PAID ] ──> [ COMPLETED ] ──> [ ARCHIVED ]
        ▲                                                                                      │
        └────────────────── reactivation: ARCHIVED ──> LEAD / PROPOSAL / IN_PROGRESS ────────────┘
```
`archived` is reachable from any state; reactivation to `lead`/`proposal`/`in_progress` is intentional (mirrors the DB trigger).

### 3.2 Invoice Lifecycle State Machine
```
[ DRAFT ] ──> [ SENT ] ──> [ VIEWED ] ──> [ PENDING_VERIFICATION ] ──> [ PAID ]
                  │              │                    │
                  └────> [ OVERDUE ] <────────────────┘
[ DRAFT ] / [ SENT ] / [ VIEWED ] / [ PENDING_VERIFICATION ] / [ OVERDUE ] ──> [ CANCELLED ]
```
`paid` and `cancelled` are terminal. (Matches the DB CHECK + `InvoiceStatusEnum`.)

---

## 4. Multi-Tenant Isolation & Security Boundary

1. **Workspace ID Scoping**: Every database entity (`clients`, `projects`, `invoices`, `payments`, `deliverables`) contains a foreign key `workspace_id`.
2. **Row-Level Security (RLS)** (single-owner workspaces — there is no
   `workspace_members` table):
   ```sql
   CREATE POLICY "All workspaces" ON public.workspaces FOR ALL
   USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
   -- tenant tables scope via their workspace_id, e.g. clients:
   -- USING (workspace_id IN (SELECT id FROM public.workspaces
   --                        WHERE profile_id = auth.uid()));
   ```
3. **Public Client Portal Boundary (`SECURITY DEFINER`)**:
   - Clients do not sign into Supabase directly.
   - Public actions (viewing proposals, signing contracts, paying UPI invoices) execute through strictly validated PostgreSQL `SECURITY DEFINER` RPC functions requiring an unguessable 64-character SHA-256 token.
   - Tokens auto-expire upon completion, on `portal_token_expires_at`, and via a 90-day absolute cap (`portal_token_is_live()`).

---

## 5. Performance & Bundle Optimization

- **Route Lazy-Loading**: All feature views are lazily loaded with `React.lazy()` and gated by `Suspense` (`src/app/router/App.tsx`).
- **Zero-Layout-Shift Fonts**: Google Fonts (`Inter` and `Outfit`) preconnected with `font-display` swap via print-media `onload` (`index.html`). Font origins must be allow-listed in both `style-src`/`font-src` **and** `connect-src` in `vercel.json`, or the service worker font fetch is CSP-blocked in production.
- **Client-Side Cache**: TanStack React Query with `staleTime: 60s`, `gcTime: 5 min`, `retry: 1`, `refetchOnWindowFocus: false` (`src/app/router/App.tsx`).
