import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ContractService } from '@/features/contracts/services/ContractService';
import { ContractRepository } from '@/features/contracts/repositories/ContractRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { supabase } from '@/shared/lib/supabaseClient';

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })) })),
      delete: vi.fn(),
    })),
  },
}));

const ROOT = process.cwd();
const MIGRATION = existsSync(path.join(ROOT, 'backend/supabase/migrations/20261108000002_contract_sign_tx.sql'))
  ? path.join(ROOT, 'backend/supabase/migrations/20261108000002_contract_sign_tx.sql')
  : path.resolve(ROOT, '../backend/supabase/migrations/20261108000002_contract_sign_tx.sql');
const SQL = readFileSync(MIGRATION, 'utf8');

const SERVICE_FILE = existsSync(path.join(ROOT, 'frontend/src/features/contracts/services/ContractService.ts'))
  ? path.join(ROOT, 'frontend/src/features/contracts/services/ContractService.ts')
  : path.join(ROOT, 'src/features/contracts/services/ContractService.ts');
const SERVICE_SRC = readFileSync(SERVICE_FILE, 'utf8');

describe('ContractService.signContract transactional RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockReset();
    vi.spyOn(ProjectRepository, 'getById').mockResolvedValue({ id: 'proj-1' } as any);
    vi.spyOn(ContractRepository, 'getByProjectId').mockResolvedValue({
      id: 'contract-1',
      project_id: 'proj-1',
      status: 'sent',
      contract_signatures: null,
    } as any);
  });

  it('calls sign_contract_transactional with workspace/project/signature/ip', async () => {
    const fakeSig = { id: 'sig-1', contract_id: 'contract-1', signature_name: 'Jane Doe' } as any;
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [fakeSig], error: null } as any);

    const res = await ContractService.signContract('ws-1', 'prof-1', 'proj-1', 'contract-1', {
      signature_name: 'Jane Doe',
      ip_address: '1.2.3.4',
    });

    expect(res.success).toBe(true);
    if (res.success) expect(res.data.id).toBe('sig-1');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'sign_contract_transactional',
      expect.objectContaining({
        p_workspace_id: 'ws-1',
        p_project_id: 'proj-1',
        p_signature_name: 'Jane Doe',
        p_signature_image: null,
        p_signature_type: 'typed',
        p_ip: '1.2.3.4',
      }),
    );
  });

  it('does not run JS compensating writes (no addSignature / update / delete rollback)', async () => {
    const fakeSig = { id: 'sig-1' } as any;
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [fakeSig], error: null } as any);
    const addSpy = vi.spyOn(ContractRepository, 'addSignature');
    const updateSpy = vi.spyOn(ContractRepository, 'update');
    const projectUpdateSpy = vi.spyOn(ProjectRepository, 'update');

    const res = await ContractService.signContract('ws-1', 'prof-1', 'proj-1', 'contract-1', {
      signature_name: 'Jane Doe',
    });

    expect(res.success).toBe(true);
    expect(addSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(projectUpdateSpy).not.toHaveBeenCalled();
    // No compensating delete is ever issued from signContract.
    const fromMock = vi.mocked(supabase.from);
    expect(JSON.stringify(fromMock.mock.calls)).not.toContain('contract_signatures');
  });

  it('propagates RPC failure with no partial-write fallback', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Contract is not available for signing' },
    } as any);
    const addSpy = vi.spyOn(ContractRepository, 'addSignature');

    const res = await ContractService.signContract('ws-1', 'prof-1', 'proj-1', 'contract-1', {
      signature_name: 'Jane Doe',
    });

    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.message).toContain('not available for signing');
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('returns existing signature idempotently without RPC when already signed', async () => {
    const existing = { id: 'sig-9', signature_name: 'Jane Doe' } as any;
    vi.spyOn(ContractRepository, 'getByProjectId').mockResolvedValue({
      id: 'contract-1',
      project_id: 'proj-1',
      status: 'signed',
      contract_signatures: existing,
    } as any);

    const res = await ContractService.signContract('ws-1', 'prof-1', 'proj-1', 'contract-1', {
      signature_name: 'Jane Doe',
    });

    expect(res.success).toBe(true);
    if (res.success) expect(res.data.id).toBe('sig-9');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('ContractService source has no rollback branch', () => {
  it('calls the transactional RPC', () => {
    expect(SERVICE_SRC).toContain('sign_contract_transactional');
    expect(SERVICE_SRC).toContain('p_workspace_id');
    expect(SERVICE_SRC).toContain('p_project_id');
    expect(SERVICE_SRC).toContain('p_signature_name');
  });

  it('deletes the JS compensating rollback', () => {
    expect(SERVICE_SRC).not.toContain('contractUpdated');
    expect(SERVICE_SRC).not.toMatch(/\.delete\(\)\s*\n?\s*\.eq\('id', signature\.id/);
    // signContract must not insert the signature row itself anymore.
    expect(SERVICE_SRC).not.toContain('ContractRepository.addSignature');
  });
});

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
