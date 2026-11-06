# Deploy Edge Functions (Runbook)

Live edge configs that drift from repo state. Run from repo root with the
Supabase CLI (project linked via `npx supabase link`). Or run
`bash scripts/deploy-edge.sh` for steps 1–4.

## 0. Secret check

```bash
npx supabase secrets list
# expect to see: PAYMENT_WEBHOOK_SECRET
# if missing:
npx supabase secrets set PAYMENT_WEBHOOK_SECRET=<value>
```

Without it, `payment-webhook` returns 503. Set it **before** deploying step 1.

## 1. Deploy `payment-webhook` (no JWT verification)

```bash
npx supabase functions deploy payment-webhook --no-verify-jwt
```

`--no-verify-jwt` is required: UPI/PSP callbacks carry no Supabase JWT. The
function verifies the `x-webhook-signature` shared secret itself, so the
gateway can reach it without an `Authorization` header.

## 2. Deploy `create-signed-url`

```bash
npx supabase functions deploy create-signed-url --no-verify-jwt
```

`--no-verify-jwt` is required: the portal token is validated in the request
body, so the function is reachable without an `Authorization` header.

## 3. Delete stale `send-email` (deleted from repo, still ACTIVE live)

```bash
npx supabase functions delete send-email
# harmless if already gone:
npx supabase functions delete send-email || true
```

## 4. Delete stale `health` (deleted from repo, still ACTIVE live)

```bash
npx supabase functions delete health || true
```

## 5. Push the 3 new migrations

```bash
npx supabase db push
```

Applies (in order):

- `20261108000000_dashboard_aging_overdue.sql`
- `20261108000001_portal_bundle.sql`
- `20261108000002_contract_sign_tx.sql`

## 6. Apply the `portal_verifications` drop

```bash
npx supabase db push
# applies 20261107000000_drop_portal_verifications_dead.sql
# (drops the dead portal_verifications table)
npx supabase migration list
# verify 20261107000000 shows as applied
```

## Verify

```bash
npx supabase functions list
# expect: payment-webhook, create-signed-url (+ only intentional extras)
# expect: NO send-email, NO health
```

## Script

`scripts/deploy-edge.sh` runs steps 1–4 (set -e, deletes are `|| true`).
One-time: `chmod +x scripts/deploy-edge.sh` (on Windows: `git update-index
--chmod=+x scripts/deploy-edge.sh`). Run migrations (steps 5–6) separately
via `npx supabase db push`.

## Live edge log check (2026-11-06, last 24h)

Queried via Supabase `query_logs` on project `ipibagojxiwunazkfkdx`
(window `2026-11-05T00:00:00Z` → `2026-11-06T00:00:00Z`). No function code changed.

- `function_edge_logs`: **no such source** on this project — count **0**.
  Unified logs expose `edge_logs` instead; all figures below are `edge_logs`.
- `edge_logs` total: **128** — **110 OK** (2xx), **18 errors** (4xx+) → **85.9% success rate**.
- Top paths: `/rest/v1/projects` 17/17 OK, `/rest/v1/workspaces` 17/17 OK,
  `/auth/v1/signup` 15 total / 4 OK (11× `429 over_email_send_rate_limit`),
  `/rest/v1/clients` 12/12 OK.
- No traffic on `*functions*` paths in the window.
- Follow-up: signup rate-limit is the only error cluster; no edge-function
  remediation needed. Re-run the same query before each deploy to confirm.

Repro query:

```sql
select count() as total,
  sum(if(toInt32OrZero(log_attributes['response.status_code']) >= 200
    and toInt32OrZero(log_attributes['response.status_code']) < 300, 1, 0)) as ok,
  sum(if(toInt32OrZero(log_attributes['response.status_code']) >= 400, 1, 0)) as err
from logs where source = 'edge_logs'
```

### Addendum (second pass, same day — default last-24h window)

