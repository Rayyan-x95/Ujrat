# 🗄️ API & Database Schema Documentation

This document describes the complete PostgreSQL relational schema, Row-Level Security (RLS) policies, integrity constraints, and RPC stored procedures powering **Ujrat**.

---

## 1. Relational Schema Entity-Relationship

```text
  ┌──────────────┐          ┌──────────────────────┐
  │   profiles   │ 1──────* │  workspace_members   │
  └──────┬───────┘          └──────────┬───────────┘
         │ 1                           │ *
         │                             ▼
         │                      ┌──────────────┐
         └────────────────────* │  workspaces  │
                                └──────┬───────┘
                                       │ 1
     ┌───────────────────┬─────────────┼───────────────────┬───────────────────┐
     ▼                   ▼             ▼                   ▼                   ▼
┌─────────┐         ┌─────────┐ 0..1 *┌─────────┐         ┌─────────┐         ┌───────────────┐
│ clients │ 1─────* │projects │- - - -│invoices │ 1─────* │payments │         │ activity_logs │
└─────────┘         └────┬────┘       └────┬────┘         └─────────┘         └───────────────┘
                         │ 1               │ 1
        ┌────────────────┼─────────────┐   └───────────────────┐
        ▼                ▼             ▼                       ▼
  ┌───────────┐    ┌───────────┐ ┌──────────────┐    ┌──────────────────┐
  │ proposals │    │ contracts │ │ deliverables │    │ payment_attempts │
  └───────────┘    └───────────┘ └──────────────┘    └──────────────────┘
                         │ 1
                         ▼
               ┌────────────────────┐
               │ project_activities │
               └────────────────────┘
```

---

## 2. Table Specifications & Data Integrity

### 2.1 `profiles`

Represents the authenticated freelancer or agency owner.

* `id` (`uuid`, PK) - Foreign key to `auth.users.id` (`ON DELETE CASCADE`). Deleting an `auth.users` identity cascades to remove its profile, while deleting a profile does not cascade back to delete the underlying `auth.users` row.
* `full_name` (`text`, NOT NULL) - Freelancer display name
* `email` (`text`, NOT NULL) - Primary contact and auth email
* `upi_vpa` (`text`) - Primary UPI ID (e.g. `freelancer@okhdfcbank`)
* `gstin` (`text`) - 15-character GST identification number (validated via regex checksum)
* `business_name` (`text`) - Registered trade name or company name
* `created_at` / `updated_at` (`timestamptz`, DEFAULT `now()`)

### 2.2 `workspaces` & `workspace_members`

Enables multi-tenancy and multi-member team collaboration.

