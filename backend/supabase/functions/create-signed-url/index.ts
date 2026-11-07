import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2"
import { consumeRateLimit } from "../_shared/rate-limit.ts"
import { getCorsHeaders } from "../_shared/cors.ts"

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
type PortalInvoice = { pdf_url: string | null; status?: string }

function jsonResponse(body: Record<string, string>, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
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
  const corsHeaders = getCorsHeaders(req);
  const json = (body: Record<string, string>, status: number, extra: HeadersInit = {}) =>
    jsonResponse(body, status, { ...corsHeaders, ...extra });
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return json({ error: 'Server environment not fully configured' }, 500)
    }

    // NOTE: the Supabase anon key is public (shipped in the SPA as VITE_).
    // Checking the bearer against it proves nothing; the portal token in the
    // body is the credential, verified below via get_portal_project.

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let bodyData: unknown
    try {
      bodyData = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }

    if (!isCreateSignedUrlRequest(bodyData) || !bodyData.token || !bodyData.filePath) {
      return json({ error: 'Missing token, filePath, or bucket in request' }, 400)
    }

    const { token, filePath, bucket } = bodyData
    if (!SUPPORTED_BUCKETS.has(bucket)) {
      return json({ error: 'Unsupported storage bucket' }, 400)
    }

    // 1. Verify project access by token using get_portal_project RPC
    const { data: projectData, error: projErr } = await supabase.rpc('get_portal_project', { token_val: token })
    if (projErr || !projectData || projectData.length === 0) {
      return json({ error: 'Invalid token or project not found' }, 401)
    }

    const rateLimit = await consumeRateLimit(supabase, {
      functionName: 'create-signed-url',
      maxRequests: SIGNED_URL_RATE_LIMIT_MAX_REQUESTS,
      principal: token,
      windowSeconds: SIGNED_URL_RATE_LIMIT_WINDOW_SECONDS,
    })
    if ('error' in rateLimit) {
      console.error('Signed URL rate limit unavailable:', rateLimit.error)
      return json({ error: 'Rate limit temporarily unavailable' }, 503)
    }

    if (!rateLimit.allowed) {
      return json(
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
      // Get invoices using the token. The invoice PDF is downloadable only
      // once the invoice is issued (drafts are already excluded by
      // get_portal_invoices) and only while it is a live, payable document:
      // cancelled invoices are not downloadable. Clients need the PDF before
      // paying (it is the payment demand), so pre-payment access is by design
      // — but cancelled/draft invoices must not be exposed.
      const { data: invoices, error: invErr } = await supabase.rpc('get_portal_invoices', { token_val: token })
      if (!invErr && invoices) {
        const PAYABLE_OR_PAID = new Set(['sent', 'viewed', 'pending_verification', 'partially_paid', 'overdue', 'paid']);
        isAuthorized = (invoices as PortalInvoice[]).some(
          (invoice) => invoice.pdf_url === filePath && invoice.status !== undefined && PAYABLE_OR_PAID.has(invoice.status),
        )
      }
    }

    // Defense in depth: the authorized file must be a plain storage path
    // (no leading slash, not empty) and, for project-scoped buckets, live
    // inside this project's folder prefix. Uploads are stored by
    // StorageService as `<workspaceId>/<projectId>/<uuid>-<file>`; invoice
    // PDFs are keyed by invoice, and the token->project RPC above already
    // restricts which invoice rows (and their pdf_url values) this caller can
    // name, so an exact pdf_url match is sufficient there.
    if (isAuthorized) {
      const safePath = filePath.replace(/^\/+/, '')
      const isPlainPath = safePath !== '' && safePath === filePath
      if (!isPlainPath) {
        isAuthorized = false
      } else if (bucket === 'deliverables') {
        const project = (projectData as Array<{ id?: string; workspace_id?: string }>)?.[0]
        const requiredPrefix = project?.workspace_id && project?.id
          ? `${project.workspace_id}/${project.id}/`
          : null
        if (!requiredPrefix || !safePath.startsWith(requiredPrefix)) {
          isAuthorized = false
        }
      }
    }

    if (!isAuthorized) {
      return json({ error: 'Access denied: file does not belong to this project portal' }, 403)
    }

    // Escrow: deliverables stay locked until every issued invoice is settled.
    // Draft invoices are excluded by get_portal_invoices, so an unpublished
    // draft cannot lock a delivered project. Checked live on every request
    // (a cached "paid" verdict let URLs outlive a revocation).
    if (bucket === 'deliverables') {
      const { data: invoices, error: invoiceErr } = await supabase.rpc('get_portal_invoices', { token_val: token })
      if (invoiceErr) {
        return json({ error: 'Unable to verify payment status' }, 503)
      }
      const hasUnpaidInvoice = ((invoices as PortalInvoice[]) || []).some(
        (invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled',
      )
      if (hasUnpaidInvoice) {
        return json({ error: 'Downloads unlock once all invoices are paid' }, 403)
      }
    }

    // 3. Generate signed URL using service role client (bypasses RLS for portal downloads)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

    if (signedError || !signedData) {
      console.error('Failed to create signed URL:', signedError)
      return json({ error: 'Failed to create signed URL' }, 500)
    }

    return json({ signedUrl: signedData.signedUrl }, 200, { 'Cache-Control': 'private, max-age=0' })
  } catch (error: unknown) {
    console.error('Unexpected signed URL failure:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
