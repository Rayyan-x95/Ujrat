import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations/20261108000002_contract_sign_tx.sql'))
  ? path.join(ROOT, 'backend/supabase/migrations/20261108000002_contract_sign_tx.sql')
  : path.resolve(ROOT, '../backend/supabase/migrations/20261108000002_contract_sign_tx.sql');
const SQL = readFileSync(MIGRATION, 'utf8');

describe('sign_contract_transactional migration invariants', () => {
  it('atomically writes signatures + contracts + projects + activity_logs', () => {
    expect(SQL).toContain('sign_contract_transactional');
    expect(SQL).toContain('contract_signatures');
    expect(SQL).toContain("status = 'signed'");
    expect(SQL).toContain("status = 'contract_signed'");
    expect(SQL).toContain('activity_logs');
  });

  it('validates workspace/project/contract scope and idempotency', () => {
    expect(SQL).toContain('SECURITY DEFINER');
    expect(SQL).toContain('auth.uid()');
    expect(SQL).toContain('deleted_at IS NULL');
    expect(SQL).toContain('ON CONFLICT (contract_id) DO NOTHING');
  });

  it('grants authenticated + service_role only', () => {
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.sign_contract_transactional/);
    expect(SQL).toContain('authenticated');
    expect(SQL).toContain('service_role');
  });
});
