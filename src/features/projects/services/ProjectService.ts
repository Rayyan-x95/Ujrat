import { ProjectCoreService } from './ProjectCoreService';
import { ProposalService } from './ProposalService';
import { ContractService } from './ContractService';
import { DeliverableService } from './DeliverableService';
import { InvoiceGatewayService } from './InvoiceGatewayService';
import type { Project, ProjectWithClient, Result, QueryOptions, PaginatedResult, Contract, Deliverable, Proposal, EmailLog, ProposalInsert, Invoice } from '@/shared/types';

export class ProjectService {
  static listProjects(
    workspaceId: string,
    options: QueryOptions = {}
  ): Promise<Result<PaginatedResult<ProjectWithClient>>> {
    return ProjectCoreService.listProjects(workspaceId, options);
  }

  static getProjectDetails(workspaceId: string, id: string): Promise<Result<ProjectWithClient | null>> {
    return ProjectCoreService.getProjectDetails(workspaceId, id);
  }

  static getProjectPortalToken(workspaceId: string, projectId: string): Promise<Result<string | null>> {
    return ProjectCoreService.getProjectPortalToken(workspaceId, projectId);
  }

  static addProject(
    workspaceId: string,
    profileId: string,
    projectData: Omit<Project, 'id' | 'workspace_id' | 'portal_token' | 'created_at' | 'updated_at' | 'deleted_at'>
  ): Promise<Result<Project>> {
    return ProjectCoreService.addProject(workspaceId, profileId, projectData);
  }

  static updateProjectStatus(
    workspaceId: string,
    profileId: string,
    id: string,
    status: Project['status']
  ): Promise<Result<Project>> {
    return ProjectCoreService.updateProjectStatus(workspaceId, profileId, id, status);
  }

  static getProposal(workspaceId: string, projectId: string): Promise<Result<Proposal | null>> {
    return ProposalService.getProposal(workspaceId, projectId);
  }

  static saveProposal(
    workspaceId: string,
    profileId: string,
    projectId: string,
    proposalId: string | undefined,
    proposalData: ProposalInsert,
    status: 'draft' | 'sent'
  ): Promise<Result<Proposal>> {
    return ProposalService.saveProposal(workspaceId, profileId, projectId, proposalId, proposalData, status);
  }

  static getContract(workspaceId: string, projectId: string): Promise<Result<Contract | null>> {
    return ContractService.getContract(workspaceId, projectId);
  }

  static saveContract(
    workspaceId: string,
    profileId: string,
    projectId: string,
    contractId: string | undefined,
    content: string,
    status: 'draft' | 'sent'
  ): Promise<Result<Contract>> {
    return ContractService.saveContract(workspaceId, profileId, projectId, contractId, content, status);
  }

  static signContract(
    workspaceId: string,
    profileId: string,
    projectId: string,
    contractId: string,
    signatureData: {
      signature_name: string;
      ip_address?: string;
    }
  ): Promise<Result<Contract>> {
    return ContractService.signContract(workspaceId, profileId, projectId, contractId, signatureData);
  }

  static getDeliverables(workspaceId: string, projectId: string): Promise<Result<Deliverable[]>> {
    return DeliverableService.getDeliverables(workspaceId, projectId);
  }

  static addDeliverable(
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
    return DeliverableService.addDeliverable(workspaceId, profileId, projectId, deliverableData);
  }

  static addDeliverableLink(
    workspaceId: string,
    profileId: string,
    projectId: string,
    name: string,
    linkUrl: string
  ): Promise<Result<Deliverable>> {
    return DeliverableService.addDeliverableLink(workspaceId, profileId, projectId, name, linkUrl);
  }

  static getEmailLogs(workspaceId: string, projectId: string): Promise<Result<EmailLog[]>> {
    return InvoiceGatewayService.getEmailLogs(workspaceId, projectId);
  }

  static generateInvoice(
    workspaceId: string,
    profileId: string,
    projectId: string,
    invoiceData: { invoice_number: string; amount: number; note: string }
  ): Promise<Result<Invoice>> {
    return InvoiceGatewayService.generateInvoice(workspaceId, profileId, projectId, invoiceData);
  }
}