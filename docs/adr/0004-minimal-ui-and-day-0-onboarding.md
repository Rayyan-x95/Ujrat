# ADR 0004: Minimalist UI, Truthful Data Representation, and Day-0 Onboarding

* **Status**: Accepted
* **Date**: 2026-03-01

## Context
Freelancers need a distraction-free tool. Displaying hardcoded demo/mock figures or complex charts on empty accounts creates confusion, visual artifacts (e.g. repeated decimal Y-axis ticks), and loss of trust.

## Decision
1. Eliminate all artificial mock data fallbacks in production views.
2. Provide an interactive 3-step Quick Setup Guide for new accounts (`Day 0`) to eliminate blank-slate paralysis.
3. Use a structured benchmark scale (`₹0` → `₹50k`) for empty charts to prevent mathematical division artifacts.
4. Maintain a sleek 6-section primary navigation (`Dashboard`, `Projects`, `Clients`, `Invoices`, `Payments`, `Settings`).

## Consequences
* High trust and clarity for real users.
* Seamless transition from Day 0 (empty) to Day 100 (active high-volume cashflow).
