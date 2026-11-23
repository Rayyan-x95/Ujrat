# Ujrat Operations Runbook

## Overview
This runbook covers operational routines, emergency incident responses, security audits, and key rotation procedures for the Ujrat platform.

---

## 1. Secrets & Key Rotation Procedures

### Supabase Anon Key & Service Role Key Rotation
1. Navigate to **Supabase Dashboard** > **Project Settings** > **API**.
2. Under **Project API keys**, click **Generate new key / Rotate Key**.
3. Update environment variables across deployments:
   - **Vercel / Frontend**: `VITE_SUPABASE_ANON_KEY`
   - **Supabase Edge Functions**: `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy frontend and Edge functions:
   ```bash
   npx supabase functions deploy payment-webhook --no-verify-jwt
   npx supabase functions deploy create-signed-url --no-verify-jwt
   ```

### Email Transports — NOT WIRED UP

> **Current state:** the app writes an `email_logs` row for every message it
> wants to send, but **no `send-email` edge function exists** (it was removed
> from the deployment — see `docs/DEPLOY_EDGE.md`). Nothing dispatches those
> rows, so every row stays `status = 'pending'` forever. Treat `pending` as
> "not sent", not "in flight".
>
> No transport secrets are configured. If email delivery is ever needed,
> deploy a `send-email` edge function that reads `email_logs` and pick a
> transport (SMTP/Plunk/Postal) at that time — do not pre-provision keys for
> a function that does not exist.

### Auth Password Policy (owner action)

The client enforces a 12-character minimum (`AuthService.signUp` /
`updatePassword`). Supabase's server-side default is **6**, so a direct API
signup can bypass the client rule until the project config matches:

1. Supabase Dashboard → **Authentication → Providers → Email**.
2. Set **Minimum password length** to `12`.
3. Verify: a direct `signUp` API call with an 8-character password must fail.

---

## 2. Row Level Security (RLS) & Access Audits

### Regular RLS Integrity Verification
To verify that all public client access goes strictly through `SECURITY DEFINER` RPC functions and that no direct table access is inadvertently exposed to anonymous callers:

1. Query policies on sensitive tables:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('projects', 'contracts', 'invoices', 'payments', 'deliverables', 'payment_attempts');
   ```
2. Verify that every table with user data has `ROW LEVEL SECURITY` enabled:
   ```sql
   SELECT relname, relrowsecurity 
   FROM pg_class 
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
   ```
3. Ensure no direct `portal_token` based `SELECT` or `UPDATE` policies exist on raw tables. Client access must strictly query `get_portal_project_overview`, `submit_portal_payment`, etc.

---

## 3. Database Backups & Point-In-Time Restore (PITR)

### Automated Daily Backups
- Supabase automatically takes scheduled physical backups.
- For manual schema dumps before running database migrations:
  ```bash
  npx supabase db dump -f supabase/backups/backup_$(date +%Y%m%d_%H%M%S).sql
  ```

### Restore Procedure
1. If data corruption or bad migration occurs, locate the target restore timestamp or dump file.
2. For logical restores:
   ```bash
   psql -h <db-host> -U postgres -d postgres -f supabase/backups/backup_target.sql
   ```
3. For managed PITR restores, initiate Point-in-Time Recovery directly from the Supabase Project Dashboard.

---

## 4. Email Pipeline & SMTP Troubleshooting

### Monitoring Email Logs
All OTP codes and system transaction emails generate logs in `email_logs`:
```sql
SELECT id, recipient, subject, status, created_at 
FROM email_logs 
ORDER BY created_at DESC 
LIMIT 50;
```

### Common Failures & Remediation
1. **Status stuck in `pending`:**
   - Expected today: there is no `send-email` edge function, so nothing ever
     dispatches the queued row. Deploy the function (see section 1) to fix it.
   - Once deployed, check Supabase Edge Function logs (`supabase functions logs send-email`)
     and whether `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` are configured correctly
     and the mail server is reachable.
2. **Client did not receive verification OTP:**
   - Verify client email in `clients` table.
   - Client can trigger OTP resend button on portal (subject to 60-second cooldown).

---

---

## 5. Automated Payment Gateway Webhook & Reconciliation

### Supported Gateways
- **Direct UPI / generic PSP**: HMAC-SHA256 signature in `x-webhook-signature` on `payment-webhook`
  (no Razorpay — UPI deep links only, per decision)

### Webhook Configuration
1. In the gateway dashboard (e.g., Razorpay Dashboard > Settings > Webhooks), create a new webhook endpoint:
   - **URL**: `https://<project-ref>.supabase.co/functions/v1/payment-webhook`
   - **Secret**: A strong random string
   - **Events**: `payment.captured`, `order.paid`
2. Set the secret in Supabase Secrets:
   ```bash
   npx supabase secrets set PAYMENT_WEBHOOK_SECRET=your_webhook_secret_here
   ```
3. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy payment-webhook
   ```
4. Verify reconciliation by querying `financial_audit_trail`:
   ```sql
   SELECT * FROM financial_audit_trail WHERE action = 'gateway_reconcile' ORDER BY created_at DESC LIMIT 20;
   ```

---

## 6. Progressive Web App (PWA) Maintenance & Cache Invalidation

### Service Worker Versioning
When shipping critical frontend visual or architectural updates:
1. Increment `CACHE_NAME` in `public/sw.js` (e.g. `ujrat-v2`).
2. The service worker will automatically clear older caches during the `activate` lifecycle hook and claim clients.
3. Offline fallback page is located at `public/offline.html`.

---

## 7. Deployment Verification Checklist

Before promoting any release to production:
- [ ] Run automated tests: `npm test`
- [ ] Verify production bundle builds cleanly: `npm run build`
- [ ] Verify RLS migrations applied to target Supabase instance (`npm run validate:migrations`).
- [ ] Ensure Supabase edge functions deployed and secrets configured:
  - `payment-webhook` (`PAYMENT_WEBHOOK_SECRET`)
  - `create-signed-url` (portal token in request body; no secret)
- [ ] Verify CORS headers and domain whitelist in Supabase Edge Functions.

