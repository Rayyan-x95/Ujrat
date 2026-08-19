# 🗄️ API & Database Schema Documentation

This document describes the complete PostgreSQL relational schema, Row-Level Security (RLS) policies, and RPC stored procedures powering **Ujrat**.

---

## 1. Relational Schema Entity-Relationship

```
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
┌─────────┐         ┌─────────┐   ┌─────────┐         ┌─────────┐         ┌───────────────┐
│ clients │ 1─────* │projects │ 1*│invoices │ 1─────* │payments │         │ activity_logs │
└─────────┘         └────┬────┘   └─────────┘         └─────────┘         └───────────────┘
                         │ 1
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌───────────┐    ┌───────────┐    ┌──────────────┐
  │ proposals │    │ contracts │    │ deliverables │
  └───────────┘    └───────────┘    └──────────────┘
```

---

## 2. Table Specifications

### 2.1 `profiles`
Represents the authenticated freelancer or agency owner.
* `id` (`uuid`, PK) - Foreign key to `auth.users.id`
* `full_name` (`text`, NOT NULL) - Freelancer display name
* `email` (`text`, NOT NULL) - Primary contact and auth email
* `upi_vpa` (`text`) - Primary UPI ID (e.g. `freelancer@okhdfcbank`)
* `gstin` (`text`) - 15-character GST identification number
* `business_name` (`text`) - Registered trade name or company name
* `created_at` / `updated_at` (`timestamptz`)

### 2.2 `workspaces` & `workspace_members`
Enables multi-tenancy and multi-member team collaboration.
* `workspaces.id` (`uuid`, PK)
* `workspaces.name` (`text`, NOT NULL) - e.g. "Studio Nexus"
* `workspaces.slug` (`text`, UNIQUE)
* `workspace_members.role` (`text`) - `'owner'`, `'admin'`, `'member'`, `'viewer'`

### 2.3 `clients`
CRM directory of contacts and billing entities.
* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id`, NOT NULL)
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
* `workspace_id` (`uuid`, FK -> `workspaces.id`, NOT NULL)
* `client_id` (`uuid`, FK -> `clients.id`, NOT NULL)
* `title` (`text`, NOT NULL)
* `status` (`text`, NOT NULL) - `'lead'`, `'proposal'`, `'approved'`, `'contract_signed'`, `'advance_paid'`, `'in_progress'`, `'delivered'`, `'invoice_sent'`, `'completed'`, `'archived'`
* `total_value` (`numeric`, DEFAULT 0)
* `advance_amount` (`numeric`, DEFAULT 0)
* `deadline` (`date`)
* `portal_token` (`text`, UNIQUE) - Unguessable token for client portal access
* `deleted_at` (`timestamptz`)

### 2.5 `invoices`
GST-compliant billing records.
* `id` (`uuid`, PK)
* `workspace_id` (`uuid`, FK -> `workspaces.id`, NOT NULL)
* `client_id` (`uuid`, FK -> `clients.id`, NOT NULL)
* `project_id` (`uuid`, FK -> `projects.id`)
* `invoice_number` (`text`, NOT NULL) - e.g. `INV-2026-001`
* `status` (`text`, NOT NULL) - `'draft'`, `'sent'`, `'paid'`, `'overdue'`, `'void'`
* `issue_date` (`date`, NOT NULL)
* `due_date` (`date`, NOT NULL)
* `subtotal` (`numeric`, NOT NULL)
* `tax_type` (`text`, NOT NULL) - `'cgst_sgst'`, `'igst'`, `'none'`
* `cgst_rate` / `cgst_amount` (`numeric`)
* `sgst_rate` / `sgst_amount` (`numeric`)
* `igst_rate` / `igst_amount` (`numeric`)
* `tds_rate` / `tds_amount` (`numeric`)
* `total` (`numeric`, NOT NULL)
* `notes` (`text`)
* `deleted_at` (`timestamptz`)

---

## 3. PostgreSQL Stored Procedures & RPCs

### 3.1 `get_dashboard_data(p_workspace_id, p_profile_id)`
Aggregates active projects, outstanding balances, monthly revenue history, pipeline status counts, and the 5 latest activity logs in a single atomic database query.

### 3.2 `get_portal_project(p_portal_token)` (`SECURITY DEFINER`)
Safely exposes sanitized project, proposal, agreement, invoice, and deliverable status to clients without requiring authentication.

### 3.3 `sign_portal_contract(p_portal_token, p_client_name, p_ip_address)` (`SECURITY DEFINER`)
Appends legal cryptographic audit timestamp, IP address, and client name to the contract and advances the project state to `'contract_signed'`.
