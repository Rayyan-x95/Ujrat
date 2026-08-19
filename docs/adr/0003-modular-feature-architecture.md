# ADR 0003: Modular Feature-Driven Architecture and Layer Isolation

* **Status**: Accepted
* **Date**: 2026-02-20

## Context
As the application expands to cover CRM, Invoices, Contracts, Proposals, and Payments, a flat file structure leads to high coupling and spaghetti code.

## Decision
Organize the codebase into autonomous feature domains (`src/features/<feature>/`) where each domain encapsulates its own:
* `components/`: Pure presentation and view templates
* `services/`: Business logic, calculations, and domain rules
* `repositories/`: Supabase data access layer
* `hooks/`: Reactive state and TanStack Query bridges
* `types/`: Domain-specific TypeScript contracts

## Consequences
* High testability and clear separation of concerns.
* Features can be upgraded or refactored independently with zero cross-contamination.
