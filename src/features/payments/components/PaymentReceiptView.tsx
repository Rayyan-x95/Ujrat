import React from 'react';
import { Button } from '@/shared/ui/Button';
import type { PaymentReceiptData } from '../types/PaymentTypes';
import { formatCurrencyAmount } from '@/features/invoices/utils/TaxEngine';

interface PaymentReceiptViewProps {
  receipt: PaymentReceiptData;
  onClose?: () => void;
}

export const PaymentReceiptView: React.FC<PaymentReceiptViewProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-xl w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6 print:p-0 print:border-none print:shadow-none">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">Official Receipt</span>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Payment Receipt</h2>
          <span className="font-mono text-xs text-neutral-500">{receipt.receiptNumber}</span>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="print:hidden">✕ Close</Button>
        )}
      </div>

      {/* Details Table */}
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div>
            <span className="text-neutral-400 block text-[10px] uppercase">RECEIVED FROM</span>
            <span className="font-bold text-neutral-900 dark:text-white text-sm">{receipt.clientName}</span>
          </div>
          <div className="text-right">
            <span className="text-neutral-400 block text-[10px] uppercase">AMOUNT PAID</span>
            <span className="font-extrabold text-emerald-600 text-lg">{formatCurrencyAmount(receipt.amount, receipt.currency as any)}</span>
          </div>
        </div>

        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-neutral-500">Payment Method:</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{receipt.paymentMethod}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-neutral-500">Bank UTR / Ref Number:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white">{receipt.utrNumber}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-neutral-500">Payment Date:</span>
            <span className="text-neutral-900 dark:text-white">{new Date(receipt.issuedAt).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Verification Status:</span>
            <span className="font-bold text-emerald-600 uppercase">Verified & Confirmed</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-neutral-200 dark:border-neutral-800 print:hidden">
        <span className="text-[10px] text-neutral-400">Computer-generated official payment receipt.</span>
        <Button variant="primary" onClick={handlePrint}>Print / Save Receipt</Button>
      </div>
    </div>
  );
};
