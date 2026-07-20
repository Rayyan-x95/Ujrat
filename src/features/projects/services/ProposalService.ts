import { ProposalRepository } from '@/features/proposals/repositories/ProposalRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectCoreService } from './ProjectCoreService';
import { ProposalSchema } from '@/shared/validation/schemas';
import type { Result, Proposal, ProposalStatus, ProposalInsert } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { ProposalStateMachine } from '@/shared/utils/StateMachine';

export class ProposalService {
  static async getProposal(workspaceId: string, projectId: string): Promise<Result<Proposal | null>> {
    try {
      const data = await ProposalRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async saveProposal(
    workspaceId: string,
    profileId: string,
    projectId: string,
    proposalId: string | undefined,
    proposalData: ProposalInsert,
    status: 'draft' | 'sent'
  ): Promise<Result<Proposal>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const validated = ProposalSchema.parse({
        introduction: proposalData.introduction || '',
        scope: proposalData.scope || '',
        deliverables: proposalData.deliverables || [],
        timeline: proposalData.timeline || '',
        pricing: proposalData.pricing || 0,
        revision_policy: proposalData.revision_policy || '',
        terms: proposalData.terms || '',
        status,
      });

      const fullProposalData = {
        introduction: validated.introduction ?? null,
        scope: validated.scope ?? null,
        deliverables: validated.deliverables ?? [],
        timeline: validated.timeline ?? null,
        pricing: validated.pricing,
        revision_policy: validated.revision_policy ?? null,
        terms: validated.terms ?? null,
        status: validated.status,
        client_feedback: validated.client_feedback ?? null,
        workspace_id: workspaceId,
        project_id: projectId,
      };

      // Check transition validity and resolve proposalId
      let resolvedProposalId = proposalId;
      let currentStatus: ProposalStatus = 'draft';

      const existingProposal = await ProposalRepository.getByProjectId(workspaceId, projectId);
      if (existingProposal) {
        resolvedProposalId = existingProposal.id;
        currentStatus = existingProposal.status as ProposalStatus;
      } else if (proposalId) {
        const currentProposal = await ProposalRepository.getByProposalId(workspaceId, proposalId);
        if (currentProposal) {
          currentStatus = currentProposal.status as ProposalStatus;
        }
      }

      const transition = ProposalStateMachine.transition(currentStatus, status as ProposalStatus, {
        proposalId: resolvedProposalId || 'new'
      });

      let proposal;
      if (resolvedProposalId) {
        proposal = await ProposalRepository.update(workspaceId, resolvedProposalId, fullProposalData);
      } else {
        proposal = await ProposalRepository.create(workspaceId, fullProposalData);
      }

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: transition.activityLog.action,
        details: { ...transition.activityLog.details, proposalId: proposal.id },
      });

      if (status === 'sent') {
        const projectStatusRes = await ProjectCoreService.updateProjectStatus(workspaceId, profileId, projectId, 'proposal');
        if (!projectStatusRes.success) throw projectStatusRes.error;
      }

      return { success: true, data: proposal };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
