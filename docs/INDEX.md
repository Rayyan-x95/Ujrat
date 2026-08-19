# 📚 Ujrat Engineering & Product Documentation Index

Welcome to the comprehensive documentation portal for **Ujrat** — India's zero-fee freelance operating system.

---

## 📑 Core Documentation Directory

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[Architecture Documentation](file:///d:/CODE%20PROJECTS/Ujrat/docs/ARCHITECTURE.md)** | Modular monolith, clean DDD layering, state machines, and multi-tenant security boundary. | Software Engineers, Architects |
| **[API & Database Schema](file:///d:/CODE%20PROJECTS/Ujrat/docs/API_AND_DATABASE_SCHEMA.md)** | PostgreSQL relational schema, Row-Level Security (RLS) policies, and RPC procedures. | Backend Developers, DBA |
| **[Indian GST & UPI Payments Guide](file:///d:/CODE%20PROJECTS/Ujrat/docs/TAX_AND_PAYMENTS_GUIDE.md)** | Interstate/Intrastate GST calculation rules, TDS rates, and NPCI UPI deep link specifications. | Financial Engineers, Compliance |
| **[UX & Design System Guidelines](file:///d:/CODE%20PROJECTS/Ujrat/docs/UX_DESIGN_SYSTEM.md)** | Design tokens, HSL palette, typography hierarchy, WCAG 2.1 AA, and Day-0 onboarding. | UI/UX Designers, Frontend Devs |
| **[Testing & Security Infrastructure](file:///d:/CODE%20PROJECTS/Ujrat/docs/TESTING_AND_SECURITY.md)** | Zero-trust authentication, RLS boundary, input sanitization, and 18-suite Vitest test harness. | QA, Security Auditors |
| **[Developer Onboarding Guide](file:///d:/CODE%20PROJECTS/Ujrat/docs/DEVELOPMENT_GUIDE.md)** | Getting started, environment variables, local scripts, and Vercel edge deployment. | New Contributors, DevOps |
| **[Operations Runbook](file:///d:/CODE%20PROJECTS/Ujrat/docs/OPERATIONS_RUNBOOK.md)** | Incident response, monitoring, database backups, and health checks. | DevOps, SRE |

---

## 🏛️ Architecture Decision Records (ADRs)

* **[ADR 0001: Multi-Tenant Workspace Isolation and RLS](file:///d:/CODE%20PROJECTS/Ujrat/docs/adr/0001-multi-tenant-isolation-and-rls.md)**
* **[ADR 0002: Zero-Fee Direct UPI Payment Integration and Native GST Engine](file:///d:/CODE%20PROJECTS/Ujrat/docs/adr/0002-zero-fee-upi-and-gst-tax-engine.md)**
* **[ADR 0003: Modular Feature-Driven Architecture and Layer Isolation](file:///d:/CODE%20PROJECTS/Ujrat/docs/adr/0003-modular-feature-architecture.md)**
* **[ADR 0004: Minimalist UI, Truthful Data Representation, and Day-0 Onboarding](file:///d:/CODE%20PROJECTS/Ujrat/docs/adr/0004-minimal-ui-and-day-0-onboarding.md)**

---

## ⚡ Quick Commands Cheatsheet

```bash
# Start Development Server
npm run dev

# Run Vitest Suite (18 test files, 130 tests)
npm test -- --run

# Full TypeScript Compiler Check
npx tsc --noEmit

# Production Build
npm run build
```
