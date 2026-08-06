import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { consumeRateLimit } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function verifyHmacSha256(secret: string, payload: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const expectedHex = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return expectedHex.toLowerCase() === signature.toLowerCase()
  } catch (err) {
    console.error('[payment-webhook] Signature verification exception:', err)
    return false
  }
}

serve(async (req: Request) => {
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
    const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || ''

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
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
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

    // 2. Read raw payload text for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('x-webhook-signature')

    // If webhook secret is configured, enforce strict signature verification
    if (webhookSecret) {
      if (!signature || !(await verifyHmacSha256(webhookSecret, rawBody, signature))) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
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

    // 3. Extract standard webhook fields (supporting Razorpay and generic schemas)
    let invoiceId: string | undefined
    let amount: number | undefined
    let transactionId: string | undefined
    let gateway = 'webhook'

    if (payload.event === 'payment.captured' && payload.payload?.payment?.entity) {
      // Razorpay schema
      const entity = payload.payload.payment.entity
      transactionId = entity.id
      amount = entity.amount ? entity.amount / 100 : undefined // paise to INR
      invoiceId = entity.notes?.invoice_id || entity.description?.match(/INV-[A-Za-z0-9-]+/)?.[0]
      gateway = 'razorpay'
    } else if (payload.invoice_id && payload.amount && payload.transaction_id) {
      // Generic gateway webhook schema
      invoiceId = payload.invoice_id
      amount = Number(payload.amount)
      transactionId = payload.transaction_id
      gateway = payload.gateway || 'gateway_webhook'
    }

    if (!invoiceId || !amount || !transactionId) {
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Event ignored: Missing required invoice or transaction mapping',
        event: payload.event 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Atomic database reconciliation via SECURITY DEFINER RPC
    const { data: reconcileResult, error: rpcError } = await adminClient.rpc('reconcile_gateway_payment', {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_transaction_id: transactionId,
      p_gateway: gateway,
      p_metadata: payload
    })

    if (rpcError) {
      console.error('[payment-webhook] Reconciliation RPC failed:', rpcError)
      return new Response(JSON.stringify({ error: rpcError.message }), {
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
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
