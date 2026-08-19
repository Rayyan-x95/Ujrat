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

## 2. Directory Structure

```text
src/
├── app/                      # Application Bootstrap & Shell
│   ├── layouts/              # DashboardLayout, MobileLayout, CommandPalette
│   ├── router/               # React Router configuration & Lazy Chunk Preloader
│   └── styles/               # Global tokens, CSS variables, animations
├── features/                 # Domain Feature Modules
│   ├── auth/                 # Authentication, OTP Zero-Trust, Session Hook
│   ├── clients/              # Client CRM & Directory (Services, Repos, Types)
│   ├── contracts/            # IT Act compliant E-Signatures & Agreements
│   ├── dashboard/            # Metrics aggregation, Cashflow Trend, Onboarding
│   ├── deliverables/         # File escrow, asset uploads, download links
│   ├── invoices/             # GST Invoice Engine, PDF export, state machine
│   ├── landing/              # High-conversion public landing page & SEO
│   ├── payments/             # Dynamic UPI QR codes, settlement journal
│   ├── portal/               # Public zero-auth client review & payment portal
│   ├── projects/             # Project Kanban, milestones, deliverable tracker
│   ├── proposals/            # Client proposals, scope builder, approval flow
│   ├── settings/             # VPA configuration, business profile, preferences
│   └── waitlist/             # Early access priority onboarding engine
└── shared/                   # Cross-cutting primitives
    ├── hooks/                # useTheme, useIsMobile, useCurrency, useKeyboard
    ├── lib/                  # supabaseClient, analytics, logger
    ├── types/                # Core domain types, Result<T>, Error models
    └── ui/                   # Button, Badge, Modal, FormInput, UjratLogo
```

---

## 3. Core Domain State Machines

### 3.1 Project Lifecycle State Machine
```
[ LEAD / DRAFT ]
       │
       ▼ (create_proposal)
[ PROPOSAL_SENT ]
       │
       ▼ (client_approves)
[ APPROVED ]
       │
       ▼ (sign_agreement)
[ CONTRACT_SIGNED ]
       │
       ▼ (record_advance)
[ ADVANCE_PAID ]
       │
       ▼ (start_work)
[ IN_PROGRESS ]
       │
       ▼ (upload_deliverable)
[ DELIVERED ]
       │
       ▼ (generate_invoice)
[ INVOICE_SENT ]
       │
       ▼ (settle_payment)
[ COMPLETED / ARCHIVED ]
```

### 3.2 Invoice Lifecycle State Machine
```
[ DRAFT ] ──(issue)──> [ SENT ] ──(overdue_window)──> [ OVERDUE ]
                           │                               │
                           └───────────(pay_upi)───────────┘
                                           │
                                           ▼
                                        [ PAID ]
                                           │
                                      (reconcile)
                                           │
                                           ▼
                                       [ VOID / SETTLED ]
```

---

## 4. Multi-Tenant Isolation & Security Boundary

1. **Workspace ID Scoping**: Every database entity (`clients`, `projects`, `invoices`, `payments`, `deliverables`) contains a foreign key `workspace_id`.
2. **Row-Level Security (RLS)**:
   ```sql
   CREATE POLICY "Users can only access their workspace data"
   ON clients FOR ALL
   USING (
     workspace_id IN (
       SELECT workspace_id FROM workspace_members WHERE profile_id = auth.uid()
     )
   );
   ```
3. **Public Client Portal Boundary (`SECURITY DEFINER`)**:
   - Clients do not sign into Supabase directly.
   - Public actions (viewing proposals, signing contracts, paying UPI invoices) execute through strictly validated PostgreSQL `SECURITY DEFINER` RPC functions requiring an unguessable 64-character SHA-256 token.
   - Tokens auto-expire upon completion or after 30 days.

---

## 5. Performance & Bundle Optimization

- **Route Lazy-Loading**: All feature views are lazily loaded with `React.lazy()` and preloaded upon mouse hover via `RoutePreloader`.
- **Zero-Layout-Shift Fonts**: Google Fonts (`Inter` and `Outfit`) preconnected with `font-display: swap`.
- **Client-Side Cache**: TanStack React Query with `staleTime: 5 minutes` and optimistic cache updates.
