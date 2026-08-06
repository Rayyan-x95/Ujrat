import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input, CurrencyInput, Textarea } from '@/shared/ui/Input';
import { Badge } from '@/shared/ui/Badge';
import { Receipt, PlusCircle, Printer, Copy, MessageSquareShare } from 'lucide-react';
import { COMMON_FREELANCE_SAC_CODES } from '../constants/sacCodes';
import { generateInvoiceWhatsAppUrl } from '@/shared/utils/whatsappShare';

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
  const generateNewInvoiceNo = () => `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const [showGenInvoice, setShowGenInvoice] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(generateNewInvoiceNo());
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
      setInvoiceNo(generateNewInvoiceNo());
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = (inv: any) => {
    setInvoiceNo(generateNewInvoiceNo());
    setInvoiceAmount(String(inv.total || projectBudget || '0'));
    setInvoiceNote(inv.notes || '');
    setShowGenInvoice(true);
  };

  const handleWhatsAppShare = (inv: any) => {
    const portalUrl = `${window.location.origin}/invoices`;
    const url = generateInvoiceWhatsAppUrl({
      invoiceNumber: inv.invoice_number,
      total: inv.total,
      dueDate: inv.due_date,
      portalUrl,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
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
          onClick={() => {
            setInvoiceNo(generateNewInvoiceNo());
            setShowGenInvoice(true);
          }} 
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

          {/* SAC Code Quick Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
              Suggested SAC Code (GST Compliance)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FREELANCE_SAC_CODES.map(sac => (
                <button
                  key={sac.code}
                  type="button"
                  onClick={() => {
                    const memo = `SAC Code: ${sac.code} (${sac.category} - ${sac.description})`;
                    setInvoiceNote(prev => prev ? `${prev}\n${memo}` : memo);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-surface hover:border-primary/40 hover:text-primary transition-colors cursor-pointer text-left"
                >
                  <span className="font-mono font-bold">{sac.code}</span> - {sac.category}
                </button>
              ))}
            </div>
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
              <div className="flex flex-wrap gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleWhatsAppShare(inv)}
                  icon={<MessageSquareShare className="h-3 w-3 text-success" />}
                  title="Share invoice on WhatsApp"
                >
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDuplicate(inv)}
                  icon={<Copy className="h-3 w-3" />}
                  title="Clone invoice specifications"
                >
                  Duplicate
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onShowInvoice(inv.id)} 
                  className="grow text-xs font-semibold"
                  icon={<Printer className="h-3.5 w-3.5" />}
                >
                  View
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