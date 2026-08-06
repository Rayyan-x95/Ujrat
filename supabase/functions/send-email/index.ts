import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2"
import nodemailer from "npm:nodemailer@6.9.16"
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
    const SMTP_HOST = Deno.env.get("SMTP_HOST") || Deno.env.get("SMTP_HOSTNAME")
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587", 10)
    const SMTP_USER = Deno.env.get("SMTP_USER") || Deno.env.get("SMTP_USERNAME")
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || Deno.env.get("SMTP_PASSWORD")
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || Deno.env.get("MAIL_FROM") || 'Ujrat <noreply@ujrat.ninety5.in>'
    const SMTP_SECURE = Deno.env.get("SMTP_SECURE") === 'true' || SMTP_PORT === 465

    const PLUNK_API_KEY = Deno.env.get("PLUNK_API_KEY")
    const PLUNK_HOST = Deno.env.get("PLUNK_HOST") || "next-api.useplunk.com"

    const POSTAL_HOST = Deno.env.get("POSTAL_HOST")
    const POSTAL_API_KEY = Deno.env.get("POSTAL_API_KEY")

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

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
            // Prevent arbitrary spam: verify recipient is a client in user's workspace or user themselves
            const { data: userWorkspaces } = await supabase
              .from('workspaces')
              .select('id')
              .eq('profile_id', user.id)
              .is('deleted_at', null)

            const workspaceIds = (userWorkspaces || []).map((w: any) => w.id)

            if (workspaceIds.length > 0) {
              const isUserSelf = user.email && user.email.toLowerCase() === recipient?.toLowerCase()
              const { data: clientMatch } = await supabase
                .from('clients')
                .select('id')
                .in('workspace_id', workspaceIds)
                .eq('email', recipient)
                .is('deleted_at', null)
                .limit(1)

              if (isUserSelf || (clientMatch && clientMatch.length > 0)) {
                isAuthorized = true
                rateLimitPrincipal = user.id
              }
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized email dispatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!recipient || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (recipient, subject, body)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Edge Rate Limiting: Limit dispatches per principal (user or portal token)
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

    // Database Rate Limiting: Prevent more than 5 emails to the same recipient in 15 minutes
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

    let messageId: string | null = null

    // ─── 1. Dispatch via Open-Source Plunk Email Platform ─────────────────
    if (PLUNK_API_KEY) {
      const plunkEndpoint = PLUNK_HOST.startsWith('http') 
        ? `${PLUNK_HOST}/v1/send` 
        : `https://${PLUNK_HOST}/v1/send`

      const plunkRes = await fetch(plunkEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PLUNK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: recipient,
          subject,
          body,
          from: SMTP_FROM,
          name: 'Ujrat',
        })
      })

      const plunkJson = await plunkRes.json()
      if (!plunkRes.ok || plunkJson.success === false) {
        throw new Error(`Plunk API error: ${plunkJson.error || plunkJson.message || plunkRes.status}`)
      }
      messageId = plunkJson.id || `plunk-${Date.now()}`
    }
    // ─── 2. Dispatch via Open-Source SMTP Transport ───────────────────────
    else if (SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: (SMTP_USER && SMTP_PASS) ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        } : undefined,
        tls: {
          rejectUnauthorized: Deno.env.get("SMTP_IGNORE_TLS") !== 'true',
        }
      })

      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: recipient,
        subject,
        html: body,
      })

      messageId = info.messageId || `smtp-${Date.now()}`
    } 
    // ─── 3. Dispatch via Self-Hosted Open-Source Postal REST API ───────────
    else if (POSTAL_HOST && POSTAL_API_KEY) {
      const postalRes = await fetch(`https://${POSTAL_HOST}/api/v1/send/message`, {
        method: 'POST',
        headers: {
          'X-Server-API-Key': POSTAL_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [recipient],
          from: SMTP_FROM,
          subject,
          html_body: body,
        })
      })

      const postalJson = await postalRes.json()
      if (!postalRes.ok || postalJson.status !== 'success') {
        throw new Error(`Postal API error: ${postalJson.error || postalRes.status}`)
      }
      messageId = postalJson.data?.message_id || `postal-${Date.now()}`
    } 
    // ─── 4. Development / Local Mock Mode ────────────────────────────────
    else {
      console.warn("No PLUNK_API_KEY, SMTP_HOST, or POSTAL_HOST configured. Simulating email delivery in development mode.")
      messageId = `mock-${Date.now()}`
    }

    // Update email log to sent
    if (logId) {
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          resend_id: messageId,
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', logId)
    }

    return new Response(
      JSON.stringify({ success: true, messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
