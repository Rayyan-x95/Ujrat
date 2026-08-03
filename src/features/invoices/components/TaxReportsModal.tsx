import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
import { TaxRepository } from '../tax/TaxRepository';
import type { GSTR1Summary } from '../tax/TaxTypes';
import { formatINR } from '@/shared/utils/currency';

interface TaxReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export const TaxReportsModal: React.FC<TaxReportsModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  const [activeReport, setActiveReport] = useState<'gstr1' | 'gstr3b' | 'tds' | 'exports'>('gstr1');
  const [quarter, setQuarter] = useState<string>('Q1');
  const [year, setYear] = useState<string>('2026');
  const [summary, setSummary] = useState<GSTR1Summary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    let startDate = `${year}-04-01`;
    let endDate = `${year}-06-30`;
    if (quarter === 'Q2') {
      startDate = `${year}-07-01`;
      endDate = `${year}-09-30`;
    } else if (quarter === 'Q3') {
      startDate = `${year}-10-01`;
      endDate = `${year}-12-31`;
    } else if (quarter === 'Q4') {
      startDate = `${Number(year) + 1}-01-01`;
      endDate = `${Number(year) + 1}-03-31`;
    }

    TaxRepository.getGSTR1Summary(workspaceId, startDate, endDate)
      .then(res => {
        if (isMounted) {
          setSummary(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId, quarter, year]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">GST & Tax Compliance Reports</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Automated GSTR-1, GSTR-3B, TDS, and Export Summaries</p>
          </div>
          <Button variant="ghost" onClick={onClose}>✕ Close</Button>
        </div>

        {/* Report Selector Tabs & Filter */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-neutral-100 dark:bg-neutral-800 p-2 rounded-xl">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveReport('gstr1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeReport === 'gstr1'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              GSTR-1 Outward
            </button>
            <button
              onClick={() => setActiveReport('gstr3b')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeReport === 'gstr3b'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              GSTR-3B Summary
            </button>
            <button
              onClick={() => setActiveReport('tds')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeReport === 'tds'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              TDS (194J/194C)
            </button>
            <button
              onClick={() => setActiveReport('exports')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeReport === 'exports'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              LUT Exports
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={quarter}
              onChange={(e: any) => setQuarter(e.target.value)}
              className="py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 text-neutral-900 dark:text-white"
            >
              <option value="Q1">Q1 (Apr - Jun)</option>
              <option value="Q2">Q2 (Jul - Sep)</option>
              <option value="Q3">Q3 (Oct - Dec)</option>
              <option value="Q4">Q4 (Jan - Mar)</option>
            </select>

            <select
              value={year}
              onChange={(e: any) => setYear(e.target.value)}
              className="py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 text-neutral-900 dark:text-white"
            >
              <option value="2026">FY 2026-27</option>
              <option value="2025">FY 2025-26</option>
            </select>
          </div>
        </div>

        {/* Report Details */}
        {loading ? (
          <div className="p-12 text-center text-xs text-neutral-500">Generating compliance summary...</div>
        ) : (
          <div className="space-y-4">
            {activeReport === 'gstr1' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">B2B INVOICES</span>
                    <div className="text-xl font-extrabold text-neutral-900 dark:text-white mt-1">{summary?.total_b2b_invoices || 0}</div>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">B2C INVOICES</span>
                    <div className="text-xl font-extrabold text-neutral-900 dark:text-white mt-1">{summary?.total_b2c_invoices || 0}</div>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">EXPORT INVOICES</span>
                    <div className="text-xl font-extrabold text-neutral-900 dark:text-white mt-1">{summary?.total_export_invoices || 0}</div>
                  </div>
                </div>

                <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 font-medium">
                    <span>Taxable Value:</span>
                    <span>{formatINR(summary?.taxable_value || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-neutral-600 dark:text-neutral-400">
                    <span>Central Tax (CGST):</span>
                    <span>{formatINR(summary?.cgst_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-neutral-600 dark:text-neutral-400">
                    <span>State Tax (SGST):</span>
                    <span>{formatINR(summary?.sgst_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-neutral-600 dark:text-neutral-400">
                    <span>Integrated Tax (IGST):</span>
                    <span>{formatINR(summary?.igst_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-neutral-200 dark:border-neutral-800 font-bold text-primary text-sm">
                    <span>Total Tax Liability:</span>
                    <span>{formatINR(summary?.total_tax || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'gstr3b' && (
              <div className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 text-xs">
                <h3 className="font-bold text-neutral-900 dark:text-white uppercase text-[10px] tracking-wider">3.1 OUTWARD TAXABLE SUPPLIES SUMMARY</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">TOTAL OUTWARD TAXABLE</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-white">{formatINR(summary?.taxable_value || 0)}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">TOTAL GST PAYABLE</span>
                    <span className="font-bold text-sm text-primary">{formatINR(summary?.total_tax || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'tds' && (
              <div className="p-6 text-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-500">
                TDS Certificate (Form 16A) tracking active for FY {year}-{Number(year) + 1}. All TDS deductions under Section 194J/194C are automatically logged when clients remit payments.
              </div>
            )}

            {activeReport === 'exports' && (
              <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-neutral-900 dark:text-white block uppercase text-[10px]">EXPORT UNDER LUT SUMMARY</span>
                <p className="text-neutral-500">Zero-Rated export turnover under Section 16 of IGST Act: <span className="font-bold text-neutral-900 dark:text-white">{summary?.total_export_invoices || 0} Invoices</span></p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" onClick={onClose}>Close Report</Button>
        </div>
      </div>
    </div>
  );
};
