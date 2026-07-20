import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2"
import { consumeRateLimit } from "../_shared/rate-limit.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RATE_LIMIT_MAX_REQUESTS = 5
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Resend API key not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const bodyData = await req.json()
    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false

    let recipient = bodyData.recipient
    let subject = bodyData.subject
    let body = bodyData.body
    let logId = bodyData.logId
    let rateLimitPrincipal: string | null = null

    // If portalToken is provided (OTP generation flow)
    if (bodyData.portalToken) {
        // Require Authorization header with anon key for portal token flow
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: "Authorization header required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const token = authHeader.replace('Bearer ', '')
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")
        if (token !== SUPABASE_ANON_KEY) {
          return new Response(
            JSON.stringify({ error: "Invalid authorization" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // 1. Fetch project ID and expiration using portalToken
        const { data: project, error: projErr } = await supabase
          .from('projects')
          .select('id, portal_token_expires_at')
          .eq('portal_token', bodyData.portalToken)
          .is('deleted_at', null)
          .single()

        if (projErr || !project) {
          return new Response(
            JSON.stringify({ error: "Invalid portal token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Verify expiration
        if (project.portal_token_expires_at && new Date(project.portal_token_expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: "Expired portal token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // 2. Retrieve latest pending email log for this project
        const { data: emailLog, error: logErr } = await supabase
          .from('email_logs')
          .select('*')
          .eq('project_id', project.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (logErr || !emailLog) {
          return new Response(
            JSON.stringify({ error: "No pending verification email found for this project" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Load parameters strictly from DB log (parameter injection prevention)
        recipient = emailLog.recipient
        subject = emailLog.subject
        body = emailLog.body
        logId = emailLog.id
        rateLimitPrincipal = bodyData.portalToken
        isAuthorized = true
      } else {
        // Direct email: require auth header
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '')
          if (token === SUPABASE_SERVICE_ROLE_KEY) {
            isAuthorized = true
            rateLimitPrincipal = token
          } else {
            // Verify user JWT
            const userClient = createClient(SUPABASE_URL!, token)
            const { data: { user }, error: authErr } = await userClient.auth.getUser()
            if (!authErr && user) {
              isAuthorized = true
              rateLimitPrincipal = user.id
            }
          }
        }
      }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!recipient || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing recipient, subject, or body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const rateLimit = await consumeRateLimit(supabase, {
      functionName: 'send-email',
      maxRequests: EMAIL_RATE_LIMIT_MAX_REQUESTS,
      principal: rateLimitPrincipal ?? recipient,
      windowSeconds: EMAIL_RATE_LIMIT_WINDOW_SECONDS,
    })
    if ('error' in rateLimit) {
      console.error('Email rate limit unavailable:', rateLimit.error)
      return new Response(
        JSON.stringify({ error: 'Rate limit temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many email requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      )
    }

    // 3. Rate limiting check: max 5 emails per recipient per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient', recipient)
      .gte('created_at', fifteenMinAgo)

    if (!countErr && count !== null && count >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many email requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Call Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Ujrat <noreply@ujrat.app>',
        to: [recipient],
        subject,
        html: body
      })
    })

    const resText = await res.text()
    if (!res.ok) {
      // Update log to failed
      if (logId) {
        await supabase
          .from('email_logs')
          .update({ status: 'failed', error_message: `Resend API error: ${res.status}` })
          .eq('id', logId)
      }

      return new Response(
        JSON.stringify({ error: `Resend API error: ${res.status} - ${resText}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const resJson = JSON.parse(resText)

    // Update email log to sent
    if (logId) {
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          resend_id: resJson.id,
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', logId)
    }

    return new Response(
      resText,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
