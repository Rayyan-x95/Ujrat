import type { Database } from './database.types';

// Base row types from database
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Workspace = Database['public']['Tables']['workspaces']['Row'];
export type WorkspaceSettings = Database['public']['Tables']['workspace_settings']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectBrief = Database['public']['Tables']['project_briefs']['Row'];
export type Proposal = Database['public']['Tables']['proposals']['Row'];
export type ProposalSection = Database['public']['Tables']['proposal_sections']['Row'];
export type Contract = Database['public']['Tables']['contracts']['Row'];
export type ContractSignature = Database['public']['Tables']['contract_signatures']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];

// Payment type - DB is missing updated_at due to trigger, add it
export type Payment = Database['public']['Tables']['payments']['Row'] & {
  updated_at: string;
};

export type Deliverable = Database['public']['Tables']['deliverables']['Row'];
export type FileUpload = Database['public']['Tables']['file_uploads']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type EmailLog = Database['public']['Tables']['email_logs']['Row'];

// Insert types (without id, created_at, updated_at, deleted_at)
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectBriefInsert = Database['public']['Tables']['project_briefs']['Insert'];
export type ProposalInsert = Database['public']['Tables']['proposals']['Insert'];
export type ProposalSectionInsert = Database['public']['Tables']['proposal_sections']['Insert'];
export type ContractInsert = Database['public']['Tables']['contracts']['Insert'];
export type ContractSignatureInsert = Database['public']['Tables']['contract_signatures']['Insert'];
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type DeliverableInsert = Database['public']['Tables']['deliverables']['Insert'];

// Update types (partial, without id, created_at, updated_at, deleted_at)
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type ProjectBriefUpdate = Database['public']['Tables']['project_briefs']['Update'];
export type ProposalUpdate = Database['public']['Tables']['proposals']['Update'];
export type ProposalSectionUpdate = Database['public']['Tables']['proposal_sections']['Update'];
export type ContractUpdate = Database['public']['Tables']['contracts']['Update'];
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];
export type DeliverableUpdate = Database['public']['Tables']['deliverables']['Update'];

// Status enums - must match StateMachine union types for type safety
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'pending_verification' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'pending' | 'pending_verification' | 'completed' | 'failed';
export type ProjectStatus = 'lead' | 'proposal' | 'approved' | 'contract_signed' | 'advance_paid' | 'in_progress' | 'delivered' | 'invoice_sent' | 'paid' | 'completed' | 'archived';
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'revision_requested';
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'void';
export type ClientStatus = 'active' | 'archived';

// Financial event types
export type FinancialEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_CANCELLED'
  | 'INVOICE_REVISION_CREATED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'REFUND_CREATED'
  | 'REFUND_COMPLETED';

// Composite domain model aggregates with proper joined types
// Using unknown for relations since Supabase doesn't have FK relationships defined
export interface ProjectWithClient extends Project {
  clients?: Client | null;
  project_briefs?: ProjectBrief | null;
  proposals?: Proposal | null;
  contracts?: Contract | null;
  invoices?: Invoice[];
}

export interface InvoiceWithItems extends Invoice {
  invoice_items?: InvoiceItem[];
  projects?: Project & { clients?: Client | null };
}

export interface ProposalWithSections extends Proposal {
  proposal_sections?: ProposalSection[];
  projects?: Project & { clients?: Client | null };
}

export interface ContractWithSignature extends Contract {
  contract_signatures?: ContractSignature | null;
  projects?: Project & { clients?: Client | null };
}

// Service Result Type for clean, error-safe programming
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Query options for repository pagination, searching, sorting, and filtering
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filter?: Record<string, unknown>;
}

// Universal paginated result wrapper
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}