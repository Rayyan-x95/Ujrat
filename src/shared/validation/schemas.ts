import { z } from 'zod';

// Profile & Workspace validations
export const ProfileSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').optional().nullable(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable(),
});

export const WorkspaceSettingsSchema = z.object({
  company_name: z.string().min(2, 'Company name is required').nullable(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format').optional().nullable().or(z.string().length(0)),
  bank_name: z.string().min(2, 'Bank name is required').nullable(),
  bank_account_no: z.string().min(8, 'Bank account number is required').nullable(),
  bank_ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').nullable(),
  upi_id: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. name@upi)').nullable(),
  address: z.string().min(5, 'Address must be descriptive').nullable(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit Indian phone number').nullable(),
  logo_url: z.string().url().optional().nullable().or(z.string().length(0)),
  state: z.string().optional().nullable(),
  is_gst_registered: z.boolean().default(false),
});

// Client schema
export const ClientSchema = z.object({
  name: z.string().min(2, 'Client name must be at least 2 characters'),
  company: z.string().optional().nullable(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'archived']).default('active'),
  state: z.string().optional().nullable(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format').optional().nullable().or(z.string().length(0)),
});

// Project schema
export const ProjectSchema = z.object({
  client_id: z.string().uuid('Invalid client identifier'),
  name: z.string().min(2, 'Project name is required'),
  budget: z.coerce.number().nonnegative('Budget cannot be negative'),
  timeline_start: z.string().optional().nullable(),
  timeline_end: z.string().optional().nullable(),
  deliverables: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['pending', 'completed']).default('pending'),
  })).default([]),
  notes: z.string().optional().nullable(),
  status: z.enum([
    'lead',
    'proposal',
    'approved',
    'contract_signed',
    'advance_paid',
    'in_progress',
    'delivered',
    'invoice_sent',
    'paid',
    'archived',
  ]).default('lead'),
});

// Project Brief schema
export const BriefSchema = z.object({
  description: z.string().min(10, 'Brief description must be descriptive'),
  goals: z.string().min(10, 'Project goals must be specified'),
  deadline: z.string().optional().nullable(),
  budget: z.coerce.number().nonnegative().optional().nullable(),
  references: z.string().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    size: z.number().optional(),
  })).default([]),
});

// Proposal and sections validation
export const ProposalSchema = z.object({
  introduction: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  deliverables: z.array(z.any()).default([]),
  timeline: z.string().optional().nullable(),
  pricing: z.coerce.number().nonnegative('Pricing cannot be negative'),
  revision_policy: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'revision_requested']).default('draft'),
  client_feedback: z.string().optional().nullable(),
});

export const ProposalSectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  content: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
});

// Contract & signature validation
export const ContractSchema = z.object({
  introduction: z.string().min(10, 'Contract introduction is required'),
  payment_schedule: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'signed']).default('draft'),
});

export const ContractSignatureSchema = z.object({
  signature_name: z.string().min(2, 'Enter your full legal name to sign'),
  ip_address: z.string().optional().nullable(),
});

// Invoice validation
export const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  rate: z.coerce.number().nonnegative('Rate cannot be negative'),
  gst_rate: z.coerce.number().nonnegative('GST rate cannot be negative'),
  hsn_code: z.string().optional().nullable(),
});

export const InvoiceSchema = z.object({
  project_id: z.string().uuid('Select a project'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string(),
  due_date: z.string(),
  notes: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one line item is required'),
  freelancer_gstin: z.string().optional().nullable(),
  client_gstin: z.string().optional().nullable(),
  freelancer_state: z.string().optional().nullable(),
  client_state: z.string().optional().nullable(),
});

// Payment/UTR verification schema
export const PaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice reference'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  payment_method: z.string().default('UPI'),
  transaction_reference: z.string().min(4, 'Enter a valid payment transaction ID or UTR number'),
});
