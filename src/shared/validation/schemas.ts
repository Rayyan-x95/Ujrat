import { z } from 'zod';
import { SUPPORTED_CURRENCIES, TDS_SECTIONS } from '@/features/invoices/tax/TaxConstants';

const currencyKeys = Object.keys(SUPPORTED_CURRENCIES) as [string, ...string[]];
const tdsSectionKeys = Object.keys(TDS_SECTIONS) as [string, ...string[]];

export const CurrencyEnum = z.enum(currencyKeys);
export const TDSSectionEnum = z.enum(tdsSectionKeys);

// Profile & Workspace validations
export const ProfileSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').optional().nullable(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable(),
});

export const WorkspaceSettingsSchema = z.object({
  company_name: z.string().min(2, 'Company name is required').optional().nullable(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format').optional().nullable().or(z.string().length(0)),
  bank_name: z.string().min(2, 'Bank name is required').optional().nullable(),
  bank_account_no: z.string().min(8, 'Bank account number is required').optional().nullable(),
  bank_ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional().nullable(),
  upi_id: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. name@upi)').optional().nullable(),
  address: z.string().min(5, 'Address must be descriptive').optional().nullable(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit Indian phone number').optional().nullable(),
  logo_url: z.string().url().optional().nullable().or(z.string().length(0)),
  state: z.string().optional().nullable(),
  is_gst_registered: z.boolean().default(false),
  tax_scheme: z.enum(['regular', 'composition', 'non_gst']).default('regular'),
  lut_number: z.string().optional().nullable(),
  lut_expiry_date: z.string().optional().nullable(),
  default_tds_section: TDSSectionEnum.optional().nullable(),
  preferred_currency: CurrencyEnum.default('INR'),
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

export const ProposalDeliverableItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Deliverable title is required'),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
});

// Proposal and sections validation
export const ProposalSchema = z.object({
  introduction: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  deliverables: z.array(ProposalDeliverableItemSchema).default([]),
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
  sac_code: z.string().optional().nullable(),
  unit: z.string().default('NOS'),
  cess_rate: z.coerce.number().nonnegative().default(0),
  discount_amount: z.coerce.number().nonnegative().default(0),
});

export const InvoiceBaseSchema = z.object({
  project_id: z.string().uuid('Select a project'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  notes: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one line item is required'),
  freelancer_gstin: z.string().optional().nullable(),
  client_gstin: z.string().optional().nullable(),
  freelancer_state: z.string().optional().nullable(),
  client_state: z.string().optional().nullable(),
  tds_section: TDSSectionEnum.optional().nullable(),
  tds_rate: z.coerce.number().nonnegative().default(0),
  currency: CurrencyEnum.default('INR'),
  exchange_rate: z.coerce.number().positive().default(1.0),
  supply_type: z.string().optional().nullable(),
  tax_scheme: z.string().optional().nullable(),
  lut_number: z.string().optional().nullable(),
  discount_type: z.enum(['percentage', 'fixed']).default('fixed'),
  discount_scope: z.enum(['before_tax', 'after_tax']).default('before_tax'),
  discount_amount: z.coerce.number().nonnegative().default(0),
});

export const InvoiceSchema = InvoiceBaseSchema.superRefine((data, ctx) => {
  if (data.discount_type === 'percentage' && data.discount_amount > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage discount cannot exceed 100%',
      path: ['discount_amount'],
    });
  }
});

// Payment/UTR verification schema
export const PaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice reference'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  payment_method: z.string().default('UPI'),
  transaction_reference: z.string().min(4, 'Enter a valid payment transaction ID or UTR number'),
});
