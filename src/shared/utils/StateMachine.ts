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

function createStateMachine<S extends string>(
  allowed: Record<S, S[]>,
  actionName: string,
  errorContext: string = 'state'
) {
  return {
    validate: (current: S, next: S): boolean => {
      if (current === next) return true;
      return (allowed[current] || []).includes(next);
    },
    transition: (current: S, next: S, details: Record<string, any> = {}): TransitionDescriptor<S> => {
      if (current !== next && !(allowed[current] || []).includes(next)) {
        throw new Error(`Invalid ${errorContext} transition from '${current}' to '${next}'`);
      }
      return {
        next,
        activityLog: {
          action: actionName,
          details: { ...details, from: current, to: next },
        },
      };
    },
  };
}

const rawProjectSM = createStateMachine<ProjectStatus>(
  {
    lead: ['proposal', 'archived'],
    proposal: ['approved', 'archived'],
    approved: ['contract_signed', 'archived'],
    contract_signed: ['advance_paid', 'in_progress', 'archived'],
    advance_paid: ['in_progress', 'archived'],
    in_progress: ['delivered', 'archived'],
    delivered: ['invoice_sent', 'archived'],
    invoice_sent: ['paid', 'archived', 'delivered'],
    paid: ['completed', 'archived'],
    completed: ['archived'],
    archived: ['lead', 'proposal', 'in_progress'],
  },
  'Project Status Updated',
  'project state'
);

export const ProjectStateMachine = {
  validate: rawProjectSM.validate,
  transition: (current: ProjectStatus, next: ProjectStatus, details: { projectName: string }): TransitionDescriptor<ProjectStatus> => {
    const res = rawProjectSM.transition(current, next, { projectName: details.projectName });
    res.emailNotification = {
      subject: `Project "${details.projectName}" status updated to ${next}`,
      body: `
        <p>Dear Client,</p>
        <p>Your project <strong>${details.projectName}</strong> has progressed to status <strong>${next}</strong>.</p>
        <p>You can view updates on your client portal.</p>
      `,
    };
    return res;
  },
};

export const ProposalStateMachine = createStateMachine<ProposalStatus>(
  {
    draft: ['sent'],
    sent: ['approved', 'rejected', 'revision_requested'],
    approved: ['draft', 'sent'],
    rejected: ['draft', 'sent'],
    revision_requested: ['draft', 'sent'],
  },
  'Proposal Status Updated',
  'proposal state'
);

export const InvoiceStateMachine = createStateMachine<InvoiceStatus>(
  {
    draft: ['sent', 'pending_verification', 'cancelled'],
    sent: ['viewed', 'pending_verification', 'paid', 'overdue', 'cancelled'],
    viewed: ['pending_verification', 'paid', 'overdue', 'cancelled'],
    pending_verification: ['paid', 'sent', 'overdue', 'cancelled'],
    paid: [],
    overdue: ['paid', 'cancelled'],
    cancelled: [],
  },
  'Invoice Status Updated',
  'invoice state'
);

export const PaymentStateMachine = createStateMachine<PaymentStatus>(
  {
    pending: ['pending_verification', 'completed', 'failed'],
    pending_verification: ['completed', 'failed'],
    completed: [],
    failed: [],
  },
  'Payment Status Updated',
  'payment state'
);

export type PaymentRequestLifecycleStatus =
  | 'pending'
  | 'viewed'
  | 'initiated'
  | 'awaiting_verification'
  | 'verified'
  | 'rejected'
  | 'paid'
  | 'cancelled'
  | 'expired';

export const PaymentRequestStateMachine = createStateMachine<PaymentRequestLifecycleStatus>(
  {
    pending: ['viewed', 'initiated', 'cancelled', 'expired'],
    viewed: ['initiated', 'awaiting_verification', 'cancelled', 'expired'],
    initiated: ['awaiting_verification', 'cancelled', 'expired'],
    awaiting_verification: ['verified', 'rejected', 'initiated', 'paid', 'cancelled'],
    verified: ['paid', 'rejected'],
    rejected: ['initiated', 'cancelled'],
    paid: [],
    cancelled: [],
    expired: [],
  },
  'Payment Request Lifecycle Updated',
  'payment request'
);

export const ContractStateMachine = createStateMachine<ContractStatus>(
  {
    draft: ['sent', 'void'],
    sent: ['signed', 'void'],
    signed: ['void'],
    void: ['draft'],
  },
  'Contract Status Updated',
  'contract state'
);