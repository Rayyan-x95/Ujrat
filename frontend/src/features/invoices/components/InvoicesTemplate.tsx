import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { InvoiceStatusBadge, Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Metric } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Dialog } from '@/shared/ui/Dialog';
import { useInvoices } from '@/features/invoices';
import { ProjectService } from '@/features/projects/services/ProjectService';
import { useWorkspaceSettings } from '@/features/settings';
import { PaymentService } from '@/features/payments/services/PaymentService';
import type { Invoice, InvoiceWithItems } from '@/shared/types';
import { Printer, Check, Link, AlertCircle, Coins, TrendingUp, ShieldCheck, Download, MessageSquareShare, FileSpreadsheet, Briefcase, Copy, Share2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Input, Textarea, CurrencyInput } from '@/shared/ui/Input';
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
  const { invoices, isLoading, payInvoice, issueInvoice, editInvoice, removeInvoice, getInvoiceDetails } = useInvoices(workspaceId, profileId);
  const { settings } = useWorkspaceSettings(workspaceId, profileId);
  const vpa = settings?.upi_id ?? null;
  const [invoiceToVerify, setInvoiceToVerify] = useState<Invoice | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showTaxReports, setShowTaxReports] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceWithItems | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<InvoiceWithItems | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<Array<{ id: string; description: string; quantity: string; rate: string; gst_rate: string; hsn_code: string }>>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

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
      if (inv.status === 'draft' || inv.status === 'cancelled') continue;
      const tot = inv.total || 0;
      invoiced += tot;
      if (inv.status === 'paid') {
        gst += (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
      }
      out += inv.outstanding_balance ?? tot;
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

  const handleIssueInvoice = useCallback(async (row: InvoiceWithItems) => {
    try {
      setIssuingId(row.id);
      await issueInvoice(row.id);
      addToast('success', 'Invoice Issued', `${row.invoice_number} is now visible in the client portal.`);
    } catch (e) {
      addToast('error', 'Issue Failed', (e as Error).message);
    } finally {
      setIssuingId(null);
    }
  }, [issueInvoice, addToast]);

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

  const handleWhatsAppShare = async (row: InvoiceWithItems) => {
    // Share the zero-auth client portal, never the freelancer's auth-gated
    // /invoices route. Tokens are hashed at rest, so mint a fresh link for
    // the share (issue-and-copy; the previous link keeps a 30-day grace window).
    let portalUrl: string | undefined;
    try {
      const tokenRes = await ProjectService.regeneratePortalToken(workspaceId, row.project_id);
      if (tokenRes.success && tokenRes.data) {
        portalUrl = `${window.location.origin}/portal/${tokenRes.data}`;
      }
    } catch {
      // Without a link, the message still sends (invoice details only).
    }
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

  const handleMarkPaid = useCallback(async (row: InvoiceWithItems) => {
    try {
      await payInvoice(row.id);
      addToast('success', 'Marked as Paid', `Invoice ${row.invoice_number} is now marked as Paid.`);
    } catch (e) {
      addToast('error', 'Mark Paid Failed', (e as Error).message);
    }
  }, [payInvoice, addToast]);

  const startEditInvoice = useCallback(async (row: InvoiceWithItems) => {
    try {
      setEditLoading(true);
      const detail = await getInvoiceDetails(row.id);
      if (!detail) throw new Error('Invoice not found');
      setInvoiceToEdit(detail);
      setEditDate(detail.invoice_date || '');
      setEditDue(detail.due_date || '');
      setEditNotes(detail.notes || '');
      setEditItems(
        (detail.invoice_items || []).map(item => ({
          id: item.id || crypto.randomUUID(),
          description: item.description || '',
          quantity: String(item.quantity ?? 1),
          rate: String(item.rate ?? 0),
          gst_rate: String(item.gst_rate ?? 18),
          hsn_code: item.hsn_code || '',
        }))
      );
    } catch (e) {
      addToast('error', 'Edit Failed', (e as Error).message);
    } finally {
      setEditLoading(false);
    }
  }, [getInvoiceDetails, addToast]);

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      setDeleting(true);
      await removeInvoice(invoiceToDelete.id);
      addToast('info', 'Invoice Deleted', `Invoice ${invoiceToDelete.invoice_number} has been deleted.`);
      setInvoiceToDelete(null);
    } catch (e) {
      addToast('error', 'Delete Failed', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const saveEditedInvoice = async () => {
    if (!invoiceToEdit || !editDate || !editDue) return;
    const items = editItems
      .filter(l => l.description.trim())
      .map(l => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity) || 0,
        rate: parseFloat(l.rate) || 0,
        gst_rate: parseFloat(l.gst_rate) || 0,
        hsn_code: l.hsn_code.trim() || null,
      }));
    if (items.length === 0) {
      addToast('warning', 'Validation Warning', 'At least one line item with a description is required.');
      return;
    }
    try {
      setEditSubmitting(true);
      await editInvoice({
        invoiceId: invoiceToEdit.id,
        invoice_date: editDate,
        due_date: editDue,
        notes: editNotes || null,
        items,
      });
      addToast('success', 'Invoice Updated', `Invoice ${invoiceToEdit.invoice_number} has been recalculated.`);
      setInvoiceToEdit(null);
    } catch (e) {
      addToast('error', 'Update Failed', (e as Error).message);
    } finally {
      setEditSubmitting(false);
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
          {row.status === 'draft' && (
            <>
              <Button
                variant="primary"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => void handleIssueInvoice(row)}
                loading={issuingId === row.id}
                icon={<Check className="h-3 w-3" />}
                title="Issue to client (makes it visible and payable in the portal)"
              >
                Issue
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => void startEditInvoice(row)}
                loading={editLoading}
                icon={<Pencil className="h-3 w-3" />}
                title="Edit draft invoice"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setInvoiceToDelete(row)}
                icon={<Trash2 className="h-3 w-3" />}
                title="Delete draft invoice"
              >
                Delete
              </Button>
            </>
          )}
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
  ], [onShowInvoiceDetail, vpa, editLoading, issuingId, startEditInvoice, handleIssueInvoice, handleMarkPaid]);

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

      {/* Confirmation Dialog for Deleting a Draft Invoice */}
      <Dialog
        open={!!invoiceToDelete}
        onClose={() => setInvoiceToDelete(null)}
        title="Delete Draft Invoice"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-small text-muted-foreground leading-relaxed">
            Delete draft invoice <strong className="text-foreground font-mono">{invoiceToDelete?.invoice_number}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setInvoiceToDelete(null)} type="button">
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteInvoice} loading={deleting}>
              Delete Invoice
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Draft Invoice Dialog */}
      <Dialog
        open={!!invoiceToEdit}
        onClose={() => setInvoiceToEdit(null)}
        title={`Edit Invoice ${invoiceToEdit?.invoice_number ?? ''}`}
        description="Draft only — totals are recalculated with the GST engine on save."
        size="lg"
      >
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Issue Date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
            <Input label="Due Date" type="date" value={editDue} onChange={e => setEditDue(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <span className="block text-[11px] font-semibold text-muted-foreground">Line Items</span>
            {editItems.map((line, idx) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-4">
                  <Input label={idx === 0 ? 'Description' : ''} placeholder="Service description" value={line.description} onChange={e => setEditItems(editItems.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input label={idx === 0 ? 'Qty' : ''} type="number" min="0" value={line.quantity} onChange={e => setEditItems(editItems.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} />
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <CurrencyInput label={idx === 0 ? 'Rate (INR)' : ''} value={line.rate} onChange={e => setEditItems(editItems.map((l, i) => i === idx ? { ...l, rate: e.target.value } : l))} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input label={idx === 0 ? 'GST %' : ''} type="number" min="0" value={line.gst_rate} onChange={e => setEditItems(editItems.map((l, i) => i === idx ? { ...l, gst_rate: e.target.value } : l))} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))} icon={<X className="h-3.5 w-3.5" />} title="Remove line" />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setEditItems([...editItems, { id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', gst_rate: '18', hsn_code: '' }])} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Line
            </Button>
          </div>

          <Textarea label="Notes" placeholder="Invoice notes / bank details" value={editNotes} onChange={e => setEditNotes(e.target.value)} />

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setInvoiceToEdit(null)} type="button">Cancel</Button>
            <Button variant="primary" size="sm" onClick={saveEditedInvoice} loading={editSubmitting} disabled={!editDate || !editDue}>
              Save & Recalculate
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