The section above used window `2026-11-05T00:00:00Z → 2026-11-06T00:00:00Z`,
which predates all of today's function traffic (06:23–12:40Z). Re-querying
with the default last-24h window (`source = 'function_edge_logs'`):

- Total **9** — **6 OK** (2xx), **3 errors** (4xx+) → **66.7% success rate**.
- By path/status: `/functions/v1/send-email` 6× `200`; `/functions/v1/create-signed-url` 2× `403` + 1× `401` (`UNAUTHORIZED_NO_AUTH_HEADER`).
- No `payment-webhook` traffic in the window.
- Uniform 4xx cluster is `create-signed-url` called without/invalid auth, not a function failure.

Version negotiation (from `log_attributes` on the same 9 rows):

- `version` field: `3` on 3 rows, `4` on 6 rows — GoTrue/edge runtime versions coexist per-request, neither pinned.
- `request.headers.x_client_info`: `supabase-js/2.108.2; runtime=web` on 2 rows (the only SDK-identified calls), blank on 7 (browser preflights / CLI).
- `request.headers.sb_api_key_compatibility`: `minted` on 4 rows, blank on 5 — publishable-key minting in use, no `legacy` markers.
- All rows served from `response.headers.x_sb_edge_region = ap-south-1` (Mumbai/BOM), `execution_time_ms` 84–1587, `deno_origin = https://edge-runtime.supabase.com`.

Repro queries:

```sql
-- count + success rate
select count() as total,
  countIf(toInt32OrZero(log_attributes['response.status_code']) < 400) as ok,
  countIf(toInt32OrZero(log_attributes['response.status_code']) >= 400) as err
from logs where source = 'function_edge_logs';

-- by path + status
select log_attributes['request.pathname'] as path,
  log_attributes['response.status_code'] as code, count() as n
from logs where source = 'function_edge_logs' group by path, code order by n desc;

-- version negotiation
select log_attributes['version'] as ver,
  log_attributes['request.headers.x_client_info'] as client_info,
  log_attributes['request.headers.sb_api_key_compatibility'] as compat,
  count() as n
from logs where source = 'function_edge_logs'
group by ver, client_info, compat order by n desc;
```

## Live push log (2026-11-06, MCP + CLI)

DB (project `ipibagojxiwunazkfkdx`, via MCP `apply_migration` — CLI `db push` still
`DbConnectError`s, so Management API only):

- `dashboard_aging_overdue` cron + `get_dashboard_data` aging RPC — applied.
- `portal_bundle` (`get_portal_bundle`) — applied.
- `contract_sign_tx` (`sign_contract_transactional`) — applied.
- `retention_cron_rescope` — `ujrat-log-retention` no longer deletes from the (now-dropped) `portal_verifications` table. `portal_verifications` table + OTP RPCs dropped; `ujrat-mark-overdue` cron scheduled.
- Verified: crons `ujrat-mark-overdue` + `ujrat-log-retention` exist; all 3 RPCs present; `get_dashboard_data` contains `v_aging`.

Edge (via `npx supabase functions deploy/delete --use-api --remote=ipibagojxiwunazkfkdx`):

- `create-signed-url` v6 + `payment-webhook` v7 deployed with `--no-verify-jwt` (both do their own auth: portal token / `x-webhook-signature`). Smoke: `create-signed-url` bogus token → `401 {"error":"Invalid token or project not found"}` (function-level, not platform JWT).
- `send-email` + `health` deleted. Only the 2 functions remain, both `verify_jwt: false`.
- `PAYMENT_WEBHOOK_SECRET` secret set (generated value stored in Supabase dashboard → Secrets; webhook smoke → `200 {"received":true,...}`).

Drift note: remote migration history versions differ from local file names (MCP `apply_migration` stamped its own versions: `dashboard_aging_overdue@20261106171639`, `drop_portal_verifications_dead@20261106172141`, plus the 5 above). A future CLI `db push` needs `migration repair` reconciliation once DB connectivity is fixed. Local files under `backend/supabase/migrations/20261107*/20261108*` hold the canonical SQL.
