import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2"
import { consumeRateLimit } from "../_shared/rate-limit.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIGNED_URL_TTL_SECONDS = 60 * 60
const SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = 30
const SIGNED_URL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60
const SUPPORTED_BUCKETS = new Set(['deliverables', 'invoices'])

type CreateSignedUrlRequest = {
  bucket: string
  filePath: string
  token: string
}

type PortalDeliverable = { file_url: string | null }
type PortalInvoice = { pdf_url: string | null }

function jsonResponse(body: Record<string, string>, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  })
}

function getBearerToken(value: string | null): string | null {
  const bearerPrefix = 'Bearer '
  return value?.startsWith(bearerPrefix) ? value.slice(bearerPrefix.length) : null
}

function isCreateSignedUrlRequest(value: unknown): value is CreateSignedUrlRequest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const request = value as Record<string, unknown>
  return typeof request.token === 'string'
    && typeof request.filePath === 'string'
    && typeof request.bucket === 'string'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: 'Server environment not fully configured' }, 500)
    }

    if (getBearerToken(req.headers.get('Authorization')) !== SUPABASE_ANON_KEY) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let bodyData: unknown
    try {
      bodyData = await req.json()
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400)
    }

    if (!isCreateSignedUrlRequest(bodyData) || !bodyData.token || !bodyData.filePath) {
      return jsonResponse({ error: 'Missing token, filePath, or bucket in request' }, 400)
    }

    const { token, filePath, bucket } = bodyData
    if (!SUPPORTED_BUCKETS.has(bucket)) {
      return jsonResponse({ error: 'Unsupported storage bucket' }, 400)
    }

    // 1. Verify project access by token using get_portal_project RPC
    const { data: projectData, error: projErr } = await supabase.rpc('get_portal_project', { token_val: token })
    if (projErr || !projectData || projectData.length === 0) {
      return jsonResponse({ error: 'Invalid token or project not found' }, 401)
    }

    const rateLimit = await consumeRateLimit(supabase, {
      functionName: 'create-signed-url',
      maxRequests: SIGNED_URL_RATE_LIMIT_MAX_REQUESTS,
      principal: token,
      windowSeconds: SIGNED_URL_RATE_LIMIT_WINDOW_SECONDS,
    })
    if ('error' in rateLimit) {
      console.error('Signed URL rate limit unavailable:', rateLimit.error)
      return jsonResponse({ error: 'Rate limit temporarily unavailable' }, 503)
    }

    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: 'Too many signed URL requests. Please try again later.' },
        429,
        { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      )
    }

    // 2. Depending on bucket type, verify if the file belongs to this project
    let isAuthorized = false

    if (bucket === 'deliverables') {
      // Get deliverables using the token
      const { data: deliverables, error: delivErr } = await supabase.rpc('get_portal_deliverables', { token_val: token })
      if (!delivErr && deliverables) {
        isAuthorized = (deliverables as PortalDeliverable[]).some((deliverable) => deliverable.file_url === filePath)
      }
    } else if (bucket === 'invoices') {
      // Get invoices using the token
      const { data: invoices, error: invErr } = await supabase.rpc('get_portal_invoices', { token_val: token })
      if (!invErr && invoices) {
        isAuthorized = (invoices as PortalInvoice[]).some((invoice) => invoice.pdf_url === filePath)
      }
    }

    if (!isAuthorized) {
      return jsonResponse({ error: 'Access denied: file does not belong to this project portal' }, 403)
    }

    // 3. Generate signed URL using service role client (bypasses RLS for portal downloads)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

    if (signedError || !signedData) {
      console.error('Failed to create signed URL:', signedError)
      return jsonResponse({ error: 'Failed to create signed URL' }, 500)
    }

    return jsonResponse({ signedUrl: signedData.signedUrl }, 200)
  } catch (error: unknown) {
    console.error('Unexpected signed URL failure:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
