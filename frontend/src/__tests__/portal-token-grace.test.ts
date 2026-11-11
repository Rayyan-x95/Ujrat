import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_NAME = '20261111162926_portal_token_prev_grace.sql';
const ROOT = process.cwd();
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations', MIGRATION_NAME))
  ? path.join(ROOT, 'backend/supabase/migrations', MIGRATION_NAME)
  : path.resolve(ROOT, '../backend/supabase/migrations', MIGRATION_NAME);
const SQL = readFileSync(MIGRATION, 'utf8');

describe('portal token grace window migration', () => {
  it('stores the previous hash with its own expiry', () => {
    expect(SQL).toContain('portal_token_prev_hash TEXT');
    expect(SQL).toContain('portal_token_prev_expires_at TIMESTAMPTZ');
  });

  it('retires the current hash on rotation for 30 days', () => {
    expect(SQL).toMatch(/NEW\.portal_token_prev_hash := OLD\.portal_token_hash/);
    expect(SQL).toMatch(/NEW\.portal_token_prev_expires_at := now\(\) \+ interval '30 days'/);
  });

  it('rewrites both aliased and bare portal lookups, skipping patched functions', () => {
    expect(SQL).toContain('WHERE p.portal_token_hash = encode(sha256(token_val::bytea)');
    expect(SQL).toContain('WHERE portal_token_hash = encode(sha256(token_val::bytea)');
    expect(SQL).toContain('portal_token_prev_expires_at > now()');
    expect(SQL).toContain("p.prosrc NOT LIKE '%portal_token_prev_hash%'");
  });
});
