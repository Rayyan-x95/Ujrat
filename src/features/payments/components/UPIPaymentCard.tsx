import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { UPIPaymentProvider } from '../providers/UPIPaymentProvider';
import { SUPPORTED_UPI_APPS } from '../constants/PaymentConstants';
import { PaymentVerificationService } from '../services/PaymentVerificationService';
import { formatCurrencyAmount } from '@/features/invoices/utils/TaxEngine';

interface UPIPaymentCardProps {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  payeeVpa: string;
  payeeName: string;
  onPaymentSubmitted?: () => void;
  addToast?: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const UPIPaymentCard: React.FC<UPIPaymentCardProps> = ({
  workspaceId,
  invoiceId,
  invoiceNumber,
  amount,
  currency = 'INR',
  payeeVpa,
  payeeName,
  onPaymentSubmitted,
  addToast,
}) => {
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const provider = useMemo(() => new UPIPaymentProvider(), []);
  const deepLinkUri = useMemo(() => {
    return provider.generateDeepLink({
      workspaceId,
      invoiceId,
      invoiceNumber,
      amount,
      currency,
      payeeVpa,
      payeeName,
    });
  }, [workspaceId, invoiceId, invoiceNumber, amount, currency, payeeVpa, payeeName, provider]);

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
        if (addToast) {
          addToast('info', 'Copied to Clipboard', `${fieldName} copied.`);
        }
      } else {
        if (addToast) addToast('warning', 'Clipboard Unavailable', 'Please copy manually.');
      }
    } catch (err: any) {
      if (addToast) addToast('error', 'Copy Failed', err.message || 'Clipboard permission denied.');
    }
  };

  const handleLaunchApp = (schemePrefix?: string) => {
    let targetLink = deepLinkUri;
    if (schemePrefix) {
      targetLink = provider.generateAppSpecificDeepLink(
        { workspaceId, invoiceId, invoiceNumber, amount, currency, payeeVpa, payeeName },
        schemePrefix
      );
    }
    window.location.href = targetLink;
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();

    const utrVal = PaymentVerificationService.validateUTR(utrNumber);
    if (!utrVal.isValid) {
      if (addToast) addToast('warning', 'Invalid UTR Number', utrVal.error);
      return;
    }

    if (screenshotUrl.trim()) {
      try {
        const parsed = new URL(screenshotUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          if (addToast) addToast('warning', 'Invalid Screenshot URL', 'Please provide a valid HTTP/HTTPS URL.');
          return;
        }
      } catch {
        if (addToast) addToast('warning', 'Invalid Screenshot URL', 'Please provide a valid HTTP/HTTPS URL.');
        return;
      }
    }

    setSubmitting(true);
    const res = await PaymentVerificationService.submitClientPaymentAttempt(workspaceId, {
      invoiceId,
      utrNumber: utrNumber.trim(),
      amount,
      screenshotUrl: screenshotUrl.trim() || null,
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (res.success) {
      if (addToast) addToast('success', 'Payment Submitted', res.data.message);
      if (onPaymentSubmitted) onPaymentSubmitted();
    } else {
      if (addToast) addToast('error', 'Submission Failed', res.error.message);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Direct UPI Payment</span>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Pay via Any UPI Application</h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-neutral-400 block uppercase">AMOUNT DUE</span>
          <span className="text-xl font-extrabold text-neutral-900 dark:text-white">{formatCurrencyAmount(amount, currency as any)}</span>
        </div>
      </div>

      {/* Mobile Primary Action Button */}
      <div className="block md:hidden space-y-3">
        <Button
          variant="primary"
          className="w-full py-3.5 text-base font-bold shadow-lg shadow-primary/20"
          onClick={() => handleLaunchApp()}
        >
          ⚡ Pay Now via UPI App
        </Button>

        {/* Quick App Selectors */}
        <div className="grid grid-cols-3 gap-2">
          {SUPPORTED_UPI_APPS.slice(0, 6).map(app => (
            <button
              key={app.id}
              onClick={() => handleLaunchApp(app.schemePrefix)}
              className="px-2 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:border-primary transition-all text-center"
            >
              {app.name}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop View: Interactive QR & Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* QR Code Frame */}
        <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
          <div className="h-44 w-44 bg-white p-2.5 rounded-xl shadow-md border border-neutral-200 flex items-center justify-center">
            <QRCodeSVG value={deepLinkUri} size={156} className="h-full w-full object-contain" />
          </div>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Scan with Google Pay, PhonePe, Paytm, BHIM</span>
        </div>

        {/* Copy Details Table */}
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl space-y-1.5 border border-neutral-200 dark:border-neutral-800">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Payee UPI VPA:</span>
              <button
                onClick={() => handleCopy(payeeVpa, 'UPI VPA')}
                className="text-primary hover:underline font-bold"
              >
                {copiedField === 'UPI VPA' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="font-mono font-bold text-neutral-900 dark:text-white text-sm truncate">{payeeVpa}</div>
          </div>

          <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl space-y-1.5 border border-neutral-200 dark:border-neutral-800">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Payee Name:</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{payeeName}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-400 font-medium">Invoice Reference:</span>
              <button
                onClick={() => handleCopy(invoiceNumber, 'Invoice Ref')}
                className="text-primary hover:underline font-bold"
              >
                {copiedField === 'Invoice Ref' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-neutral-800 dark:text-neutral-200">{invoiceNumber}</div>
          </div>
        </div>
      </div>

      {/* Payment UTR Submission Form */}
      <form onSubmit={handleSubmitUtr} className="border-t border-neutral-200 dark:border-neutral-800 pt-6 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
          Step 2: Submit 12-Digit Bank UTR / Ref Number After Payment
        </h4>

        <div className="space-y-3">
          <Input
            label="12-Digit UPI Transaction Ref / UTR Number *"
            placeholder="e.g. 423156789012"
            value={utrNumber}
            onChange={e => setUtrNumber(e.target.value)}
            hint="Located in your UPI payment receipt (e.g. Google Pay / PhonePe / Paytm)"
          />

          <Input
            label="Payment Screenshot URL (Optional)"
            placeholder="https://..."
            value={screenshotUrl}
            onChange={e => setScreenshotUrl(e.target.value)}
          />

          <Input
            label="Additional Notes (Optional)"
            placeholder="Payment remarks or bank name..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" type="submit" loading={submitting}>
            Submit UTR for Verification
          </Button>
        </div>
      </form>
    </div>
  );
};
