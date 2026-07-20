import type { ProjectStatus, InvoiceStatus, PaymentStatus, ContractStatus, ProposalStatus } from '@/shared/types';

export interface TransitionDescriptor<T> {
  next: T;
  activityLog: {
    action: string;
    details: Record<string, any>;
  };
  emailNotification?: {
    subject: string;
    body: string;
  };
}

export class ProjectStateMachine {
  private static allowed: Record<ProjectStatus, ProjectStatus[]> = {
    'lead': ['proposal', 'archived'],
    'proposal': ['approved', 'archived'],
    'approved': ['contract_signed', 'archived'],
    'contract_signed': ['advance_paid', 'in_progress', 'archived'],
    'advance_paid': ['in_progress', 'archived'],
    'in_progress': ['delivered', 'archived'],
    'delivered': ['invoice_sent', 'archived'],
    'invoice_sent': ['paid', 'archived', 'delivered'],
    'paid': ['completed', 'archived'],
    'completed': ['archived'],
    'archived': ['lead', 'proposal', 'in_progress'],
  };

  static validate(current: ProjectStatus, next: ProjectStatus): boolean {
    if (current === next) return true;
    const targets = this.allowed[current] || [];
    return targets.includes(next);
  }

  static transition(current: ProjectStatus, next: ProjectStatus, details: { projectName: string }): TransitionDescriptor<ProjectStatus> {
    if (!this.validate(current, next)) {
      throw new Error(`Invalid project state transition from '${current}' to '${next}'`);
    }

    const emailNotification = {
      subject: `Project "${details.projectName}" status updated to ${next}`,
      body: `
        <p>Dear Client,</p>
        <p>Your project <strong>${details.projectName}</strong> has progressed to status <strong>${next}</strong>.</p>
        <p>You can view updates on your client portal.</p>
      `,
    };

    return {
      next,
      activityLog: {
        action: 'Project Status Updated',
        details: { from: current, to: next, projectName: details.projectName },
      },
      emailNotification,
    };
  }
}

export class ProposalStateMachine {
  private static allowed: Record<ProposalStatus, ProposalStatus[]> = {
    'draft': ['sent'],
    'sent': ['approved', 'rejected', 'revision_requested'],
    'approved': ['draft', 'sent'],
    'rejected': ['draft', 'sent'],
    'revision_requested': ['draft', 'sent'],
  };

  static validate(current: ProposalStatus, next: ProposalStatus): boolean {
    if (current === next) return true;
    const targets = this.allowed[current] || [];
    return targets.includes(next);
  }

  static transition(current: ProposalStatus, next: ProposalStatus, details: { proposalId: string }): TransitionDescriptor<ProposalStatus> {
    if (!this.validate(current, next)) {
      throw new Error(`Invalid proposal state transition from '${current}' to '${next}'`);
    }

    return {
      next,
      activityLog: {
        action: 'Proposal Status Updated',
        details: { proposalId: details.proposalId, from: current, to: next },
      },
    };
  }
}

export class InvoiceStateMachine {
  private static allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    'draft': ['sent', 'pending_verification', 'cancelled'],
    'sent': ['viewed', 'pending_verification', 'paid', 'overdue', 'cancelled'],
    'viewed': ['pending_verification', 'paid', 'overdue', 'cancelled'],
    'pending_verification': ['paid', 'sent', 'overdue', 'cancelled'],
    'paid': [],  // paid invoices are immutable - no transitions allowed
    'overdue': ['paid', 'cancelled'],
    'cancelled': [],
  };

  static validate(current: InvoiceStatus, next: InvoiceStatus): boolean {
    if (current === next) return true;
    const targets = this.allowed[current] || [];
    return targets.includes(next);
  }

  static transition(current: InvoiceStatus, next: InvoiceStatus, details: { invoiceId: string; invoiceNumber: string }): TransitionDescriptor<InvoiceStatus> {
    if (!this.validate(current, next)) {
      throw new Error(`Invalid invoice state transition from '${current}' to '${next}'`);
    }

    return {
      next,
      activityLog: {
        action: 'Invoice Status Updated',
        details: { invoiceId: details.invoiceId, invoiceNumber: details.invoiceNumber, from: current, to: next },
      },
    };
  }
}

export class PaymentStateMachine {
  private static allowed: Record<PaymentStatus, PaymentStatus[]> = {
    'pending': ['pending_verification', 'completed', 'failed'],
    'pending_verification': ['completed', 'failed'],
    'completed': [],
    'failed': [],
  };

  static validate(current: PaymentStatus, next: PaymentStatus): boolean {
    if (current === next) return true;
    const targets = this.allowed[current] || [];
    return targets.includes(next);
  }

  static transition(current: PaymentStatus, next: PaymentStatus, details: { paymentId: string; utr: string }): TransitionDescriptor<PaymentStatus> {
    if (!this.validate(current, next)) {
      throw new Error(`Invalid payment state transition from '${current}' to '${next}'`);
    }

    return {
      next,
      activityLog: {
        action: 'Payment Status Updated',
        details: { paymentId: details.paymentId, utr: details.utr, from: current, to: next },
      },
    };
  }
}

export class ContractStateMachine {
  private static allowed: Record<ContractStatus, ContractStatus[]> = {
    'draft': ['sent', 'void'],
    'sent': ['signed', 'void'],
    'signed': ['void'],
    'void': ['draft'],
  };

  static validate(current: ContractStatus, next: ContractStatus): boolean {
    if (current === next) return true;
    const targets = this.allowed[current] || [];
    return targets.includes(next);
  }

  static transition(current: ContractStatus, next: ContractStatus, details: { contractId: string; projectName: string }): TransitionDescriptor<ContractStatus> {
    if (!this.validate(current, next)) {
      throw new Error(`Invalid contract state transition from '${current}' to '${next}'`);
    }

    return {
      next,
      activityLog: {
        action: 'Contract Status Updated',
        details: { contractId: details.contractId, projectName: details.projectName, from: current, to: next },
      },
    };
  }
}