import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { InvoiceStatusBadge, Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Metric } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Dialog } from '@/shared/ui/Dialog';
import { useInvoices } from '@/features/invoices';
import { useWorkspaceSettings } from '@/features/settings';
import { PaymentService } from '@/features/payments/services/PaymentService';
import type { Invoice, InvoiceWithItems } from '@/shared/types';
import { Printer, Check, Link, AlertCircle, Coins, TrendingUp, ShieldCheck, Download, MessageSquareShare, FileSpreadsheet, Briefcase, Copy, Share2, Plus } from 'lucide-react';
import { useProjects } from '@/features/projects';
import { exportGstr1Csv } from '@/shared/utils/csvExport';
import { generateInvoiceWhatsAppUrl } from '@/shared/utils/whatsappShare';
import { formatIndianDate } from '@/shared/utils/date';
import { formatCurrency } from '@/shared/utils/currency';
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects } = useProjects(workspaceId, profileId);
  const { invoices, isLoading, payInvoice } = useInvoices(workspaceId, profileId);
  const { settings } = useWorkspaceSettings(workspaceId, profileId);
  const vpa = settings?.upi_id ?? null;
  const [invoiceToVerify, setInvoiceToVerify] = useState<Invoice | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showTaxReports, setShowTaxReports] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === 'true' || searchParams.get('invoice') === 'true') {
      setShowPicker(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      next.delete('invoice');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handlePickProject = (id: string) => {
    setShowPicker(false);
    navigate(`/projects/${id}?tab=invoices&generate=true`);
  };

  const { totalInvoiced, totalGst, outstanding } = useMemo(() => {
    let invoiced = 0;
    let gst = 0;
    let out = 0;
    for (const inv of invoices) {
      const tot = inv.total || 0;
      invoiced += tot;
      gst += (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
      if (inv.status !== 'paid') {
        out += tot;
      }
    }
    return { totalInvoiced: invoiced, totalGst: gst, outstanding: out };
  }, [invoices]);

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

  const handleWhatsAppShare = (row: InvoiceWithItems) => {
    // Share the zero-auth client portal, never the freelancer's auth-gated
    // /invoices route; without a portal token send the message without a link.
    const portalUrl = row.projects?.portal_token
      ? `${window.location.origin}/portal/${row.projects.portal_token}`
      : undefined;
    const url = generateInvoiceWhatsAppUrl({
      invoiceNumber: row.invoice_number,
      total: row.total,
      dueDate: row.due_date,
      portalUrl,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyUpiId = async () => {
    if (!vpa) {
      addToast('warning', 'UPI ID Missing', 'No UPI ID configured in workspace settings.');
      return;
    }
    try {
      await navigator.clipboard.writeText(vpa);
      addToast('info', 'Copied to Clipboard', 'UPI ID copied.');
    } catch (e) {
      addToast('error', 'Copy Failed', (e as Error).message);
    }
  };

  const handleShareUpi = async (row: InvoiceWithItems) => {
    const generateUpiLink = (PaymentService as unknown as { generateUpiLink?: (p: Record<string, unknown>) => string }).generateUpiLink;
    if (typeof generateUpiLink === 'function' && vpa) {
      try {
        const upiLink = generateUpiLink.call(PaymentService, { invoiceId: row.id, invoiceNumber: row.invoice_number, amount: row.total, payeeVpa: vpa });
        if (typeof navigator?.share === 'function') {
          await navigator.share({ title: `Pay ${row.invoice_number}`, text: `UPI payment for ${row.invoice_number}`, url: upiLink });
          return;
        }
        window.open(upiLink, '_blank', 'noopener,noreferrer');
        return;
      } catch {
        // Fall through to wa.me fallback
      }
    }
    handleWhatsAppShare(row);
  };

  const handleMarkPaid = async (row: InvoiceWithItems) => {
    try {
      await payInvoice(row.id);
      addToast('success', 'Marked as Paid', `Invoice ${row.invoice_number} is now marked as Paid.`);
    } catch (e) {
      addToast('error', 'Mark Paid Failed', (e as Error).message);
    }
  };

  const columns: ColumnDef<InvoiceWithItems>[] = useMemo(() => [
    { 
      key: 'invoice_number', 
      header: 'Invoice #', 
      sortable: true, 
      render: row => <span className="font-mono text-xs text-primary font-semibold">{row.invoice_number}</span> 
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: row => (
        <span className="inline-flex items-center gap-1.5">
          <InvoiceStatusBadge status={row.status} />
          {row.status === 'overdue' && <Badge variant="destructive" size="sm">Overdue</Badge>}
        </span>
      )
    },
    { 
      key: 'invoice_date', 
      header: 'Issue Date', 
      render: row => <span>{formatIndianDate(row.invoice_date)}</span> 
    },
    { 
      key: 'due_date', 
      header: 'Due Date', 
      render: row => <span>{formatIndianDate(row.due_date)}</span> 
    },
    { 
      key: 'total', 
      header: 'Total Value', 
      align: 'right', 
      sortable: true,
      render: row => <span className="font-semibold text-foreground font-mono">{formatCurrency(row.total)}</span>
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
            className="min-h-[44px] min-w-[44px]"
            onClick={() => void handleCopyUpiId()}
            icon={<Copy className="h-3 w-3" />}
            title="Copy UPI ID"
          >
            Copy UPI ID
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="min-h-[44px] min-w-[44px]"
            onClick={() => void handleShareUpi(row)}
            icon={<Share2 className="h-3 w-3" />}
            title="Share payment link"
          >
            Share
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="min-h-[44px] min-w-[44px]"
            onClick={() => handleWhatsAppShare(row)}
            icon={<MessageSquareShare className="h-3 w-3 text-success" />}
            title="Share on WhatsApp"
          >
            WhatsApp
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="min-h-[44px] min-w-[44px]"
            onClick={() => onShowInvoiceDetail(row.id)}
            icon={<Link className="h-3 w-3" />}
          >
            Details
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="min-h-[44px] min-w-[44px]"
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
              className="min-h-[44px] min-w-[44px]"
              onClick={() => void handleMarkPaid(row)}
              icon={<Check className="h-3 w-3" />}
              title="Mark paid"
            >
              Mark paid
            </Button>
          )}
          {row.status === 'pending_verification' && (
            <Button 
              variant="primary" 
              size="sm" 
              className="min-h-[44px] min-w-[44px]"
              onClick={() => setInvoiceToVerify(row)}
              icon={<Check className="h-3 w-3" />}
            >
              Verify
            </Button>
          )}
        </div>
      )
    }
  ], [onShowInvoiceDetail, vpa]);

  return (
    <div className="space-y-6.5 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Invoices"
          description={isLoading ? 'Loading bills...' : `${invoices.length} compliant GST invoice${invoices.length === 1 ? '' : 's'} registered`}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPicker(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Create Invoice
          </Button>
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
          <Metric label="Total Invoiced" value={formatCurrency(totalInvoiced)} hint="Net + GST" />
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-primary bg-primary-muted/20 border border-primary/10 px-2 py-0.5 rounded-full w-max">
            <Coins className="h-3 w-3" />
            <span>Aggregate pipeline</span>
          </div>
        </div>

        <div className="p-4.5 border border-border bg-card rounded-lg shadow-sm flex flex-col justify-between hover:border-muted-foreground/20 transition-all select-none">
          <Metric label="GST Collected" value={formatCurrency(totalGst)} hint="CGST + SGST / IGST split" />
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-success bg-success/5 border border-success/10 px-2 py-0.5 rounded-full w-max">
            <TrendingUp className="h-3 w-3" />
            <span>Tax liability compliance</span>
          </div>
        </div>

        <div className="p-4.5 border border-border bg-card rounded-lg shadow-sm flex flex-col justify-between hover:border-muted-foreground/20 transition-all select-none">
          <Metric label="Outstanding" value={formatCurrency(outstanding)} hint="Awaiting client settlement" />
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
        emptyState={{
          title: "No Invoices Generated Yet",
          description: "Invoices are generated directly from milestone deliverables inside your project workspaces.",
          action: (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate('/projects')} 
              icon={<Briefcase className="h-4 w-4" />}
            >
              View Active Projects
            </Button>
          ),
          tips: [
            "Invoices automatically calculate CGST, SGST, and IGST based on client state.",
            "Each invoice generates a zero-fee dynamic UPI QR code linked to your bank account.",
            "Marking invoices as Paid automatically releases escrowed project deliverables."
          ]
        }}
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
              <span className="font-mono font-bold text-foreground">{invoiceToVerify?.total != null ? formatCurrency(invoiceToVerify.total) : '—'}</span>
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

      {/* Project Picker for 2-click invoice creation */}
      <Dialog
        open={showPicker}
        onClose={() => setShowPicker(false)}
        title="Select a Project to Generate Invoice"
        description="Invoices are generated from a project workspace — pick one to continue."
        size="md"
      >
        <div className="space-y-2 pt-1">
          {projects.length === 0 ? (
            <div className="space-y-3">
              <p className="text-small text-muted-foreground m-0">No projects yet. Create a project first, then generate an invoice from it.</p>
              <Button variant="primary" size="sm" onClick={() => { setShowPicker(false); navigate('/projects'); }}>View Projects</Button>
            </div>
          ) : (
            projects.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePickProject(p.id)}
                className="w-full text-left p-3 border border-border rounded-lg hover:border-primary/40 hover:bg-surface transition-colors cursor-pointer"
              >
                <p className="text-small font-semibold text-foreground m-0">{p.name}</p>
                <p className="text-[11px] text-muted-foreground m-0">{p.clients?.name || 'No client'} • {formatCurrency(p.budget || 0)}</p>
              </button>
            ))
          )}
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
