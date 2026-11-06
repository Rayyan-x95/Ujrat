import { describe, it, expect } from 'vitest';
import { buildFollowUpUpiLink, isFollowUpPayable } from '@/features/portal/components/PortalInvoiceTable';

const inv = { invoice_number: 'INV-2026-101', total: 11800, outstanding_balance: 5000, status: 'overdue' };

describe('portal follow-up — UPI CTA', () => {
  it('builds upi://pay link with VPA, amount and invoice note', () => {
    const link = buildFollowUpUpiLink(inv, 'freelancer@upi', 'Ujrat Co');
    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=freelancer%40upi');
    expect(link).toContain('am=5000.00');
    expect(link).toContain('tn=Invoice%20INV-2026-101');
    expect(link).toContain('cu=INR');
  });

  it('shows CTA only for overdue / partially_paid (overdue chip states)', () => {
    expect(isFollowUpPayable('overdue')).toBe(true);
    expect(isFollowUpPayable('partially_paid')).toBe(true);
    expect(isFollowUpPayable('paid')).toBe(false);
    expect(isFollowUpPayable('sent')).toBe(false);
    expect(buildFollowUpUpiLink({ ...inv, status: 'paid' }, 'freelancer@upi')).toBeNull();
  });

  it('hides CTA when settings.upi_id is missing or amount empty', () => {
    expect(buildFollowUpUpiLink(inv, null)).toBeNull();
    expect(buildFollowUpUpiLink(inv, '')).toBeNull();
    expect(buildFollowUpUpiLink({ ...inv, outstanding_balance: 0, total: 0 }, 'freelancer@upi')).toBeNull();
  });
});
