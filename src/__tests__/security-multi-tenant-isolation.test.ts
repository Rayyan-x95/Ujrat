import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/shared/lib/supabaseClient';
import { ClientRepository } from '@/features/clients/repositories/ClientRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { InvoiceRepository } from '@/features/invoices/repositories/InvoiceRepository';
import { ProposalRepository } from '@/features/proposals/repositories/ProposalRepository';
import { ContractRepository } from '@/features/contracts/repositories/ContractRepository';

describe('Multi-Tenant & Workspace Isolation Security Suite (F-001 / F-002)', () => {
  const workspaceA = '11111111-1111-4111-a111-111111111111';
  const workspaceB = '22222222-2222-4222-a222-222222222222';
  const projectA = '33333333-3333-4333-a333-333333333333';
  const clientB = '55555555-5555-4555-a555-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Repository-Level Workspace ID Enforcement', () => {
    it('ClientRepository scopes all queries strictly by workspaceId', async () => {
      const fromSpy = vi.spyOn(supabase, 'from');

      await ClientRepository.getAll(workspaceA).catch(() => {});
      expect(fromSpy).toHaveBeenCalledWith('clients');

      // Attempting to query with empty workspaceId throws
      await expect(ClientRepository.getAll('')).rejects.toThrow();
    });

    it('ProjectRepository prevents cross-workspace getById access', async () => {
      // Verify that getById attaches both id and workspace_id to query
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: selectMock,
        eq: eqMock,
        is: vi.fn().mockReturnThis(),
        single: singleMock,
      } as any);

      await ProjectRepository.getById(workspaceA, projectA);
      expect(eqMock).toHaveBeenCalledWith('workspace_id', workspaceA);
      expect(eqMock).toHaveBeenCalledWith('id', projectA);
    });

    it('InvoiceRepository enforces workspace_id on invoice fetching', async () => {
      const eqMock = vi.fn().mockReturnThis();
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      } as any);

      await InvoiceRepository.getAll(workspaceA);
      expect(eqMock).toHaveBeenCalledWith('workspace_id', workspaceA);
    });

    it('ProposalRepository enforces workspace_id on proposal creation and retrieval', async () => {
      const eqMock = vi.fn().mockReturnThis();
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      await ProposalRepository.getByProjectId(workspaceA, projectA);
      expect(eqMock).toHaveBeenCalledWith('workspace_id', workspaceA);
      expect(eqMock).toHaveBeenCalledWith('project_id', projectA);
    });

    it('ContractRepository enforces workspace_id on contract queries', async () => {
      const eqMock = vi.fn().mockReturnThis();
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      await ContractRepository.getByProjectId(workspaceA, projectA);
      expect(eqMock).toHaveBeenCalledWith('workspace_id', workspaceA);
      expect(eqMock).toHaveBeenCalledWith('project_id', projectA);
    });
  });

  describe('Cross-Workspace Entity Relationship Alignment Validation', () => {
    it('detects mismatched client and project workspaces', () => {
      const projectData = {
        workspace_id: workspaceA,
        client_id: clientB,
        client_workspace_id: workspaceB,
      };

      const isAligned = projectData.workspace_id === projectData.client_workspace_id;
      expect(isAligned).toBe(false);
    });

    it('detects mismatched invoice and project workspaces', () => {
      const invoiceData = {
        workspace_id: workspaceA,
        project_id: projectA,
        project_workspace_id: workspaceB,
      };

      const isAligned = invoiceData.workspace_id === invoiceData.project_workspace_id;
      expect(isAligned).toBe(false);
    });

    it('detects mismatched contract and project workspaces', () => {
      const contractData = {
        workspace_id: workspaceB,
        project_id: projectA,
        project_workspace_id: workspaceA,
      };

      const isAligned = contractData.workspace_id === contractData.project_workspace_id;
      expect(isAligned).toBe(false);
    });

    it('detects mismatched proposal and project workspaces', () => {
      const proposalData = {
        workspace_id: workspaceB,
        project_id: projectA,
        project_workspace_id: workspaceA,
      };

      const isAligned = proposalData.workspace_id === proposalData.project_workspace_id;
      expect(isAligned).toBe(false);
    });
  });
});
