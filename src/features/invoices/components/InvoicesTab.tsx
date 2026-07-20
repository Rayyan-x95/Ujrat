import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input, CurrencyInput, Textarea } from '@/shared/ui/Input';
import { Badge } from '@/shared/ui/Badge';
import { Receipt, PlusCircle, Printer } from 'lucide-react';

interface InvoicesTabProps {
  invoices: any[];
  projectStatus: string;
  projectBudget: number;
  onGenerateInvoice: (invoiceNo: string, amount: number, note: string) => Promise<void>;
  onShowInvoice: (invoiceId: string) => void;
  onConfirmPayment?: (invoiceId: string) => Promise<void>;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  invoices,
  projectStatus,
  projectBudget,
  onGenerateInvoice,
  onShowInvoice,
  onConfirmPayment,
}) => {
  const stableInvoiceNo = useRef(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [showGenInvoice, setShowGenInvoice] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(stableInvoiceNo.current);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    setInvoiceAmount(String(projectBudget || '0'));
  }, [projectBudget]);

  const canIssueInvoice = projectStatus !== 'lead' && projectStatus !== 'proposal';

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      const amt = parseFloat(invoiceAmount) || 0;
      await onGenerateInvoice(invoiceNo, amt, invoiceNote);
      setShowGenInvoice(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async (invoiceId: string) => {
    if (!onConfirmPayment) return;
    try {
      setConfirmingId(invoiceId);
      await onConfirmPayment(invoiceId);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex justify-between items-center border-b border-border-subtle pb-3.5 select-none">
        <div>
          <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5">
            <Receipt className="h-4.5 w-4.5 text-primary" />
            <span>Milestone Invoices</span>
          </h2>
          <p className="text-[11px] text-muted-foreground m-0 mt-0.5">Generate compliant GST split receipts and track active payouts.</p>
        </div>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={() => setShowGenInvoice(true)} 
          disabled={!canIssueInvoice}
          icon={<PlusCircle className="h-3.5 w-3.5" />}
        >
          Generate Invoice
        </Button>
      </div>

      {showGenInvoice && (
        <Card className="p-5.5 space-y-4 border-primary/20">
          <h3 className="text-xs font-bold text-foreground m-0">Invoice Specifications</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Invoice Number Reference" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
            <CurrencyInput label="Milestone Value (INR)" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} />
          </div>
          <Textarea label="Invoice Public Memo / Bank details" placeholder="E.g., Bank: HDFC Bank, A/C: 5010049281, IFSC: HDFC0000123" value={invoiceNote} onChange={e => setInvoiceNote(e.target.value)} />
          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowGenInvoice(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!canIssueInvoice} loading={submitting}>Compute & Create splits</Button>
          </div>
          {!canIssueInvoice && (
            <p className="text-xs text-warning m-0">Invoices can be issued after proposal approval.</p>
          )}
        </Card>
      )}

      {invoices.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-small text-muted-foreground italic bg-surface/10 select-none">
          No invoices generated yet for this project.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {invoices.map(inv => (
            <Card key={inv.id} className="p-5 flex flex-col justify-between hover:border-muted-foreground/20 transition-all">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-small font-bold m-0 font-mono text-primary">{inv.invoice_number}</p>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block select-none">Issued: {inv.invoice_date}</span>
                  </div>
                  <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'pending_verification' ? 'warning' : 'primary'} size="sm">{inv.status}</Badge>
                </div>
                <div className="border-t border-border-subtle pt-3.5 flex justify-between items-baseline select-text">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">Total Value (INR)</span>
                  <span className="text-base font-bold text-foreground font-mono">₹{inv.total?.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onShowInvoice(inv.id)} 
                  className="grow text-xs font-semibold"
                  icon={<Printer className="h-3.5 w-3.5" />}
                >
                  View Invoice
                </Button>
                {inv.status === 'pending_verification' && onConfirmPayment && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => handleConfirmPayment(inv.id)} 
                    loading={confirmingId === inv.id}
                    className="grow text-xs font-semibold"
                  >
                    Confirm Payment
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};