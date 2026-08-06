import { ProjectRepository } from '../repositories/ProjectRepository';
import { ClientRepository } from '@/features/clients/repositories/ClientRepository';
import { EmailLogRepository } from '@/features/auth/repositories/EmailLogRepository';
import { InvoiceService } from '@/features/invoices/services/InvoiceService';
import { ProjectSchema } from '@/shared/validation/schemas';
import { LoggingService } from '@/features/auth/services/LoggingService';
import { NotificationService } from '@/features/notifications/services/NotificationService';
import { ProjectStateMachine } from '@/shared/utils/StateMachine';
import type {
  Project,
  ProjectWithClient,
  Result,
  QueryOptions,
  PaginatedResult,
  EmailLog,
  Invoice,
  ProjectStatus,
  ProjectInsert,
} from '@/shared/types';

export class ProjectService {
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
          projectName: currentProject.name,
        });

        await LoggingService.logActivity({
          workspaceId,
          profileId,
          projectId: id,
          action: transition.activityLog.action,
          details: transition.activityLog.details,
        });

        if (client?.email && transition.emailNotification) {
          NotificationService.sendEmail(
            workspaceId,
            profileId,
            client.email,
            transition.emailNotification.subject,
            transition.emailNotification.body
          ).catch((err) => {
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

  static async getEmailLogs(workspaceId: string, projectId: string): Promise<Result<EmailLog[]>> {
    try {
      const data = await EmailLogRepository.getByProjectId(workspaceId, projectId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static async generateInvoice(
    workspaceId: string,
    profileId: string,
    projectId: string,
    invoiceData: { invoice_number: string; amount: number; note: string }
  ): Promise<Result<Invoice>> {
    try {
      const project = await ProjectRepository.getById(workspaceId, projectId);
      if (!project) throw new Error('Unauthorized project workspace access');

      const invoice = await InvoiceService.createInvoice(workspaceId, profileId, projectId, {
        invoice_number: invoiceData.invoice_number,
        invoice_date: new Date().toISOString().split('T')[0] || '',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
        notes: invoiceData.note || '',
        items: [{
          description: invoiceData.note || 'Project milestone',
          quantity: 1,
          rate: invoiceData.amount,
          gst_rate: 18,
          hsn_code: '998314',
        }],
      });

      if (!invoice.success) {
        throw invoice.error || new Error('Failed to generate invoice');
      }

      await LoggingService.logActivity({
        workspaceId,
        profileId,
        projectId,
        action: 'Invoice Generated',
        details: { invoiceId: invoice.data.id, invoiceNumber: invoice.data.invoice_number, amount: invoiceData.amount },
      });

      return { success: true, data: invoice.data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}