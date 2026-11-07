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

describe('create-signed-url paid-check (no cache)', () => {
  it('checks get_portal_invoices live on every deliverables request (no 60s cache)', () => {
    // A cached "paid" verdict outlived revocations — the escrow gate must
    // re-ask the RPC on every request now.
    expect(EDGE_SRC).not.toContain('paidCheckCache');
    expect(EDGE_SRC).not.toContain('PAID_CHECK_CACHE_TTL_MS');
    const escrowBlock = EDGE_SRC.slice(EDGE_SRC.indexOf('Escrow'));
    expect(escrowBlock).toContain("rpc('get_portal_invoices'");
  });

  it('keeps 30 / 15min rate limit and 1h signed-URL TTL', () => {
    expect(EDGE_SRC).toContain('SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = 30');
    expect(EDGE_SRC).toContain('SIGNED_URL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60');
    expect(EDGE_SRC).toContain('SIGNED_URL_TTL_SECONDS = 60 * 60');
  });

  it('sends private Cache-Control on the signed URL response (no public caching of per-token URLs)', () => {
    expect(EDGE_SRC).toContain("'Cache-Control': 'private, max-age=0'");
    expect(EDGE_SRC).not.toContain('public, max-age=3600, immutable');
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
