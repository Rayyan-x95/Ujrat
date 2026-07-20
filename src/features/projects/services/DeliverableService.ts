import { DeliverableRepository } from '@/features/deliverables/repositories/DeliverableRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import type { Result, Deliverable } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';

export class DeliverableService {
  static async getDeliverables(workspaceId: string, projectId: string): Promise<Result<Deliverable[]>> {
    try {
      const data = await DeliverableRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async addDeliverable(
    workspaceId: string,
    profileId: string,
    projectId: string,
    deliverableData: {
      name: string;
      file_url: string;
      file_type: string;
      file_size: number;
    }
  ): Promise<Result<Deliverable>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const deliverable = await DeliverableRepository.addDeliverable(workspaceId, {
        workspace_id: workspaceId,
        project_id: projectId,
        name: deliverableData.name,
        file_url: deliverableData.file_url,
        file_type: deliverableData.file_type,
        file_size: deliverableData.file_size,
        uploaded_at: new Date().toISOString(),
        downloaded_at: null,
      });

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: 'Deliverable Uploaded',
        details: { deliverableId: deliverable.id, name: deliverableData.name },
      });

      return { success: true, data: deliverable };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async addDeliverableLink(
    workspaceId: string,
    profileId: string,
    projectId: string,
    name: string,
    linkUrl: string
  ): Promise<Result<Deliverable>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const deliverable = await DeliverableRepository.addDeliverable(workspaceId, {
        workspace_id: workspaceId,
        project_id: projectId,
        name,
        file_url: linkUrl,
        file_type: 'link',
        file_size: 0,
        uploaded_at: new Date().toISOString(),
        downloaded_at: null,
      });

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: 'Deliverable Link Added',
        details: { deliverableId: deliverable.id, name, linkUrl },
      });

      return { success: true, data: deliverable };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
