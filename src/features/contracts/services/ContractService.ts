import { ContractRepository } from '../repositories/ContractRepository';
import { ProjectRepository } from '@/features/projects/repositories/ProjectRepository';
import { ContractSchema, ContractSignatureSchema } from '@/shared/validation/schemas';
import type { Result, Contract, ContractStatus, ContractSignature } from '@/shared/types';
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
      let currentStatus: ContractStatus = 'draft';

      const existingContract = await ContractRepository.getByProjectId(workspaceId, projectId);
      if (existingContract) {
        resolvedContractId = existingContract.id;
        currentStatus = existingContract.status as ContractStatus;
      }

      let contract: Contract;
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

      const transition = ContractStateMachine.transition(currentStatus, status as ContractStatus, {
        contractId: contract.id
      });

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
