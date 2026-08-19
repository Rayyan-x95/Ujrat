# ADR 0002: Zero-Fee Direct UPI Payment Integration and Native GST Engine

* **Status**: Accepted
* **Date**: 2026-02-18

## Context
Traditional payment gateways (e.g. Razorpay, Stripe, Instamojo) charge 2% - 3% + 18% GST per transaction, reducing freelance profit margins. Furthermore, freelancers frequently face GST compliance confusion regarding Interstate (IGST) vs Intrastate (CGST+SGST) tax rates.

## Decision
1. Implement direct NPCI UPI deep links and dynamic SVG QR codes, depositing funds straight into the freelancer's bank account with 0% platform or gateway fees.
2. Build a pure mathematical GST/TDS tax engine supporting Interstate vs Intrastate tax determination based on 2-digit Indian State Codes.

## Consequences
* Freelancers retain 100% of their earnings.
* Instant settlement without T+2 bank holding delays.
