import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { consumeRateLimit } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const ALLOWED_METHODS = 'POST, OPTIONS';
const EXTRA_HEADERS = 'x-webhook-signature';

async function hmacHex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHmacSignature(rawBody: string, secret: string, signature: string): Promise<boolean> {
  const expected = await hmacHex(rawBody, secret);
  // Constant-time compare (crypto.subtle has no timingSafeEqual in Deno).
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req: Request) => {
  const corsHeaders = {
    ...getCorsHeaders(req, EXTRA_HEADERS),
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: missing service credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // 1. Rate limiting on webhook endpoint (max 100 requests per minute per IP)
    // The edge proxy appends the real client IP last, so the last entry is the
    // one the client cannot spoof by sending its own x-forwarded-for header.
    const clientIp = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
    const rateLimit = await consumeRateLimit(adminClient, {
      functionName: 'payment-webhook',
      principal: clientIp,
      maxRequests: 100,
      windowSeconds: 60,
    })

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) }
      })
    }

    // Direct UPI flow: payments are confirmed manually in-app; this endpoint
    // only reconciles callbacks from a UPI app / PSP.
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: 'Webhook verification is not configured; rejecting request' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature')
    // Verify HMAC-SHA256 hex of the raw body against the shared secret with a
    // constant-time compare — the secret itself must never be the signature.
    if (!signature || !(await verifyHmacSignature(rawBody, webhookSecret, signature))) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Direct UPI: payer app / PSP posts a signed confirmation here.
    // In-app manual "Confirm Payment" is the primary path; this is only the
    // machine-confirm path.
    let invoiceId: string | undefined
    let amountPaise: number | undefined
    let transactionId: string | undefined
    let gateway = 'upi'

    if (payload.invoice_id && payload.amount && payload.transaction_id) {
      invoiceId = payload.invoice_id
      // Normalize to paise integer: supports explicit unit flags or paise integers.
      const isExplicitRupees = payload.amount_unit === 'INR' || payload.amount_unit === 'rupees' || payload.currency_unit === 'INR' || payload.currency_unit === 'rupees' || payload.amount_in_rupees != null;
      const rawAmount = Number(payload.amount_in_rupees ?? payload.amount);
      amountPaise = isExplicitRupees || !Number.isInteger(rawAmount)
        ? Math.round(rawAmount * 100)
        : Math.round(rawAmount);
      transactionId = payload.transaction_id
      gateway = payload.gateway || 'upi'
    }

    if (!invoiceId || !amountPaise || amountPaise <= 0 || !transactionId) {
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Event ignored: Missing required invoice or transaction mapping',
        event: payload.event 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Atomic database reconciliation via SECURITY DEFINER RPC.
    // reconcile_gateway_payment() stores RUPEES — convert paise → rupees here.
    const { data: reconcileResult, error: rpcError } = await adminClient.rpc('reconcile_gateway_payment', {
      p_invoice_id: invoiceId,
      p_amount: amountPaise / 100,
      p_transaction_id: transactionId,
      p_gateway: gateway,
      p_metadata: payload
    })

    if (rpcError) {
      console.error('[payment-webhook] Reconciliation RPC failed:', rpcError)
      // Do not echo raw Postgres SECURITY DEFINER messages to the caller.
      return new Response(JSON.stringify({ error: 'Reconciliation failed; event retained for retry' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: reconcileResult
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[payment-webhook] Unhandled exception:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
