import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PortalData } from '@/features/portal/services/PortalService';
import { PortalService } from '@/features/portal/services/PortalService';
import { formatINR, numberToIndianWords } from '@/shared/utils/currency';
import { Spinner } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/Button';
import { QRCodeSVG } from 'qrcode.react';

export const InvoicePrintView: React.FC = () => {
  const { portalToken, invoiceId } = useParams<{ portalToken: string; invoiceId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    if (!portalToken) return;
    PortalService.getPortalData(portalToken).then(res => {
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error.message || 'Failed to load invoice details');
      }
      setLoading(false);
    });
  }, [portalToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-xs text-muted-foreground mt-4">Loading Invoice for print...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-destructive font-bold">Error loading invoice</p>
        <p className="text-xs text-muted-foreground mt-2">{error || 'Invoice not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const invoice = data.invoices.find(inv => inv.id === invoiceId);
  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-destructive font-bold">Invoice Not Found</p>
        <p className="text-xs text-muted-foreground mt-2">The requested invoice could not be located in this project.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const settings = data.settings;
  const client = data.client;

  const upiId = settings?.upi_id || '';
  const merchantName = settings?.company_name || 'Freelancer';
  const amount = Number(invoice.total);
  const note = `Invoice ${invoice.invoice_number}`;
  const upiParams = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: amount.toFixed(2),
    cu: 'INR',
    tr: invoice.id,
    tn: note,
  }).toString();

  const upiUrl = `upi://pay?${upiParams}`;

  const roundedTotal = Math.round(invoice.total);
  const roundingDiff = roundedTotal - invoice.total;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4 print:bg-white print:p-0 print:min-h-0">
      {/* Print Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl ring-1 ring-inset ring-neutral-200 shadow-sm">
        <Button variant="outline" onClick={() => navigate(-1)}>
          ← Back to Portal
        </Button>
        <Button variant="primary" onClick={handlePrint}>
          Print / Save PDF
        </Button>
      </div>

      {/* A4 Invoice Card */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white p-[15mm] shadow-md print:shadow-none print:p-0 print:w-full print:min-h-0 text-[12px] leading-relaxed text-neutral-800 font-sans">
        {/* Header Section */}
        <div className="flex justify-between items-start border-b border-neutral-200 pb-6 mb-6">
          <div>
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-12 w-auto mb-3 object-contain" />
            ) : (
              <div className="text-lg font-bold text-neutral-900 tracking-tight mb-1">{settings?.company_name || 'Freelancer'}</div>
            )}
            <p className="text-neutral-500 max-w-xs whitespace-pre-wrap">{settings?.address || ''}</p>
            {settings?.phone && <p className="text-neutral-500 mt-0.5">Phone: {settings.phone}</p>}
            {settings?.gstin && (
              <p className="text-neutral-700 font-semibold mt-1">
                GSTIN: <span className="font-mono">{settings.gstin}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold uppercase tracking-wide text-neutral-900 mb-2">TAX INVOICE</h1>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-neutral-600 text-right justify-end ml-auto">
              <span className="font-medium text-neutral-500">Invoice No:</span>
              <span className="font-mono font-semibold text-neutral-900">{invoice.invoice_number}</span>
              
              <span className="font-medium text-neutral-500">Invoice Date:</span>
              <span className="text-neutral-900">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</span>
              
              <span className="font-medium text-neutral-500">Due Date:</span>
              <span className="text-neutral-900">{new Date(invoice.due_date).toLocaleDateString('en-IN')}</span>

              {invoice.year && (
                <>
                  <span className="font-medium text-neutral-500">Financial Year:</span>
                  <span className="text-neutral-900 font-mono">FY{invoice.year}</span>
                </>
              )}
              
              <span className="font-medium text-neutral-500">Status:</span>
              <span className="uppercase font-bold text-primary">{invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Bill To & Details */}
        <div className="grid grid-cols-2 gap-8 mb-8 border-b border-neutral-100 pb-6">
          <div>
            <h2 className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider mb-2">BILL TO</h2>
            <div className="text-neutral-900 font-bold">{client?.name}</div>
            {client?.company && <div className="text-neutral-700">{client.company}</div>}
            <p className="text-neutral-500 mt-1 max-w-xs whitespace-pre-wrap">{client?.address || ''}</p>
            {client?.phone && <div className="text-neutral-500 mt-0.5">Phone: {client.phone}</div>}
            {client?.gstin && (
              <div className="text-neutral-700 font-semibold mt-1">
                GSTIN: <span className="font-mono">{client.gstin}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider mb-2">PROJECT REFERENCE</h2>
            <div className="text-neutral-900 font-semibold">{data.project.name}</div>
            <div className="text-neutral-500 mt-1">Budget: {formatINR(data.project.budget)}</div>
          </div>
        </div>

        {/* Item Table */}
        <table className="w-full mb-8 text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-200 text-neutral-500 text-[10px] uppercase font-bold tracking-wider">
              <th className="py-2 pl-1">Description</th>
              <th className="py-2 text-center">HSN/SAC</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">GST %</th>
              <th className="py-2 pr-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {invoice.invoice_items?.map((item: any) => (
              <tr key={item.id} className="text-neutral-900">
                <td className="py-3 pl-1 font-medium">{item.description}</td>
                <td className="py-3 text-center font-mono">{item.hsn_code || '9983'}</td>
                <td className="py-3 text-right">{Number(item.quantity).toFixed(1)}</td>
                <td className="py-3 text-right">{formatINR(item.rate)}</td>
                <td className="py-3 text-right">{item.gst_rate}%</td>
                <td className="py-3 pr-1 text-right font-semibold">{formatINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Breakdown & UPI Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* UPI and Banking Details */}
          <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50 flex gap-4 print:border-neutral-200">
            {settings?.upi_id && (
              <div className="shrink-0 flex flex-col items-center gap-1.5">
                <div className="h-28 w-28 bg-white border border-neutral-200 p-1.5 rounded-lg flex items-center justify-center">
                  <QRCodeSVG value={upiUrl} size={96} className="h-full w-full object-contain" />
                </div>
                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Scan & Pay via UPI</span>
              </div>
            )}
            <div className="space-y-2 text-neutral-600">
              <h3 className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider mb-1">BANKING DETAILS</h3>
              {settings?.bank_name && (
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="text-neutral-400">Bank:</span>
                  <span className="col-span-2 font-medium text-neutral-900">{settings.bank_name}</span>
                  <span className="text-neutral-400">A/C No:</span>
                  <span className="col-span-2 font-mono font-medium text-neutral-900">{settings.bank_account_no}</span>
                  <span className="text-neutral-400">IFSC:</span>
                  <span className="col-span-2 font-mono font-medium text-neutral-900">{settings.bank_ifsc}</span>
                  {settings.upi_id && (
                    <>
                      <span className="text-neutral-400">UPI ID:</span>
                      <span className="col-span-2 font-mono font-medium text-neutral-900">{settings.upi_id}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Math Calculations */}
          <div className="text-right space-y-1.5 text-neutral-600">
            <div className="flex justify-between">
              <span className="text-neutral-500">Subtotal:</span>
              <span className="font-semibold text-neutral-900">{formatINR(invoice.subtotal)}</span>
            </div>

            {Number(invoice.cgst) > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>CGST:</span>
                <span className="font-semibold text-neutral-900">{formatINR(invoice.cgst)}</span>
              </div>
            )}
            {Number(invoice.sgst) > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>SGST:</span>
                <span className="font-semibold text-neutral-900">{formatINR(invoice.sgst)}</span>
              </div>
            )}
            {Number(invoice.igst) > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>IGST:</span>
                <span className="font-semibold text-neutral-900">{formatINR(invoice.igst)}</span>
              </div>
            )}

            {roundingDiff !== 0 && (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>Rounding:</span>
                <span className="font-mono">{roundingDiff > 0 ? '+' : ''}{roundingDiff.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-neutral-200 pt-2 font-bold text-neutral-900 text-sm">
              <span>Grand Total:</span>
              <span>{formatINR(roundedTotal)}</span>
            </div>

            <div className="text-[11px] text-neutral-500 mt-2 italic capitalize">
              Amount in words: {numberToIndianWords(roundedTotal)}
            </div>

            {invoice.outstanding_balance !== undefined && (
              <div className="flex justify-between border-t border-neutral-100 pt-2 font-bold text-primary text-xs">
                <span>Outstanding Balance:</span>
                <span>{formatINR(invoice.outstanding_balance)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notes & Terms */}
        <div className="border-t border-neutral-200 pt-6 mt-12 text-[10px] text-neutral-500 space-y-2">
          {invoice.notes && (
            <div>
              <span className="font-bold text-neutral-700 uppercase tracking-wider block mb-1">Notes / Terms:</span>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          <div className="text-center pt-6 text-neutral-400">
            Thank you for your business. This is a computer-generated document. No signature is required.
          </div>
        </div>
      </div>
    </div>
  );
};
