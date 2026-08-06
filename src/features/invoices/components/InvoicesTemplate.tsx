import React, { useState } from 'react';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { InvoiceStatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Metric } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Dialog } from '@/shared/ui/Dialog';
import { useInvoices } from '@/features/invoices';
import type { Invoice } from '@/shared/types';
import { Printer, Check, Link, AlertCircle, Coins, TrendingUp, ShieldCheck, Download, MessageSquareShare, FileSpreadsheet } from 'lucide-react';
import { exportGstr1Csv } from '@/shared/utils/csvExport';
import { generateInvoiceWhatsAppUrl } from '@/shared/utils/whatsappShare';
import { TaxReportsModal } from './TaxReportsModal';

interface InvoicesTemplateProps {
  workspaceId: string;
  profileId: string;
  onShowInvoiceDetail: (invoiceId: string) => void;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const InvoicesTemplate: React.FC<InvoicesTemplateProps> = ({
  workspaceId,
  profileId,
  onShowInvoiceDetail,
  addToast,
}) => {
  const { invoices, isLoading, payInvoice } = useInvoices(workspaceId, profileId);
  const [invoiceToVerify, setInvoiceToVerify] = useState<Invoice | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showTaxReports, setShowTaxReports] = useState(false);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0), 0);
  const outstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const confirmVerification = async () => {
    if (!invoiceToVerify) return;
    try {
      setVerifying(true);
      await payInvoice(invoiceToVerify.id);
      addToast('success', 'Payment Verified', `Invoice ${invoiceToVerify.invoice_number} is now marked as Paid.`);
      setInvoiceToVerify(null);
    } catch (e) {
      addToast('error', 'Verification Failed', (e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const handleExportCsv = () => {
    if (invoices.length === 0) {
      addToast('warning', 'No Invoices', 'There are no invoices available to export.');
      return;
    }
    try {
      exportGstr1Csv(invoices);
      addToast('success', 'GSTR-1 Export Generated', `Exported ${invoices.length} invoices to CSV.`);
    } catch (err: any) {
      addToast('error', 'Export Failed', err.message);
    }
  };

  const handleWhatsAppShare = (row: Invoice) => {
    const portalUrl = `${window.location.origin}/invoices`;
    const url = generateInvoiceWhatsAppUrl({
      invoiceNumber: row.invoice_number,
      total: row.total,
      dueDate: row.due_date,
      portalUrl,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const columns: ColumnDef<Invoice>[] = [
    { 
      key: 'invoice_number', 
      header: 'Invoice #', 
      sortable: true, 
      render: row => <span className="font-mono text-xs text-primary font-semibold">{row.invoice_number}</span> 
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: row => <InvoiceStatusBadge status={row.status} /> 
    },
    { 
      key: 'invoice_date', 
      header: 'Issue Date', 
      render: row => <span>{new Date(row.invoice_date).toLocaleDateString('en-IN')}</span> 
    },
    { 
      key: 'due_date', 
      header: 'Due Date', 
      render: row => <span>{new Date(row.due_date).toLocaleDateString('en-IN')}</span> 
    },
    { 
      key: 'total', 
      header: 'Total Value', 
      align: 'right', 
      sortable: true,
      render: row => <span className="font-semibold text-foreground font-mono">₹{row.total.toLocaleString('en-IN')}</span>
    },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: row => (
        <div className="flex gap-1.5 justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleWhatsAppShare(row)}
            icon={<MessageSquareShare className="h-3 w-3 text-success" />}
            title="Share on WhatsApp"
          >
            WhatsApp
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onShowInvoiceDetail(row.id)}
            icon={<Link className="h-3 w-3" />}
          >
            Details
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              window.print();
            }}
            icon={<Printer className="h-3 w-3" />}
          >
            Print
          </Button>
          {row.status !== 'paid' && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setInvoiceToVerify(row)}
              icon={<Check className="h-3 w-3" />}
            >
              Verify
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6.5 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Invoices"
          description={isLoading ? 'Loading bills...' : `${invoices.length} compliant GST invoice${invoices.length === 1 ? '' : 's'} registered`}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTaxReports(true)}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            GST Tax Report
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download className="h-4 w-4" />}
          >
            Export GSTR-1 (CSV)
          </Button>
        </div>
      </div>

      {/* Stripe-style metrics summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4.5 border border-border bg-card rounded-lg shadow-sm flex flex-col justify-between hover:border-muted-foreground/20 transition-all select-none">
          <Metric label="Total Invoiced" value={`₹${totalInvoiced.toLocaleString('en-IN')}`} hint="Net + GST" />
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-primary bg-primary-muted/20 border border-primary/10 px-2 py-0.5 rounded-full w-max">
            <Coins className="h-3 w-3" />
            <span>Aggregate pipeline</span>
          </div>
        </div>

        <div className="p-4.5 border border-border bg-card rounded-lg shadow-sm flex flex-col justify-between hover:border-muted-foreground/20 transition-all select-none">
          <Metric label="GST Collected" value={`₹${totalGst.toLocaleString('en-IN')}`} hint="CGST + SGST / IGST split" />
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-success bg-success/5 border border-success/10 px-2 py-0.5 rounded-full w-max">
            <TrendingUp className="h-3 w-3" />
            <span>Tax liability compliance</span>
          </div>
        </div>

        <div className="p-4.5 border border-border bg-card rounded-lg shadow-sm flex flex-col justify-between hover:border-muted-foreground/20 transition-all select-none">
          <Metric label="Outstanding" value={`₹${outstanding.toLocaleString('en-IN')}`} hint="Awaiting client settlement" />
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-warning bg-warning/5 border border-warning/10 px-2 py-0.5 rounded-full w-max">
            <AlertCircle className="h-3 w-3" />
            <span>Unpaid balance</span>
          </div>
        </div>
      </div>

      <Table<Invoice>
        columns={columns}
        data={invoices}
        keyField="id"
        searchable
        searchPlaceholder="Search invoices by invoice code..."
        emptyMessage="No invoices generated"
        emptySubMessage="Issue milestone billing coordinates and tax splits from individual project detail workspaces."
        loading={isLoading}
      />

      {/* Confirmation Dialog for Verifying Invoice Settlement */}
      <Dialog
        open={!!invoiceToVerify}
        onClose={() => setInvoiceToVerify(null)}
        title="Confirm Payment Settlement"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 border border-border bg-surface rounded-lg space-y-1.5 text-small">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Invoice Number:</span>
              <span className="font-mono font-semibold text-primary">{invoiceToVerify?.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-mono font-bold text-foreground">₹{invoiceToVerify?.total?.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <p className="text-small text-muted-foreground leading-relaxed">
            Marking this invoice as Paid will update revenue metrics and unlock any escrowed project deliverables for the client.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setInvoiceToVerify(null)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmVerification} loading={verifying} icon={<ShieldCheck className="h-4 w-4" />}>
              Confirm & Mark Paid
            </Button>
          </div>
        </div>
      </Dialog>

      {/* GSTR-1 & Tax Reports Interactive Breakdown Modal */}
      <TaxReportsModal
        isOpen={showTaxReports}
        onClose={() => setShowTaxReports(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
};
export default InvoicesTemplate;
