import { supabase } from '@/shared/lib/supabaseClient';
import type { Project, Client, Proposal, Contract, Invoice, Deliverable } from '@/shared/types';

/**
 * F7 (revised): projection of workspace settings consumed by client-facing
 * surfaces (portal header, UPI card, GST invoice print view). Contains the
 * supplier particulars and payment-routing details invoices are legally
 * required to show; internal-only preference columns stay private.
 */
export interface PortalSettings {
  company_name: string | null;
  gstin: string | null;
  upi_id: string | null;
  logo_url: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  is_gst_registered: boolean | null;
  tax_scheme: string | null;
  lut_number: string | null;
}

export class PortalRepository {
  static async getProject(token: string): Promise<Project | null> {
    const { data, error } = await supabase.rpc('get_portal_project', { token_val: token });
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  static async getClient(token: string): Promise<Client | null> {
    const { data, error } = await supabase.rpc('get_portal_client', { token_val: token });
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  static async getSettings(token: string): Promise<PortalSettings | null> {
    const { data, error } = await supabase.rpc('get_portal_settings', { token_val: token });
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  static async getProposal(token: string): Promise<Proposal | null> {
    const { data, error } = await supabase.rpc('get_portal_proposal', { token_val: token });
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  static async getContract(token: string): Promise<Contract | null> {
    const { data, error } = await supabase.rpc('get_portal_contract', { token_val: token });
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  static async getInvoices(token: string): Promise<Invoice[]> {
    const { data, error } = await supabase.rpc('get_portal_invoices', { token_val: token });
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getDeliverables(token: string): Promise<Deliverable[]> {
    const { data, error } = await supabase.rpc('get_portal_deliverables', { token_val: token });
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async submitSignature(
    token: string,
    name: string,
    ip: string,
    verified: boolean = true,
    signatureImage?: string | null,
    signatureType: string = 'drawn'
  ): Promise<void> {
    const { error } = await supabase.rpc('submit_portal_signature', {
      token_val: token,
      sig_name: name,
      ip_addr: ip,
      email_verified: verified,
      sig_image: signatureImage ?? null,
      sig_type: signatureType,
    });
    if (error) throw new Error(error.message);
  }

  static async submitPayment(
    token: string,
    invoiceId: string,
    amount: number,
    method: string,
    reference: string
  ): Promise<void> {
    const { error } = await supabase.rpc('submit_portal_payment', {
      token_val: token,
      invoice_id_val: invoiceId,
      amt: amount,
      pay_method: method,
      tx_ref: reference,
    });
    if (error) throw new Error(error.message);
  }

  static async submitFeedback(token: string, feedback: string): Promise<void> {
    const { error } = await supabase.rpc('submit_portal_brief_feedback', {
      token_val: token,
      feedback_val: feedback,
    });
    if (error) throw new Error(error.message);
  }

  static async approveProposal(token: string): Promise<void> {
    const { error } = await supabase.rpc('approve_portal_proposal', {
      token_val: token,
    });
    if (error) throw new Error(error.message);
  }

  static async generateVerificationCode(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_portal_verification', { token_val: token });
    if (error) throw new Error(error.message);
    return data;
  }

  static async verifyCode(token: string, code: string): Promise<boolean> {
    const { data, error } = await (supabase.rpc as any)('verify_portal_code', { token_val: token, entered_code: code });
    if (error) throw new Error(error.message);
    return !!data;
  }
}
