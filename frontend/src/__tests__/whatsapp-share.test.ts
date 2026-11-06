import { describe, it, expect } from 'vitest';
import { buildReminderLink } from '@/shared/utils/whatsappShare';

describe('buildReminderLink', () => {
  it('builds wa.me/91 phone with encoded invoice text', () => {
    const url = buildReminderLink({ phone: '9876543210', invoiceNo: 'INV-2026-101', amount: 25000, upi: 'upi://pay?pa=a%40upi' });
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('INV-2026-101');
    expect(decoded).toContain('25,000');
    expect(decoded).toContain('upi://pay');
  });

  it('strips formatting and avoids double 91 prefix', () => {
    const a = buildReminderLink({ phone: '+91 98765-43210', invoiceNo: 'INV-1', amount: 100 });
    expect(a.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    const b = buildReminderLink({ phone: '919876543210', invoiceNo: 'INV-1', amount: 100 });
    expect(b).toBe(a);
  });

  it('works without upi link', () => {
    const url = buildReminderLink({ phone: '9876543210', invoiceNo: 'INV-2', amount: 500 });
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('INV-2');
  });

  it('respects whatsapp_reminders=false consent flag', () => {
    const url = buildReminderLink({ phone: '9876543210', invoiceNo: 'INV-3', amount: 500, upi: 'upi://pay?pa=x', whatsapp_reminders: false });
    expect(decodeURIComponent(url)).toContain('INV-3');
    expect(decodeURIComponent(url)).not.toContain('upi://pay');
  });
});
