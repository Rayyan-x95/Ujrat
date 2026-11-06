#!/bin/bash
set -e
# Deploy Ujrat edge functions from repo root. See docs/DEPLOY_EDGE.md.
# One-time: chmod +x scripts/deploy-edge.sh

npx supabase secrets list | grep -q PAYMENT_WEBHOOK_SECRET \
  || { echo "PAYMENT_WEBHOOK_SECRET missing; set it first" >&2; exit 1; }

# payment-webhook: no Supabase JWT (verified in-function via x-webhook-signature)
npx supabase functions deploy payment-webhook --no-verify-jwt

# create-signed-url: no Supabase JWT (portal token validated in the request body)
npx supabase functions deploy create-signed-url --no-verify-jwt

# Stale live functions, deleted from repo — remove live copies (idempotent)
npx supabase functions delete send-email || true
npx supabase functions delete health || true

echo "Done. Verify with: npx supabase functions list"
