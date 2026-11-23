import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { consumeRateLimit } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { invoiceAmountPaise } from '../_shared/stripe.ts'

const ALLOWED_METHODS = 'POST, OPTIONS';
// pending_verification is excluded: a UPI claim is already awaiting review.
const PAYABLE_STATUSES = new Set(['sent', 'viewed', 'partially_paid', 'overdue'])
const STRIPE_MIN_PAISE = 5000 // Stripe INR minimum charge is ₹50.

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Server misconfigured: missing service credentials' }, 500, corsHeaders)
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // The edge proxy appends the real client IP last, so the last entry is the
    // one the client cannot spoof by sending its own x-forwarded-for header.
    const clientIp = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
    const rateLimit = await consumeRateLimit(adminClient, {
      functionName: 'stripe-checkout',
      principal: clientIp,
      maxRequests: 20,
      windowSeconds: 60,
    })
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) }
      })
    }

    // Card payments stay off until the owner configures Stripe test/live keys.
    if (!stripeSecretKey) {
      return json({ error: 'Card payments are not configured' }, 503, corsHeaders)
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Malformed JSON payload' }, 400, corsHeaders)
    }

    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const invoiceId = typeof body?.invoice_id === 'string' ? body.invoice_id.trim() : ''
    if (!token || !invoiceId) {
      return json({ error: 'token and invoice_id are required' }, 400, corsHeaders)
    }

    // The portal token is the client's only credential here; the invoice and
    // the amount are read server-side so a caller cannot choose what to pay.
    const { data: bundle, error: bundleError } = await adminClient.rpc('get_portal_bundle', { token_val: token })
    if (bundleError) {
      console.error('[stripe-checkout] Portal bundle lookup failed:', bundleError.message)
      return json({ error: 'Unable to load invoice' }, 500, corsHeaders)
    }

    const invoice = Array.isArray(bundle?.invoices)
      ? bundle.invoices.find((i: any) => i?.id === invoiceId)
      : undefined
    const workspaceId = bundle?.project?.workspace_id

    if (!invoice || !workspaceId || invoice.status === 'draft') {
      return json({ error: 'Invalid portal token or invoice' }, 401, corsHeaders)
    }
    if (!PAYABLE_STATUSES.has(invoice.status)) {
      return json({ error: 'This invoice cannot be paid by card' }, 409, corsHeaders)
    }
    // The charge is built in INR paise; a native-currency balance on a
    // non-INR invoice would be charged in the wrong currency and value.
    if (String(invoice.currency || 'INR').toUpperCase() !== 'INR') {
      return json({ error: 'Card payments support INR invoices only' }, 409, corsHeaders)
    }

    const amountPaise = invoiceAmountPaise(invoice)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return json({ error: 'This invoice has no outstanding balance' }, 409, corsHeaders)
    }
    if (amountPaise < STRIPE_MIN_PAISE) {
      return json({ error: 'Invoice amount is below the ₹50 card payment minimum' }, 409, corsHeaders)
    }

    const portalBaseUrl = (Deno.env.get('PORTAL_BASE_URL') || 'https://ujrat.ninety5.in').replace(/\/+$/, '')
    const portalUrl = `${portalBaseUrl}/portal/${encodeURIComponent(token)}`

    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('payment_method_types[0]', 'card')
    params.set('client_reference_id', invoiceId)
    params.set('success_url', `${portalUrl}?payment=success`)
    params.set('cancel_url', `${portalUrl}?payment=cancelled`)
    params.set('line_items[0][quantity]', '1')
    params.set('line_items[0][price_data][currency]', 'inr')
    params.set('line_items[0][price_data][unit_amount]', String(amountPaise))
    params.set('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoice_number || invoiceId}`)
    params.set('metadata[invoice_id]', invoiceId)
    params.set('metadata[workspace_id]', workspaceId)

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Repeat clicks inside 5 minutes reuse one Checkout Session.
        'Idempotency-Key': `ujrat_${invoiceId}_${amountPaise}_${Math.floor(Date.now() / 300000)}`,
      },
      body: params,
    })

    const session: any = await stripeResponse.json().catch(() => null)
    if (!stripeResponse.ok || !session?.url) {
      console.error('[stripe-checkout] Stripe session creation failed:', stripeResponse.status, session?.error?.message)
      return json({ error: 'Unable to start card payment' }, 502, corsHeaders)
    }

    return json({ url: session.url }, 200, corsHeaders)
  } catch (error: any) {
    console.error('[stripe-checkout] Unhandled exception:', error)
    return json({ error: 'Internal Server Error' }, 500, corsHeaders)
  }
})
