/**
 * Ujrat Tax Engine 2.0 - Tax Repository
 * Database Persistence • Tax Audit Logs • TDS Certificates • GSTR Reporting Aggregations
 */

import { supabase } from '@/shared/lib/supabaseClient';
import type { GSTR1Summary } from './TaxTypes';

function computeFinancialYearLabel(startDate: string): string {
  const startYear = parseInt(startDate.substring(0, 4), 10) || 2026;
  const startMonth = parseInt(startDate.substring(5, 7), 10) || 4;
  const fyStart = startMonth >= 4 ? startYear : startYear - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2);
  return `FY ${fyStart}-${fyEnd}`;
}

export class TaxRepository {
  /**
   * Log statutory tax events for compliance audit trail
   */
  static async logTaxAuditEvent(
    workspaceId: string,
    invoiceId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    await (supabase as any).from('tax_audit_logs').insert({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      event_type: eventType,
      payload,
      performed_by: userId || null,
    }).catch(() => {});
  }

  /**
   * Aggregate GSTR-1 Outward Supply Summary for a Workspace & Period
   */
  static async getGSTR1Summary(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<GSTR1Summary> {
    const fyLabel = computeFinancialYearLabel(startDate);

    const { data: allInvoices, error } = await (supabase.from('invoices') as any)
      .select('id, taxable_amount, subtotal, cgst, sgst, igst, cess_amount, supply_type, client_state, client_gstin')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Database error aggregating GSTR-1 summary: ${error.message}`);
    }

    if (!allInvoices || allInvoices.length === 0) {
      return {
        financial_year: fyLabel,
        month_or_quarter: `${startDate} to ${endDate}`,
        total_b2b_invoices: 0,
        total_b2c_invoices: 0,
        total_export_invoices: 0,
        taxable_value: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        cess_amount: 0,
        total_tax: 0,
      };
    }

    let b2bCount = 0;
    let b2cCount = 0;
    let exportCount = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let cess = 0;

    for (const inv of allInvoices) {
      taxable += Number(inv.taxable_amount || inv.subtotal || 0);
      cgst += Number(inv.cgst || 0);
      sgst += Number(inv.sgst || 0);
      igst += Number(inv.igst || 0);
      cess += Number(inv.cess_amount || 0);

      const normState = (inv.client_state || '').trim().toLowerCase();
      if (
        inv.supply_type === 'zero_rated_lut' ||
        inv.supply_type === 'zero_rated_non_lut' ||
        normState === 'export' ||
        normState === 'exports'
      ) {
        exportCount++;
      } else if (inv.client_gstin && inv.client_gstin.trim()) {
        b2bCount++;
      } else {
        b2cCount++;
      }
    }

    return {
      financial_year: fyLabel,
      month_or_quarter: `${startDate} to ${endDate}`,
      total_b2b_invoices: b2bCount,
      total_b2c_invoices: b2cCount,
      total_export_invoices: exportCount,
      taxable_value: Math.round(taxable * 100) / 100,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: Math.round(igst * 100) / 100,
      cess_amount: Math.round(cess * 100) / 100,
      total_tax: Math.round((cgst + sgst + igst + cess) * 100) / 100,
    };
  }
}
