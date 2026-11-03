import { describe, it, expect, vi } from 'vitest';
import { consumeRateLimit } from '../../../backend/supabase/functions/_shared/rate-limit';

type RpcRow = Record<string, unknown>;

function makeClient(row: RpcRow | null, error: { message: string } | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: row === null ? null : [row], error }),
  };
}

describe('consumeRateLimit', () => {
  it('accepts the RPC shape returned by consume_edge_rate_limit (allowed + window_reset_at)', async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    const client = makeClient({ allowed: true, current_count: 1, window_reset_at: resetAt });

    const result = await consumeRateLimit(client as never, {
      functionName: 'payment-webhook',
      principal: '203.0.113.5',
      maxRequests: 100,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('derives retryAfterSeconds from window_reset_at when the request is rejected', async () => {
    const resetAt = new Date(Date.now() + 45_000).toISOString();
    const client = makeClient({ allowed: false, current_count: 101, window_reset_at: resetAt });

    const result = await consumeRateLimit(client as never, {
      functionName: 'payment-webhook',
      principal: '203.0.113.5',
      maxRequests: 100,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(40);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(45);
  });

  it('still supports a direct retry_after_seconds value', async () => {
    const client = makeClient({ allowed: false, retry_after_seconds: 12 });

    const result = await consumeRateLimit(client as never, {
      functionName: 'send-email',
      principal: 'someone@example.com',
      maxRequests: 5,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(12);
  });

  it('fails closed on an unusable response', async () => {
    const client = makeClient({ allowed: 'yes' });

    const result = await consumeRateLimit(client as never, {
      functionName: 'send-email',
      principal: 'someone@example.com',
      maxRequests: 5,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(false);
    expect('error' in result && result.error).toBeTruthy();
  });
});
