import { ContractRepository } from '../repositories/ContractRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { ContractSchema } from '@/shared/validation/schemas';
import type { Result, Contract, ContractStatus, ProjectStatus } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { ContractStateMachine, ProjectStateMachine } from '@/shared/utils/StateMachine';

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

      // The contract is already persisted at this point and the DB trigger
      // rejects a status the project is not in, so skip the move instead of
      // failing the whole call after the write.
      if (status === 'sent' && ProjectStateMachine.validate(project.status as ProjectStatus, 'approved')) {
        await ProjectRepository.update(workspaceId, projectId, { status: 'approved' });
      }

      return { success: true, data: contract };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
