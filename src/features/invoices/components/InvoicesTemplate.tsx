import React from 'react';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { InvoiceStatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Metric } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useInvoices } from '@/features/invoices';
import type { Invoice } from '@/shared/types';
import { Printer, Check, Link, AlertCircle, Coins, TrendingUp } from 'lucide-react';

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

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0), 0);
  const outstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const handleVerifyPayment = async (invoiceId: string) => {
    try {
      await payInvoice(invoiceId);
      addToast('success', 'Payment Verified Successfully', `Invoice updated to Paid status.`);
    } catch (e) {
      addToast('error', 'Verification Failed', (e as Error).message);
    }
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
            onClick={() => onShowInvoiceDetail(row.id)}
            icon={<Link className="h-3 w-3" />}
          >
            Portal
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const token = (row as any).projects?.portal_token;
              if (token) {
                window.open(`/portal/${token}/invoice/${row.id}/print`, '_blank');
              }
            }}
            icon={<Printer className="h-3 w-3" />}
          >
            Print
          </Button>
          {row.status !== 'paid' && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => handleVerifyPayment(row.id)}
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
      <PageHeader
        title="Invoices"
        description={isLoading ? 'Loading bills...' : `${invoices.length} compliant GST invoice${invoices.length === 1 ? '' : 's'} registered`}
      />

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
    </div>
  );
};
export default InvoicesTemplate;