* `workspaces.id` (`uuid`, PK)
* `workspaces.name` (`text`, NOT NULL) - e.g. "Studio Nexus"
* `workspaces.slug` (`text`, UNIQUE)
* `workspace_members.id` (`uuid`, PK)
* `workspace_members.workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `workspace_members.user_id` (`uuid`, FK -> `profiles.id` ON DELETE CASCADE, NOT NULL)
* `workspace_members.role` (`text`, NOT NULL) - `'owner'`, `'admin'`, `'member'`, `'viewer'`
* **Constraint**: `UNIQUE (workspace_id, user_id)` ensures each user has at most one membership record per workspace.

### 2.3 `clients`

CRM directory of contacts and billing entities.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE RESTRICT, NOT NULL) - Soft-deletion pattern protects historical billing records.
* `name` (`text`, NOT NULL) - Client contact person or brand name
* `email` (`text`, NOT NULL)
* `phone` (`text`)
* `company` (`text`)
* `gstin` (`text`) - Client's GSTIN for tax invoice generation
* `state_code` (`text`) - 2-digit Indian State Code (e.g. `'27'` for Maharashtra, `'29'` for Karnataka)
* `address` (`text`)
* `deleted_at` (`timestamptz`) - Soft delete support

### 2.4 `projects`

Core pipeline execution unit.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `client_id` (`uuid`, FK -> `clients.id` ON DELETE RESTRICT, NOT NULL) - Preserves client association while projects exist.
* `title` (`text`, NOT NULL)
* `status` (`text`, NOT NULL) - Valid statuses:
  * `lead`: Initial prospect inquiry or scope intake
  * `proposal`: Scoping and proposal sent for client review
  * `approved`: Scope agreed upon by client
  * `contract_signed`: E-sign agreement executed with audit trail
  * `advance_paid`: Initial mobilization retainer settled
  * `in_progress`: Active execution and sprint delivery
  * `delivered`: Artifacts and milestones staged for review
  * `invoice_sent`: Final statutory GST tax invoice generated
  * `paid`: Payment received and verified via direct UPI
  * `completed`: Project formally closed and archived
  * `archived`: Read-only historical retention
* `total_value` (`numeric(12, 2)`, DEFAULT 0, `CHECK (total_value >= 0)`) - Stored with exact 2-decimal INR paise precision
* `advance_amount` (`numeric(12, 2)`, DEFAULT 0, `CHECK (advance_amount >= 0)`)
* `deadline` (`date`)
* `portal_token` (`text`, UNIQUE) - Cryptographic unguessable token for client portal access
* `deleted_at` (`timestamptz`)
* **Multi-Tenant Scoping & Workspace-Matching Constraints**: All child entities (`proposals`, `contracts`, `deliverables`, `project_activities`) and associated relations (e.g. `client_id`) enforce strict workspace-matching constraints via composite foreign keys `(id, workspace_id)`, database validation triggers, or RPC validation, guaranteeing that related clients and child records must share the parent `projects.workspace_id`.

### 2.5 `proposals`

Scoping documents and quote estimates.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `project_id` (`uuid`, FK -> `projects.id` ON DELETE CASCADE, NOT NULL)
* `content` (`text`, NOT NULL)
* `budget` (`numeric(12, 2)`, NOT NULL, `CHECK (budget >= 0)`)
* `estimated_timeline` (`text`)
* `status` (`text`, NOT NULL) - `'draft'`, `'sent'`, `'accepted'`, `'rejected'`

### 2.6 `contracts`

Legal agreements with electronic signature audit records.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `project_id` (`uuid`, FK -> `projects.id` ON DELETE CASCADE, NOT NULL)
* `content` (`text`, NOT NULL)
* `status` (`text`, NOT NULL) - `'draft'`, `'sent'`, `'signed'`
* `signed_by_client` (`text`)
* `signed_at` (`timestamptz`)
* `client_ip` (`text`)

### 2.7 `deliverables`

Files and escrow assets attached to project milestones.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `project_id` (`uuid`, FK -> `projects.id` ON DELETE CASCADE, NOT NULL)
* `title` (`text`, NOT NULL)
* `file_url` (`text`)
* `status` (`text`, NOT NULL) - `'pending'`, `'uploaded'`, `'approved'`

### 2.8 `invoices`

GST-compliant billing records.

* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `client_id` (`uuid`, FK -> `clients.id` ON DELETE RESTRICT, NOT NULL)
* `project_id` (`uuid`, FK -> `projects.id` ON DELETE SET NULL)
* `invoice_number` (`text`, NOT NULL) - e.g. `INV-2026-001`
* `status` (`text`, NOT NULL) - `'draft'`, `'sent'`, `'paid'`, `'overdue'`, `'void'`
* `issue_date` (`date`, NOT NULL)
* `due_date` (`date`, NOT NULL)
* `subtotal` (`numeric(12, 2)`, NOT NULL, `CHECK (subtotal >= 0)`)
* `tax_type` (`text`, NOT NULL) - `'cgst_sgst'`, `'igst'`, `'none'`
* `cgst_rate` / `cgst_amount` (`numeric(5, 2)` `CHECK (cgst_rate BETWEEN 0 AND 100)` / `numeric(12, 2)`)
* `sgst_rate` / `sgst_amount` (`numeric(5, 2)` `CHECK (sgst_rate BETWEEN 0 AND 100)` / `numeric(12, 2)`)
* `igst_rate` / `igst_amount` (`numeric(5, 2)` `CHECK (igst_rate BETWEEN 0 AND 100)` / `numeric(12, 2)`)
* `tds_rate` / `tds_amount` (`numeric(5, 2)` `CHECK (tds_rate BETWEEN 0 AND 100)` / `numeric(12, 2)`)
* `total` (`numeric(12, 2)`, NOT NULL, `CHECK (total >= 0)`)
* `notes` (`text`)
* `deleted_at` (`timestamptz`) - Soft delete support

### 2.9 `payments` & `payment_attempts`

UPI settlement ledger and verification attempts.

* `payments.id` (`uuid`, PK)
* `payments.workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `payments.invoice_id` (`uuid`, FK -> `invoices.id` ON DELETE RESTRICT, NOT NULL) - Preserves ledger entries when invoices are soft-deleted.
* `payments.amount` (`numeric(12, 2)`, NOT NULL, `CHECK (amount >= 0)`)
* `payments.utr_number` (`text`, UNIQUE, NOT NULL) - Database-enforced unique constraint preventing duplicate settlement claims.
* `payments.verified` (`boolean`, DEFAULT false)
* `payment_attempts.id` (`uuid`, PK)
* `payment_attempts.workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `payment_attempts.invoice_id` (`uuid`, FK -> `invoices.id` ON DELETE RESTRICT, NOT NULL)
* `payment_attempts.ip_address` (`text`)
* `payment_attempts.created_at` (`timestamptz`, DEFAULT `now()`)

### 2.10 `project_activities` & `activity_logs`

Chronological workspace and milestone activity audit trails.

* `project_activities.id` (`uuid`, PK)
* `project_activities.workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `project_activities.project_id` (`uuid`, FK -> `projects.id` ON DELETE CASCADE, NOT NULL)
* `project_activities.activity_type` (`text`, NOT NULL)
* `project_activities.description` (`text`, NOT NULL)
* `project_activities.created_at` (`timestamptz`, DEFAULT `now()`, INDEXED)
* `activity_logs.id` (`uuid`, PK)
* `activity_logs.workspace_id` (`uuid`, FK -> `workspaces.id` ON DELETE CASCADE, NOT NULL)
* `activity_logs.actor_id` (`uuid`, FK -> `profiles.id` ON DELETE SET NULL)
* `activity_logs.event_type` (`text`, NOT NULL)
* `activity_logs.created_at` (`timestamptz`, DEFAULT `now()`, INDEXED) - Indexed for high-performance chronological timeline pagination and activity feeds.

---

## 3. PostgreSQL Stored Procedures & RPCs

### 3.1 `get_dashboard_data(p_workspace_id, p_profile_id)`

Aggregates active projects, outstanding balances, monthly revenue history, pipeline status counts, and the 5 latest activity logs in a single atomic database query.

### 3.2 `get_portal_project(p_portal_token)` (`SECURITY DEFINER`)

Safely exposes sanitized project, proposal, agreement, invoice, and deliverable status to clients without requiring authentication.

### 3.3 `sign_portal_contract(p_portal_token, p_client_name, p_ip_address)` (`SECURITY DEFINER`)

Appends legal cryptographic audit timestamp, IP address, and client name to the contract and advances the project state to `'contract_signed'`.
