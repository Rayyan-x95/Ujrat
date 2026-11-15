import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// The printed invoice must show what was STORED on the invoice. The tax
// engine would recompute a different number (the client row changed since
// issue), so a stored-vs-recomputed mismatch is what this test pins down.
const storedInvoice = {
  id: 'inv-1',
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-09-01',
  due_date: '2026-09-15',
  status: 'sent',
  currency: 'INR',
  subtotal: 10000,
  taxable_amount: 9000,
  discount_amount: 1000,
  discount_scope: 'before_tax',
  cgst: 810,
  sgst: 810,
  igst: 0,
  cess_amount: 0,
  round_off: 0,
  total: 10820,
  tds_section: null,
  tds_rate: 0,
  tds_amount: 0,
  net_receivable: 10820,
  exchange_rate: 1,
  inr_total: 10820,
  outstanding_balance: 10820,
  supply_type: 'taxable',
  tax_scheme: 'regular',
  is_interstate: false,
  is_reverse_charge: false,
  freelancer_gstin: '29AAAAA1111A1Z1',
  client_gstin: '29BBBBB2222B1Z2',
  freelancer_state: 'Karnataka',
  client_state: 'Karnataka',
  notes: null,
  invoice_items: [
    {
      description: 'Design work',
      quantity: 1,
      rate: 10000,
      gst_rate: 18,
      hsn_code: '998314',
      sac_code: null,
      unit: 'NOS',
      taxable_amount: 9000,
      line_total: 9820,
      amount: 9820,
    },
  ],
};

const getPortalData = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ portalToken: 'tok-1', invoiceId: 'inv-1' }),
  useNavigate: () => () => {},
}));

vi.mock('@/features/portal/services/PortalService', () => ({
  PortalService: { getPortalData: (...args: unknown[]) => getPortalData(...args) },
}));

vi.mock('@/features/payments/services/PaymentService', () => ({
  PaymentService: { generateUpiLink: () => 'upi://pay?pa=f%40upi' },
}));

describe('InvoicePrintView prints the stored invoice', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    getPortalData.mockResolvedValue({
      success: true,
      data: {
        project: { id: 'proj-1', name: 'Website Redesign', status: 'in_progress' },
        client: { id: 'c-1', name: 'Acme Corp', company: 'Acme', state: 'Karnataka' },
        settings: { company_name: 'Studio', upi_id: 'f@upi' },
        proposal: null,
        contract: null,
        invoices: [storedInvoice],
        deliverables: [],
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const mod = await import('@/features/invoices/components/InvoicePrintView');
    await act(async () => {
      root.render(<mod.InvoicePrintView />);
      await new Promise(r => setTimeout(r, 0));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the stored line item values, not recomputed tax', () => {
    const text = container.textContent || '';
    // Stored taxable value (9,000) - the engine would recompute 10,000.
    expect(text).toContain('₹9,000.00');
    // Stored CGST/SGST split (810 each) - recomputed it would be 900.
    expect(text).toContain('₹810.00');
    expect(text).not.toContain('₹900.00');
    // Stored line total (9,820) - recomputed it would be 11,800.
    expect(text).toContain('₹9,820.00');
    expect(text).not.toContain('₹11,800.00');
  });

  it('prints the GSTIN snapshot stored on the invoice', () => {
    const text = container.textContent || '';
    expect(text).toContain('29AAAAA1111A1Z1');
    expect(text).toContain('29BBBBB2222B1Z2');
  });
});
