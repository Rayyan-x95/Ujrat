import React from 'react';
import { InvoiceStatusBadge } from '@/shared/ui/Badge';
import { formatCurrency } from '@/shared/utils/currency';
import { formatIndianDate } from '@/shared/utils/date';
import type { Invoice } from '@/shared/types';

type FollowUpInvoice = Pick<Invoice, 'invoice_number' | 'total' | 'outstanding_balance'> & { status: string };

export const isFollowUpPayable = (status: string): boolean =>
  status === 'overdue' || status === 'partially_paid';

/** Follow-up `upi://pay` link for overdue/partially_paid invoices; null when VPA/amount missing (CTA hidden). */
export const buildFollowUpUpiLink = (
  invoice: FollowUpInvoice,
  payeeVpa?: string | null,
  payeeName?: string | null,
): string | null => {
  if (!isFollowUpPayable(invoice.status)) return null;
  const vpa = (payeeVpa || '').trim();
  const amount = Number(invoice.outstanding_balance ?? invoice.total);
  if (!vpa.includes('@') || !Number.isFinite(amount) || amount <= 0) return null;
  const params: Record<string, string> = {
    pa: vpa,
    pn: (payeeName || 'Freelancer').trim(),
    am: amount.toFixed(2),
    cu: 'INR',
    tr: invoice.invoice_number,
    tn: `Invoice ${invoice.invoice_number}`,
  };
  return `upi://pay?${Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
};

interface PortalInvoiceTableProps {
  invoices: Invoice[];
  upiId: string | null | undefined;
  payeeName: string | null | undefined;
  selectedId: string | null | undefined;
  onSelect: (invoice: Invoice) => void;
}

/** Invoice rows: number, due date, status badge, amount + "Pay via UPI" follow-up CTA (overdue/partially_paid only). */
export const PortalInvoiceTable: React.FC<PortalInvoiceTableProps> = ({
  invoices,
  upiId,
  payeeName,
  selectedId,
  onSelect,
}) => (
  <div className="space-y-2">
    {invoices.map(inv => {
      const upiLink = buildFollowUpUpiLink(inv, upiId, payeeName);
      return (
        <div
          key={inv.id}
          onClick={() => onSelect(inv)}
          className={`flex justify-between items-center p-3 border rounded-lg cursor-pointer transition-colors ${
            selectedId === inv.id
              ? 'border-primary bg-primary-muted/20'
              : 'border-border bg-card hover:bg-surface/30'
          }`}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary font-mono m-0">{inv.invoice_number}</p>
            <p className="text-[10px] text-muted-foreground m-0 select-none">Due date: {formatIndianDate(inv.due_date)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground font-mono">{formatCurrency(inv.total)}</span>
            <InvoiceStatusBadge status={inv.status} />
            {upiLink && (
              <a
                href={upiLink}
                onClick={e => e.stopPropagation()}
                className="text-xs font-semibold text-primary underline"
              >
                Pay via UPI
              </a>
            )}
          </div>
        </div>
      );
    })}
  </div>
);
