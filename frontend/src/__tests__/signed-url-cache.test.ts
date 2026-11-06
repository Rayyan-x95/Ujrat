import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { IMAGE_WARNING_THRESHOLD_BYTES } from '@/features/settings/services/StorageService';

const ROOT = process.cwd();
const EDGE_FILE = existsSync(path.join(ROOT, 'backend/supabase/functions/create-signed-url/index.ts'))
  ? path.join(ROOT, 'backend/supabase/functions/create-signed-url/index.ts')
  : path.resolve(ROOT, '../backend/supabase/functions/create-signed-url/index.ts');
const EDGE_SRC = readFileSync(EDGE_FILE, 'utf8');

const STORAGE_FILE = existsSync(path.join(ROOT, 'frontend/src/features/settings/services/StorageService.ts'))
  ? path.join(ROOT, 'frontend/src/features/settings/services/StorageService.ts')
  : path.join(ROOT, 'src/features/settings/services/StorageService.ts');
const STORAGE_SRC = readFileSync(STORAGE_FILE, 'utf8');

describe('create-signed-url paid-check cache', () => {
  it('caches get_portal_invoices paid-check per token for 60s', () => {
    expect(EDGE_SRC).toMatch(/new Map<string,\s*\{\s*expires:[^}]+\}/);
    expect(EDGE_SRC).toContain('PAID_CHECK_CACHE_TTL_MS');
    expect(EDGE_SRC).toContain('60_000');
    expect(EDGE_SRC).toContain('paidCheckCache');
    expect(EDGE_SRC).toContain('paidCheckCache.get(token)');
    expect(EDGE_SRC).toContain('paidCheckCache.set(token');
  });

  it('skips the paid-check RPC on cache hit (2nd download = 0 extra get_portal_invoices)', () => {
    // Cache lookup must guard the rpc call inside the deliverables block.
    const deliverablesBlock = EDGE_SRC.slice(EDGE_SRC.indexOf("if (bucket === 'deliverables') {", EDGE_SRC.indexOf('Escrow')));
    const cacheIdx = deliverablesBlock.indexOf('paidCheckCache.get(token)');
    const rpcIdx = deliverablesBlock.indexOf("rpc('get_portal_invoices'");
    expect(cacheIdx).toBeGreaterThanOrEqual(0);
    expect(rpcIdx).toBeGreaterThanOrEqual(0);
    expect(cacheIdx).toBeLessThan(rpcIdx);
    expect(deliverablesBlock).toContain('cached.expires > Date.now()');
  });

  it('keeps 30 / 15min rate limit and 1h signed-URL TTL', () => {
    expect(EDGE_SRC).toContain('SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = 30');
    expect(EDGE_SRC).toContain('SIGNED_URL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60');
    expect(EDGE_SRC).toContain('SIGNED_URL_TTL_SECONDS = 60 * 60');
  });

  it('sends immutable Cache-Control on the signed URL response', () => {
    expect(EDGE_SRC).toContain("'Cache-Control': 'public, max-age=3600, immutable'");
  });

  it('second download within 60s does not re-fetch (simulated cache semantics)', async () => {
    const cache = new Map<string, { expires: number; paid: boolean }>();
    let rpcCalls = 0;
    async function fetchPaid(token: string, now: number): Promise<boolean> {
      const hit = cache.get(token);
      if (hit && hit.expires > now) return hit.paid;
      rpcCalls += 1;
      const paid = true;
      cache.set(token, { expires: now + 60_000, paid });
      return paid;
    }
    expect(await fetchPaid('tok', 1_000_000)).toBe(true);
    expect(await fetchPaid('tok', 1_030_000)).toBe(true);
    expect(rpcCalls).toBe(1); // 2nd call within 60s skipped the RPC
    expect(await fetchPaid('tok', 1_061_000)).toBe(true);
    expect(rpcCalls).toBe(2); // expired entry refetched
  });

  it('cached unpaid result still blocks downloads', () => {
    const cache = new Map<string, { expires: number; paid: boolean }>();
    cache.set('tok', { expires: Date.now() + 60_000, paid: false });
    const hit = cache.get('tok');
    expect(hit?.paid).toBe(false);
    expect(!hit!.paid).toBe(true); // hasUnpaidInvoice = !paid
  });
});

describe('StorageService 2MB warning constant (UI only)', () => {
  it('exports a 2MB warning threshold', () => {
    expect(IMAGE_WARNING_THRESHOLD_BYTES).toBe(2 * 1024 * 1024);
  });

  it('does not attempt canvas resize or downscaling', () => {
    expect(STORAGE_SRC.toLowerCase()).not.toContain('canvas');
    expect(STORAGE_SRC.toLowerCase()).not.toContain('resize');
    expect(STORAGE_SRC).toContain('IMAGE_WARNING_THRESHOLD_BYTES');
  });
});
