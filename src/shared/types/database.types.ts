export type ProfilesRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkspacesRow = {
  id: string;
  profile_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkspaceSettingsRow = {
  id: string;
  workspace_id: string;
  company_name: string | null;
  gstin: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  updated_at: string;
  state: string | null;
  is_gst_registered: boolean;
};

export type ClientsRow = {
  id: string;
  workspace_id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  state: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectsRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  budget: number;
  timeline_start: string | null;
  timeline_end: string | null;
  deliverables: unknown;
  notes: string | null;
  status: string;
  portal_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectBriefsRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  description: string | null;
  goals: string | null;
  deadline: string | null;
  budget: number | null;
  references: string | null;
  attachments: unknown;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProposalsRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  introduction: string | null;
  scope: string | null;
  deliverables: unknown;
  timeline: string | null;
  pricing: number;
  revision_policy: string | null;
  terms: string | null;
  status: string;
  client_feedback: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProposalSectionsRow = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  title: string;
  content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContractsRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  introduction: string | null;
  payment_schedule: string | null;
  terms: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvoiceTransactionResult = {
  invoice: InvoicesRow;
  invoice_items: InvoiceItemsRow[];
};

export type InvoicePaymentTransactionResult = {
  success: boolean;
  invoice: InvoicesRow | null;
  payments: PaymentsRow[] | null;
};

export type ContractSignaturesRow = {
  id: string;
  workspace_id: string;
  contract_id: string;
  signature_name: string;
  signature_date: string;
  ip_address: string | null;
  created_at: string;
};

export type InvoicesRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  notes: string | null;
  gstin: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: string;
  pdf_url: string | null;
  freelancer_gstin: string | null;
  client_gstin: string | null;
  freelancer_state: string | null;
  client_state: string | null;
  is_interstate: boolean;
  is_zero_rated: boolean;
  is_reverse_charge: boolean;
  outstanding_balance: number;
  prefix: string;
  year: number;
  serial_number: number;
  revision_number: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvoiceItemsRow = {
  id: string;
  workspace_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  hsn_code: string | null;
  amount: number;
};

export type PaymentsRow = {
  id: string;
  workspace_id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  payment_date: string;
  status: 'pending' | 'completed' | 'failed';
  verifier_id: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type DeliverablesRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  downloaded_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type FileUploadsRow = {
  id: string;
  workspace_id: string;
  name: string;
  storage_path: string;
  bucket: string;
  size: number | null;
  mime_type: string | null;
  created_at: string;
};

export type ActivityLogsRow = {
  id: string;
  workspace_id: string;
  profile_id: string | null;
  project_id: string | null;
  action: string;
  details: unknown;
  created_at: string;
};

export type EmailLogsRow = {
  id: string;
  workspace_id: string;
  profile_id: string | null;
  project_id: string | null;
  recipient: string;
  subject: string;
  body: string | null;
  resend_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
};

export type FinancialAuditTrailRow = {
  id: string;
  workspace_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  event_type: string;
  amount: number | null;
  details: unknown;
  created_at: string;
};

export type PortalVerificationsRow = {
  id: string;
  project_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  last_sent_at: string;
  verified: boolean;
  created_at: string;
};

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfilesRow;
        Insert: Omit<ProfilesRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<ProfilesRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
        Relationships: [];
      };
      workspaces: {
        Row: WorkspacesRow;
        Insert: Omit<WorkspacesRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<WorkspacesRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
        Relationships: [];
      };
      workspace_settings: {
        Row: WorkspaceSettingsRow;
        Insert: Omit<WorkspaceSettingsRow, 'id' | 'updated_at'>;
        Update: Partial<Omit<WorkspaceSettingsRow, 'id' | 'updated_at'>>;
        Relationships: [];
      };
      clients: {
        Row: ClientsRow;
        Insert: Omit<ClientsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<ClientsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
        Relationships: [];
      };
      projects: {
        Row: ProjectsRow;
        Insert: Omit<ProjectsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'portal_token'>;
        Update: Partial<Omit<ProjectsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'portal_token'>>;
        Relationships: [];
      };
      project_briefs: {
        Row: ProjectBriefsRow;
        Insert: Omit<ProjectBriefsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<ProjectBriefsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
        Relationships: [];
      };
      proposals: {
        Row: ProposalsRow;
        Insert: Omit<ProposalsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<ProposalsRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      proposal_sections: {
        Row: ProposalSectionsRow;
        Insert: Omit<ProposalSectionsRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProposalSectionsRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      contracts: {
        Row: ContractsRow;
        Insert: Omit<ContractsRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<ContractsRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      contract_signatures: {
        Row: ContractSignaturesRow;
        Insert: Omit<ContractSignaturesRow, 'id' | 'created_at'>;
        Update: Partial<Omit<ContractSignaturesRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      invoices: {
        Row: InvoicesRow;
        Insert: Omit<InvoicesRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Omit<InvoicesRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      invoice_items: {
        Row: InvoiceItemsRow;
        Insert: Omit<InvoiceItemsRow, 'id' | 'workspace_id' | 'invoice_id'>;
        Update: Partial<Omit<InvoiceItemsRow, 'id' | 'workspace_id' | 'invoice_id'>>;
        Relationships: [];
      };
      payments: {
        Row: PaymentsRow;
        Insert: Omit<PaymentsRow, 'id' | 'created_at' | 'deleted_at'>;
        Update: Partial<Omit<PaymentsRow, 'id' | 'created_at' | 'deleted_at'>>;
        Relationships: [];
      };
      deliverables: {
        Row: DeliverablesRow;
        Insert: Omit<DeliverablesRow, 'id' | 'created_at' | 'deleted_at'>;
        Update: Partial<Omit<DeliverablesRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      file_uploads: {
        Row: FileUploadsRow;
        Insert: Omit<FileUploadsRow, 'id' | 'created_at'>;
        Update: Partial<Omit<FileUploadsRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      activity_logs: {
        Row: ActivityLogsRow;
        Insert: Omit<ActivityLogsRow, 'id' | 'created_at'>;
        Update: Partial<Omit<ActivityLogsRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      email_logs: {
        Row: EmailLogsRow;
        Insert: Omit<EmailLogsRow, 'id' | 'created_at'>;
        Update: Partial<Omit<EmailLogsRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      financial_audit_trail: {
        Row: FinancialAuditTrailRow;
        Insert: Omit<FinancialAuditTrailRow, 'id' | 'created_at'>;
        Update: Partial<Omit<FinancialAuditTrailRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      portal_verifications: {
        Row: PortalVerificationsRow;
        Insert: Omit<PortalVerificationsRow, 'id' | 'created_at'>;
        Update: Partial<Omit<PortalVerificationsRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_next_invoice_serial: {
        Args: {
          p_workspace_id: string;
          p_prefix: string;
          p_date: string;
        };
        Returns: number;
      };
      get_portal_project: {
        Args: {
          token_val: string;
        };
        Returns: ProjectsRow[];
      };
      get_portal_client: {
        Args: {
          token_val: string;
        };
        Returns: ClientsRow[];
      };
      get_portal_settings: {
        Args: {
          token_val: string;
        };
        Returns: WorkspaceSettingsRow[];
      };
      get_portal_proposal: {
        Args: {
          token_val: string;
        };
        Returns: ProposalsRow[];
      };
      get_portal_contract: {
        Args: {
          token_val: string;
        };
        Returns: ContractsRow[];
      };
      get_portal_invoices: {
        Args: {
          token_val: string;
        };
        Returns: InvoicesRow[];
      };
      get_portal_deliverables: {
        Args: {
          token_val: string;
        };
        Returns: DeliverablesRow[];
      };
      submit_portal_signature: {
        Args: {
          token_val: string;
          sig_name: string;
          ip_addr: string;
          email_verified: boolean;
        };
        Returns: void;
      };
      submit_portal_payment: {
        Args: {
          token_val: string;
          invoice_id_val: string;
          amt: number;
          pay_method: string;
          tx_ref: string;
        };
        Returns: void;
      };
      submit_portal_brief_feedback: {
        Args: {
          token_val: string;
          feedback_val: string;
        };
        Returns: void;
      };
      approve_portal_proposal: {
        Args: {
          token_val: string;
        };
        Returns: void;
      };
      generate_portal_verification: {
        Args: {
          token_val: string;
        };
        Returns: string;
      };
      verify_portal_code: {
        Args: {
          token_val: string;
          input_code: string;
        };
        Returns: boolean;
      };
      create_invoice_transactional: {
        Args: {
          p_workspace_id: string;
          p_invoice_data: unknown;
          p_invoice_items: unknown;
        };
        Returns: InvoiceTransactionResult;
      };
      mark_invoice_paid_transactional: {
        Args: {
          p_workspace_id: string;
          p_profile_id: string;
          p_invoice_id: string;
        };
        Returns: InvoicePaymentTransactionResult;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};
