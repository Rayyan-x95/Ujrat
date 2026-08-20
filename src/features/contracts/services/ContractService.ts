import { ContractRepository } from '../repositories/ContractRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { ContractSchema, ContractSignatureSchema } from '@/shared/validation/schemas';
import type { Result, Contract, ContractStatus, ContractSignature } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { ContractStateMachine } from '@/shared/utils/StateMachine';
import { supabase } from '@/shared/lib/supabaseClient';

export class ContractService {
  static async getContract(workspaceId: string, projectId: string): Promise<Result<Contract | null>> {
    try {
      const data = await ContractRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async saveContract(
    workspaceId: string,
    profileId: string,
    projectId: string,
    contractId: string | undefined,
    content: string,
    status: 'draft' | 'sent'
  ): Promise<Result<Contract>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      let resolvedContractId = contractId;
      let currentStatus: ContractStatus = 'draft';

      const existingContract = await ContractRepository.getByProjectId(workspaceId, projectId);
      if (existingContract) {
        resolvedContractId = existingContract.id;
        currentStatus = existingContract.status as ContractStatus;
      }

      // Transition check ahead of persistence
      const transition = ContractStateMachine.transition(currentStatus, status as ContractStatus, {
        contractId: resolvedContractId || 'new-contract',
      });

      const validated = ContractSchema.parse({
        workspace_id: workspaceId,
        project_id: projectId,
        introduction: content,
        payment_schedule: existingContract?.payment_schedule ?? '',
        terms: existingContract?.terms ?? '',
        status,
      });

      let contract: Contract;
      if (resolvedContractId) {
        contract = await ContractRepository.update(workspaceId, resolvedContractId, {
          introduction: validated.introduction,
          status: validated.status,
          ...(existingContract?.payment_schedule !== undefined ? { payment_schedule: existingContract.payment_schedule } : {}),
          ...(existingContract?.terms !== undefined ? { terms: existingContract.terms } : {}),
        });
      } else {
        contract = await ContractRepository.create(workspaceId, {
          workspace_id: workspaceId,
          project_id: projectId,
          introduction: validated.introduction,
          payment_schedule: validated.payment_schedule ?? null,
          terms: validated.terms ?? null,
          status: validated.status,
        });
      }

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: transition.activityLog.action,
        details: { ...transition.activityLog.details, contractId: contract.id },
      });

      if (status === 'sent') {
        await ProjectRepository.update(workspaceId, projectId, { status: 'approved' });
      }

      return { success: true, data: contract };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async signContract(
    workspaceId: string,
    profileId: string,
    projectId: string,
    contractId: string,
    signatureData: { signature_name: string; ip_address?: string | null }
  ): Promise<Result<ContractSignature>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const contract = await ContractRepository.getByProjectId(workspaceId, projectId);
      if (!contract || contract.id !== contractId) {
        throw new Error('Contract not found for specified project');
      }

      if (contract.status === 'signed') {
        if (contract.contract_signatures) {
          return {
            success: true,
            data: contract.contract_signatures,
          };
        }

        const { data: persistedSig, error: sigError } = await (supabase as any)
          .from('contract_signatures')
          .select('*')
          .eq('contract_id', contractId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (sigError) {
          throw new Error(`Failed to query contract signature: ${sigError.message}`);
        }

        if (persistedSig) {
          return {
            success: true,
            data: persistedSig,
          };
        }

        throw new Error('Contract is marked signed but no persisted signature record was found');
      }

      ContractStateMachine.transition(contract.status as ContractStatus, 'signed', {
        contractId,
      });

      const validated = ContractSignatureSchema.parse({
        signature_name: signatureData.signature_name,
        ip_address: signatureData.ip_address || '0.0.0.0',
      });

      const signature = await ContractRepository.addSignature(workspaceId, {
        workspace_id: workspaceId,
        contract_id: contractId,
        signature_name: validated.signature_name,
        signature_date: new Date().toISOString(),
        ip_address: validated.ip_address ?? '0.0.0.0',
      });

      await ContractRepository.update(workspaceId, contractId, { status: 'signed' });
      await ProjectRepository.update(workspaceId, projectId, { status: 'contract_signed' });

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: 'Contract Signed',
        details: { contractId, signatureName: validated.signature_name },
      });

      return { success: true, data: signature };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
