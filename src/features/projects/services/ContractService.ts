import { ContractRepository } from '@/features/contracts/repositories/ContractRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ContractSchema } from '@/shared/validation/schemas';
import type { Result, Contract, ContractStatus } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { ContractStateMachine } from '@/shared/utils/StateMachine';

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

      const validated = ContractSchema.parse({
        workspace_id: workspaceId,
        project_id: projectId,
        introduction: content,
        payment_schedule: '',
        terms: '',
        status,
      });

      let resolvedContractId = contractId;
      if (!resolvedContractId) {
        const existingContract = await ContractRepository.getByProjectId(workspaceId, projectId);
        if (existingContract) {
          resolvedContractId = existingContract.id;
        }
      }

      let contract;
      if (resolvedContractId) {
        contract = await ContractRepository.update(workspaceId, resolvedContractId, {
          introduction: validated.introduction,
          payment_schedule: validated.payment_schedule ?? null,
          terms: validated.terms ?? null,
          status: validated.status,
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
        action: status === 'sent' ? 'Contract Shared' : 'Contract Draft Saved',
        details: { contractId: contract.id },
      });

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
    signatureData: {
      signature_name: string;
      ip_address?: string;
    }
  ): Promise<Result<Contract>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const contract = await ContractRepository.getByProjectId(workspaceId, projectId);
      if (!contract || contract.id !== contractId) {
        throw new Error('Contract not found');
      }

      await ContractRepository.addSignature(workspaceId, {
        workspace_id: workspaceId,
        contract_id: contractId,
        signature_name: signatureData.signature_name,
        signature_date: new Date().toISOString(),
        ip_address: signatureData.ip_address || null,
      });

      const updatedContract = await ContractRepository.getByProjectId(workspaceId, projectId);
      if (updatedContract && updatedContract.contract_signatures) {
        const transition = ContractStateMachine.transition(updatedContract.status as ContractStatus, 'signed', {
          contractId,
          projectName: project.name
        });
        
        await LoggingService.logActivity({
          workspaceId,
          profileId,
          projectId,
          action: transition.activityLog.action,
          details: transition.activityLog.details,
        });
        
        await ContractRepository.update(workspaceId, contractId, { status: 'signed' });
      }

      return { success: true, data: contract };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
