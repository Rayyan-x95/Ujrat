type RateLimitRpcResponse = {
  data: unknown
  error: { message: string } | null
}

type RateLimitClient = {
  rpc: (
    functionName: string,
    arguments_: Record<string, number | string>,
  ) => Promise<RateLimitRpcResponse>
}

type RateLimitRow = {
  allowed: boolean
  retry_after_seconds?: number
  window_reset_at?: string
}

export type RateLimitConfig = {
  functionName: string
  maxRequests: number
  principal: string
  windowSeconds: number
}

export type RateLimitResult =
  | { allowed: true; retryAfterSeconds: number }
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: false; error: string; retryAfterSeconds: number }

function isRateLimitRow(value: unknown): value is RateLimitRow {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const row = value as Record<string, unknown>
  if (typeof row.allowed !== 'boolean') {
    return false
  }

  return typeof row.retry_after_seconds === 'number'
    || typeof row.window_reset_at === 'string'
}

// The RPC returns window_reset_at (end of the current window); retry_after_seconds
// is only present on newer deployments. Accept both so the helper works either way.
// Malformed responses default to a sane 60s backoff — returning 0 would make
// clients retry instantly and defeat the limiter.
function computeRetryAfterSeconds(row: RateLimitRow): number {
  if (typeof row.retry_after_seconds === 'number') {
    return row.retry_after_seconds
  }

  const resetAt = Date.parse(row.window_reset_at ?? '')
  if (Number.isNaN(resetAt)) {
    return 60
  }

  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

async function hashPrincipal(principal: string): Promise<string> {
  const value = new TextEncoder().encode(principal)
  const digest = await crypto.subtle.digest('SHA-256', value)

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function consumeRateLimit(
  client: RateLimitClient,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const scope = `${config.functionName}:${await hashPrincipal(config.principal)}`
  const { data, error } = await client.rpc('consume_edge_rate_limit', {
    p_scope: scope,
    p_max_requests: config.maxRequests,
    p_window_seconds: config.windowSeconds,
  })

  if (error) {
    return { allowed: false, error: error.message, retryAfterSeconds: 60 }
  }

  if (!Array.isArray(data) || data.length !== 1 || !isRateLimitRow(data[0])) {
    return { allowed: false, error: 'Invalid rate limit response', retryAfterSeconds: 60 }
  }

  const row = data[0]
  if (row.allowed) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return { allowed: false, retryAfterSeconds: computeRetryAfterSeconds(row) }
}
