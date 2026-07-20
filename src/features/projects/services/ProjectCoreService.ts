import { ProjectRepository } from '../repositories/ProjectRepository';
import { ClientRepository } from '@/features/clients/repositories/ClientRepository';
import { ProjectSchema } from '@/shared/validation/schemas';
import type { Project, ProjectWithClient, Result, QueryOptions, PaginatedResult, ProjectStatus, ProjectInsert } from '@/shared/types';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { NotificationService } from '@/features/notifications/services/NotificationService';
import { ProjectStateMachine } from '@/shared/utils/StateMachine';

export class ProjectCoreService {
  static async listProjects(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<ProjectWithClient>>> {
    try {
      const data = await ProjectRepository.getAll(workspaceId, options);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getProjectDetails(workspaceId: string, id: string): Promise<Result<ProjectWithClient | null>> {
    try {
      const data = await ProjectRepository.getById(workspaceId, id);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async getProjectPortalToken(workspaceId: string, projectId: string): Promise<Result<string | null>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      return { success: true, data: project.portal_token || null };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async addProject(
    workspaceId: string,
    profileId: string,
    projectData: Omit<Project, 'id' | 'workspace_id' | 'portal_token' | 'created_at' | 'updated_at' | 'deleted_at'>
  ): Promise<Result<Project>> {
    try {
      const validated = ProjectSchema.parse(projectData);
      
      const client = await ClientRepository.getById(workspaceId, validated.client_id);
      if (!client) {
        throw new Error('Unauthorized: Client does not belong to your workspace');
      }

      const project = await ProjectRepository.create(workspaceId, validated as ProjectInsert);

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId: project.id,
        action: 'Project Created',
        details: { name: project.name },
      });

      return { success: true, data: project };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async updateProjectStatus(
    workspaceId: string,
    profileId: string,
    id: string,
    status: Project['status']
  ): Promise<Result<Project>> {
    try {
      const currentProject = await ProjectRepository.getById(workspaceId, id);
      if (!currentProject) {
        throw new Error('Project not found');
      }

      const currentStatus = currentProject.status;
      if (currentStatus !== status) {
        const client = await ClientRepository.getById(workspaceId, currentProject.client_id);
        
        const transition = ProjectStateMachine.transition(currentStatus as ProjectStatus, status as ProjectStatus, {
          projectName: currentProject.name
        });

        await LoggingService.logActivity({
          workspaceId,
          profileId,
          projectId: id,
          action: transition.activityLog.action,
          details: transition.activityLog.details,
        });

        if (client?.email && transition.emailNotification) {
          // Send email in background so it does not block the UI or database updates
          NotificationService.sendEmail(
            workspaceId,
            profileId,
            client.email,
            transition.emailNotification.subject,
            transition.emailNotification.body
          ).catch(err => {
            console.error('Failed to send status update email:', err);
          });
        }
      }

      const project = await ProjectRepository.update(workspaceId, id, { status });
      return { success: true, data: project };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
