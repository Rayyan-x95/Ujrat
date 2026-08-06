import type { Invoice } from '@/shared/types';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportGstr1Csv(invoices: Invoice[]): void {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Due Date',
    'Status',
    'Taxable Value (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'IGST (₹)',
    'Total Amount (₹)',
    'Currency',
  ];

  const rows = invoices.map(inv => [
    escapeCsvCell(inv.invoice_number),
    escapeCsvCell(inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : ''),
    escapeCsvCell(inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : ''),
    escapeCsvCell(inv.status.toUpperCase()),
    escapeCsvCell(inv.subtotal ?? 0),
    escapeCsvCell(inv.cgst ?? 0),
    escapeCsvCell(inv.sgst ?? 0),
    escapeCsvCell(inv.igst ?? 0),
    escapeCsvCell(inv.total ?? 0),
    escapeCsvCell(inv.currency || 'INR'),
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ujrat_gstr1_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportWorkspaceJson(data: Record<string, any>, filename = 'ujrat_workspace_backup.json'): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
