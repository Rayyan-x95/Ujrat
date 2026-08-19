import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PortalData } from '@/features/portal/services/PortalService';
import { PortalService } from '@/features/portal/services/PortalService';
import { Spinner } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { calculateInvoiceTax } from '@/features/invoices/tax/InvoiceCalculator';
import { TDS_SECTIONS } from '@/features/invoices/tax/TaxTypes';
import { formatCurrency, numberToIndianRupeeWords } from '@/shared/utils/currency';

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

  // Run pure TaxEngine calculation for complete fidelity
  const { breakdown: taxResult, lineItems } = calculateInvoiceTax({
    freelancer: {
      is_gst_registered: settings?.is_gst_registered ?? false,
      gstin: settings?.gstin || invoice.freelancer_gstin,
      state: settings?.state || invoice.freelancer_state,
      tax_scheme: (settings?.tax_scheme as any) || invoice.tax_scheme || 'regular',
      lut_number: settings?.lut_number || invoice.lut_number,
    },
    client: {
      gstin: client?.gstin || invoice.client_gstin,
      state: client?.state || invoice.client_state,
    },
    items: (invoice.invoice_items || []).map((item: any) => ({
      description: item.description,
      quantity: Number(item.quantity || 1),
      rate: Number(item.rate || 0),
      gst_rate: Number(item.gst_rate || 0),
      cess_rate: Number(item.cess_rate || 0),
      hsn_code: item.hsn_code,
      sac_code: item.sac_code,
      unit: item.unit || 'NOS',
      discount_amount: Number(item.discount_amount || 0),
    })),
    invoiceDiscount: {
      type: (invoice.discount_type as any) || 'fixed',
      value: Number(invoice.discount_amount || 0),
      scope: (invoice.discount_scope as any) || 'before_tax',
    },
    tds: {
      section: invoice.tds_section || 'NONE',
      rate: Number(invoice.tds_rate || 0),
    },
    isReverseCharge: Boolean(invoice.is_reverse_charge),
    currency: (invoice.currency as any) || 'INR',
    exchangeRate: Number(invoice.exchange_rate || 1.0),
    lutNumber: invoice.lut_number || settings?.lut_number,
  });

  const currency = taxResult.currency;
  const upiId = settings?.upi_id || '';
  const merchantName = settings?.company_name || 'Freelancer';
  const upiAmount = Number(taxResult.inr_net_receivable !== undefined && taxResult.inr_net_receivable > 0 ? taxResult.inr_net_receivable : taxResult.inr_grand_total || taxResult.net_receivable || taxResult.grand_total);
  const upiParams = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: upiAmount.toFixed(2),
    cu: 'INR',
    tr: invoice.id,
    tn: `Invoice ${invoice.invoice_number}`,
  }).toString();
  const upiUrl = `upi://pay?${upiParams}`;

  const declarations = taxResult.declarations || [];

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
        <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-1">{settings?.company_name || 'Freelancer / Studio'}</h2>
            {settings?.address && <p className="text-neutral-600 whitespace-pre-line">{settings.address}</p>}
            {settings?.phone && <p className="text-neutral-500 mt-0.5">Phone: {settings.phone}</p>}
            {(settings?.gstin || invoice.freelancer_gstin) && (
              <p className="text-neutral-700 font-semibold mt-1">
                GSTIN: <span className="font-mono">{settings?.gstin || invoice.freelancer_gstin}</span>
              </p>
            )}
            {settings?.state && <p className="text-neutral-500">State: {settings.state}</p>}
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

              {taxResult.place_of_supply && (
                <>
                  <span className="font-medium text-neutral-500">Place of Supply:</span>
                  <span className="text-neutral-900 uppercase font-semibold">{taxResult.place_of_supply.replace(/_/g, ' ')}</span>
                </>
              )}

              <span className="font-medium text-neutral-500">Status:</span>
              <span className="uppercase font-bold text-primary">{invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Bill To & Project Reference */}
        <div className="grid grid-cols-2 gap-8 mb-8 border-b border-neutral-100 pb-6">
          <div>
            <h2 className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider mb-2">BILL TO</h2>
            <div className="text-neutral-900 font-bold">{client?.name}</div>
            {client?.company && <div className="text-neutral-700">{client.company}</div>}
            <p className="text-neutral-500 mt-1 max-w-xs whitespace-pre-wrap">{client?.address || ''}</p>
            {client?.phone && <div className="text-neutral-500 mt-0.5">Phone: {client.phone}</div>}
            {(client?.gstin || invoice.client_gstin) && (
              <div className="text-neutral-700 font-semibold mt-1">
                GSTIN: <span className="font-mono">{client?.gstin || invoice.client_gstin}</span>
              </div>
            )}
            {client?.state && <div className="text-neutral-500">State: {client.state}</div>}
          </div>
          <div className="text-right">
            <h2 className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider mb-2">PROJECT REFERENCE</h2>
            <div className="text-neutral-900 font-semibold">{data.project.name}</div>
            <div className="text-neutral-500 mt-1">Currency: {currency}</div>
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
              <th className="py-2 pr-1 text-right">Taxable</th>
              <th className="py-2 pr-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lineItems.map((item, idx) => (
              <tr key={idx} className="text-neutral-900">
                <td className="py-3 pl-1 font-medium">{item.description}</td>
                <td className="py-3 text-center font-mono">{item.sac_code || item.hsn_code || '9983'}</td>
                <td className="py-3 text-right">{item.quantity} {item.unit}</td>
                <td className="py-3 text-right">{formatCurrency(item.rate, currency)}</td>
                <td className="py-3 text-right">{item.gst_rate}%</td>
                <td className="py-3 pr-1 text-right">{formatCurrency(item.taxable_amount, currency)}</td>
                <td className="py-3 pr-1 text-right font-semibold">{formatCurrency(item.line_total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Breakdown & Banking Details */}
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
              <span className="font-semibold text-neutral-900">{formatCurrency(taxResult.subtotal, currency)}</span>
            </div>

            {taxResult.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount ({taxResult.discount_scope === 'before_tax' ? 'Pre-Tax' : 'Post-Tax'}):</span>
                <span>-{formatCurrency(taxResult.discount_amount, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-neutral-700 font-medium">
              <span>Taxable Value:</span>
              <span>{formatCurrency(taxResult.taxable_amount, currency)}</span>
            </div>

            {taxResult.cgst > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>CGST:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(taxResult.cgst, currency)}</span>
              </div>
            )}
            {taxResult.sgst > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>SGST:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(taxResult.sgst, currency)}</span>
              </div>
            )}
            {taxResult.igst > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>IGST:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(taxResult.igst, currency)}</span>
              </div>
            )}
            {taxResult.cess > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>CESS:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(taxResult.cess, currency)}</span>
              </div>
            )}

            {taxResult.round_off !== 0 && (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>Round Off:</span>
                <span className="font-mono">{taxResult.round_off > 0 ? '+' : ''}{taxResult.round_off.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-neutral-200 pt-2 font-bold text-neutral-900 text-sm">
              <span>Grand Total:</span>
              <span>{formatCurrency(taxResult.grand_total, currency)}</span>
            </div>

            {taxResult.tds_amount > 0 && (
              <div className="flex justify-between text-amber-700 text-[11px] pt-1">
                <span>TDS Withheld ({TDS_SECTIONS[taxResult.tds_section || '']?.name || taxResult.tds_section} @ {taxResult.tds_rate}%):</span>
                <span className="font-mono">-{formatCurrency(taxResult.tds_amount, currency)}</span>
              </div>
            )}

            {taxResult.tds_amount > 0 && (
              <div className="flex justify-between border-t border-neutral-200 pt-1.5 font-extrabold text-emerald-700 text-sm">
                <span>Net Receivable:</span>
                <span>{formatCurrency(taxResult.net_receivable, currency)}</span>
              </div>
            )}

            <div className="text-[11px] text-neutral-500 mt-2 italic capitalize">
              Amount in words: {currency === 'INR' ? numberToIndianRupeeWords(taxResult.net_receivable || taxResult.grand_total) : `${currency} ${(taxResult.net_receivable || taxResult.grand_total).toFixed(2)} Only`}
            </div>

            {currency !== 'INR' && (
              <div className="text-[10px] text-neutral-400 mt-1 font-mono">
                Exchange Rate: 1 {currency} = {taxResult.exchange_rate} INR (INR Total: ₹{taxResult.inr_grand_total.toLocaleString('en-IN')})
              </div>
            )}
          </div>
        </div>

        {/* Statutory Declarations Section */}
        {declarations.length > 0 && (
          <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50 text-[10px] text-neutral-700 mb-6 space-y-1">
            <span className="font-bold text-neutral-900 uppercase block tracking-wider mb-1">STATUTORY DECLARATIONS:</span>
            {declarations.map((decl, i) => (
              <p key={i} className="font-mono">• {decl}</p>
            ))}
          </div>
        )}

        {/* Footer Notes & Terms */}
        <div className="border-t border-neutral-200 pt-6 mt-6 text-[10px] text-neutral-500 space-y-2">
          {invoice.notes && (
            <div>
              <span className="font-bold text-neutral-700 uppercase tracking-wider block mb-1">Notes / Terms:</span>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          <div className="text-center pt-4 text-neutral-400">
            Thank you for your business. This is a computer-generated tax invoice.
          </div>
        </div>
      </div>
    </div>
  );
};
