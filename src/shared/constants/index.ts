import {
  ProjectStatus,
  ProposalStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentStatus
} from '@/shared/types';

export const PROJECT_STATUS = {
  LEAD: 'lead',
  PROPOSAL: 'proposal',
  APPROVED: 'approved',
  CONTRACT_SIGNED: 'contract_signed',
  ADVANCE_PAID: 'advance_paid',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  INVOICE_SENT: 'invoice_sent',
  PAID: 'paid',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export { ProjectStatus };

export const PROPOSAL_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION_REQUESTED: 'revision_requested',
} as const;

export { ProposalStatus };

export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  SIGNED: 'signed',
} as const;

export { ContractStatus };

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  PENDING_VERIFICATION: 'pending_verification',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export { InvoiceStatus };

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export { PaymentStatus };

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  CONTRACTS: 'contracts',
  PROPOSALS: 'proposals',
  INVOICES: 'invoices',
  DELIVERABLES: 'deliverables',
  BRANDING: 'branding',
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export const APP_ROUTES = {
  WORKSPACE: '/',
  PORTAL: '/portal/:token',
  PORTAL_PREFIX: '/portal',
} as const;

