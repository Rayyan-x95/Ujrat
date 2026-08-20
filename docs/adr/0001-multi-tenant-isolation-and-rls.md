# ADR 0001: Multi-Tenant Workspace Isolation and Row-Level Security

* **Status**: Accepted
* **Date**: 2026-02-15

## Context
Ujrat hosts freelancers and boutique agencies who manage sensitive client contracts, GST invoices, and financial records. Cross-tenant data leakage is a critical threat.

## Decision
1. Every relational table contains a `workspace_id` foreign key.
2. PostgreSQL Row-Level Security (RLS) is enforced at the database level using `auth.uid()` and `workspace_members`.
3. Client portal access is strictly mediated via database `SECURITY DEFINER` RPC stored procedures (e.g. `get_portal_project`, `sign_portal_contract`) with token verification, rather than direct client-side table selects or broad anonymous RLS policies.

## Consequences
* High security assurance against horizontal privilege escalation.
* All application queries must include `workspace_id` scoping in repository layers.
* Public clients only access scoped, sanitized data returned directly by dedicated RPC procedures.
