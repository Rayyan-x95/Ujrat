import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { consumeRateLimit } from '../_shared/rate-limit.ts'

const SIGNATURE_TOLERANCE_SECONDS = 300
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
])

async function hmacHex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]
// The signed payload is "<t>.<raw body>", HMAC-SHA256 with the endpoint secret.
async function verifyStripeSignature(rawBody: string, secret: string, header: string): Promise<boolean> {
  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === 't') timestamp = value
    else if (key === 'v1') signatures.push(value.toLowerCase())
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || signatures.length === 0) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = await hmacHex(`${timestamp}.${rawBody}`, secret)
  return signatures.some((signature) => timingSafeEqualHex(expected, signature))
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Server misconfigured: missing service credentials' }, 500)
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const clientIp = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
    const rateLimit = await consumeRateLimit(adminClient, {
      functionName: 'stripe-webhook',
      principal: clientIp,
      maxRequests: 100,
      windowSeconds: 60,
    })
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) }
      })
    }

    if (!webhookSecret) {
      return json({ error: 'Webhook verification is not configured; rejecting request' }, 503)
    }

    // Verify the signature over the raw body before parsing any JSON.
    const rawBody = await req.text()
    const signatureHeader = req.headers.get('stripe-signature')
    if (!signatureHeader || !(await verifyStripeSignature(rawBody, webhookSecret, signatureHeader))) {
      return json({ error: 'Invalid webhook signature' }, 400)
    }

    let event: any
    try {
      event = JSON.parse(rawBody)
    } catch {
      return json({ error: 'Malformed JSON payload' }, 400)
    }

    if (!HANDLED_EVENTS.has(event?.type)) {
      return json({ received: true, message: 'Event ignored' }, 200)
    }

    const session = event?.data?.object
    if (!session?.id || session.payment_status !== 'paid') {
      return json({ received: true, message: 'Session is not paid' }, 200)
    }
    if (String(session.currency || '').toLowerCase() !== 'inr') {
      console.error('[stripe-webhook] Non-INR session ignored:', session.id, session.currency)
      return json({ received: true, message: 'Unsupported currency' }, 200)
    }

    const invoiceId = session.metadata?.invoice_id
    const amountPaise = Number(session.amount_total)
    const transactionId = String(session.payment_intent || session.id || '')
    if (typeof invoiceId !== 'string' || !invoiceId) {
      console.error('[stripe-webhook] Session missing invoice metadata:', session.id)
      return json({ received: true, message: 'Session has no invoice mapping' }, 200)
    }
    if (!Number.isFinite(amountPaise) || amountPaise <= 0 || !transactionId) {
      console.error('[stripe-webhook] Session missing amount or transaction id:', session.id)
      return json({ received: true, message: 'Session has no payable amount' }, 200)
    }

    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('status, outstanding_balance, total')
      .eq('id', invoiceId)
      .maybeSingle()

    if (invoiceError) {
      console.error('[stripe-webhook] Invoice lookup failed:', invoiceError.message)
      return json({ error: 'Invoice lookup failed; event retained for retry' }, 500)
    }
    if (!invoice) {
      console.error('[stripe-webhook] Invoice not found for paid session:', invoiceId, session.id)
      return json({ received: true, message: 'Invoice not found' }, 200)
    }

    // Business conflicts return 200 so Stripe stops retrying; they need a
    // manual refund in the Stripe dashboard (money was captured).
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      console.error('[stripe-webhook] Paid session for non-payable invoice:', invoiceId, invoice.status, session.id)
      return json({ received: true, message: 'Invoice is not payable' }, 200)
    }
    const outstanding = Number(invoice.outstanding_balance ?? invoice.total)
    if (Number.isFinite(outstanding) && amountPaise / 100 > outstanding) {
      console.error('[stripe-webhook] Overpayment for invoice:', invoiceId, amountPaise / 100, '>', outstanding)
      return json({ received: true, message: 'Payment exceeds outstanding balance' }, 200)
    }

    // reconcile_gateway_payment() stores RUPEES — convert paise → rupees here.
    const { data: reconcileResult, error: rpcError } = await adminClient.rpc('reconcile_gateway_payment', {
      p_invoice_id: invoiceId,
      p_amount: amountPaise / 100,
      p_transaction_id: transactionId,
      p_gateway: 'stripe',
      p_metadata: {
        event_id: event.id,
        event_type: event.type,
        session_id: session.id,
        payment_intent: session.payment_intent ?? null,
      },
    })

    if (rpcError) {
      // A concurrent settlement of the same invoice is not retryable.
      if (rpcError.message?.includes('already fully settled')) {
        return json({ received: true, message: 'Invoice already settled' }, 200)
      }
      console.error('[stripe-webhook] Reconciliation RPC failed:', rpcError.message)
      // Do not echo raw Postgres SECURITY DEFINER messages to the caller.
      return json({ error: 'Reconciliation failed; event retained for retry' }, 500)
    }

    return json({ success: true, data: reconcileResult }, 200)
  } catch (error: any) {
    console.error('[stripe-webhook] Unhandled exception:', error)
    return json({ error: 'Internal Server Error' }, 500)
  }
})
