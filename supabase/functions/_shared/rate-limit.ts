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
  retry_after_seconds: number
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
  return typeof row.allowed === 'boolean'
    && typeof row.retry_after_seconds === 'number'
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
    return { allowed: false, error: error.message, retryAfterSeconds: 0 }
  }

  if (!Array.isArray(data) || data.length !== 1 || !isRateLimitRow(data[0])) {
    return { allowed: false, error: 'Invalid rate limit response', retryAfterSeconds: 0 }
  }

  return {
    allowed: data[0].allowed,
    retryAfterSeconds: data[0].retry_after_seconds,
  }
}
