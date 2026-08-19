# ADR 0001: Multi-Tenant Workspace Isolation and Row-Level Security

* **Status**: Accepted
* **Date**: 2026-02-15

## Context
Ujrat hosts freelancers and boutique agencies who manage sensitive client contracts, GST invoices, and financial records. Cross-tenant data leakage is a critical threat.

## Decision
1. Every relational table contains a `workspace_id` foreign key.
2. PostgreSQL Row-Level Security (RLS) is enforced at the database level using `auth.uid()` and `workspace_members`.
3. Client portal endpoints bypass user login by employing cryptographic `SECURITY DEFINER` stored procedures requiring 64-char SHA-256 tokens.

## Consequences
* High security assurance against horizontal privilege escalation.
* All queries must include `workspace_id` scoping in repository layers.
