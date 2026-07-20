import { supabase } from '@/shared/lib/supabaseClient';
import type { Project, Client, WorkspaceSettings, Proposal, Contract, Invoice, Deliverable } from '@/shared/types';

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

  static async getSettings(token: string): Promise<WorkspaceSettings | null> {
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

  static async submitSignature(token: string, name: string, ip: string, verified: boolean): Promise<void> {
    const { error } = await supabase.rpc('submit_portal_signature', {
      token_val: token,
      sig_name: name,
      ip_addr: ip,
      email_verified: verified,
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
    const { data, error } = await supabase.rpc('verify_portal_code', { token_val: token, input_code: code });
    if (error) throw new Error(error.message);
    return !!data;
  }
}
