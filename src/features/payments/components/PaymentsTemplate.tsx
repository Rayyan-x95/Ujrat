import React, { useState } from 'react';
import { usePayments } from '@/features/payments';
import { useConfirmPayment } from '@/features/payments';
import { PageHeader } from '@/shared/ui/PageHeader';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface PaymentsTemplateProps {
  workspaceId: string;
  profileId: string;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const PaymentsTemplate: React.FC<PaymentsTemplateProps> = ({
  workspaceId,
  profileId,
  addToast,
}) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  const { paymentsResult, isLoading } = usePayments(workspaceId, {
    page,
    search,
    filter: {
      status: statusFilter !== 'all' ? statusFilter : undefined,
    },
  });

  const confirmPaymentMutation = useConfirmPayment(workspaceId, profileId, { addToast });

  const data = paymentsResult
    ? {
        list: paymentsResult.data,
        total: paymentsResult.total,
        totalPages: paymentsResult.totalPages,
      }
    : null;

  const columns: ColumnDef<any>[] = [
    {
      key: 'invoice',
      header: 'Invoice Code',
      render: row => (
        <div className="py-0.5">
          <p className="text-xs font-mono text-primary font-semibold m-0">
            {row.invoices?.invoice_number || '—'}
          </p>
          <p className="text-[10px] text-muted-foreground m-0 mt-0.5">
            Invoice Total: ₹{row.invoices?.total?.toLocaleString('en-IN') || '0'}
          </p>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Transaction Reference (UTR)',
      render: row => (
        <span className="font-mono text-xs text-foreground font-medium select-text">
          {row.transaction_reference || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Payment Value',
      render: row => (
        <span className="font-semibold text-foreground font-mono">
          ₹{row.amount?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Submitted Date',
      render: row => (
        <span className="text-muted-foreground">
          {new Date(row.payment_date).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Reconciliation',
      align: 'center',
      render: row => (
        <Badge variant={row.status === 'completed' ? 'success' : row.status === 'failed' ? 'destructive' : 'warning'} dot size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: row => (
        row.status === 'pending' ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => confirmPaymentMutation.mutate(row.invoice_id)}
            loading={confirmPaymentMutation.isPending}
            icon={<Check className="h-3 w-3" />}
          >
            Confirm
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground italic select-none">Confirmed</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6.5 animate-slide-up">
      <PageHeader
        title="Payments Ledger"
        description="Verify and audit client transaction UTR codes to confirm invoice settlement."
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-border-subtle pb-4">
        {/* Status Filter Tab row */}
        <div className="flex gap-1 p-1 bg-surface rounded-lg select-none border border-border/30">
          {(['all', 'pending', 'completed', 'failed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); setPage(1); }}
              className={`rounded px-3 py-1 text-[11px] font-semibold transition-colors uppercase cursor-pointer ${
                statusFilter === tab 
                  ? 'bg-primary-muted text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Search input field */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search UTR reference..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="h-8.5 w-full rounded-md bg-background border border-border pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 text-foreground transition-all shadow-sm"
          />
        </div>
      </div>

      <Table<any>
        columns={columns}
        data={data?.list || []}
        keyField="id"
        loading={isLoading}
        emptyMessage="No payments registered"
        emptySubMessage="Payment references submitted by clients on their secure portal will appear here."
      />

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 border-t border-border-subtle select-none">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
            icon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
            Page {page} of {data.totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} 
            disabled={page === data.totalPages}
            icon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default PaymentsTemplate;
