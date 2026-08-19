import { describe, it, expect } from 'vitest';
import { generateInvoiceWhatsAppUrl, generatePortalWhatsAppUrl } from '@/shared/utils/whatsappShare';
import { COMMON_FREELANCE_SAC_CODES } from '@/features/invoices/constants/sacCodes';

describe('Quality of Life (QoL) Suite', () => {
  describe('WhatsApp Share URL Generator', () => {
    it('generates formatted invoice share URL without client phone', () => {
      const url = generateInvoiceWhatsAppUrl({
        invoiceNumber: 'INV-2026-101',
        total: 25000,
        dueDate: '2026-09-01',
        portalUrl: 'https://ujrat.ninety5.in/portal/token-abc-123',
      });

      expect(url).toContain('https://wa.me/?text=');
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('INV-2026-101');
      expect(decoded).toContain('₹25,000');
      expect(decoded).toContain('https://ujrat.ninety5.in/portal/token-abc-123');
    });

    it('generates direct client WhatsApp URL with sanitized phone number', () => {
      const url = generateInvoiceWhatsAppUrl({
        invoiceNumber: 'INV-2026-102',
        total: 50000,
        clientPhone: '+91 98765-43210',
        portalUrl: 'https://ujrat.ninety5.in/portal/token-xyz',
      });

      expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('INV-2026-102');
      expect(decoded).toContain('₹50,000');
    });

    it('generates portal link WhatsApp sharing URL', () => {
      const url = generatePortalWhatsAppUrl('E-commerce Mobile App', '+91-9988776655', 'https://ujrat.ninety5.in/portal/xyz');
      expect(url.startsWith('https://wa.me/919988776655?text=')).toBe(true);
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('E-commerce Mobile App');
      expect(decoded).toContain('https://ujrat.ninety5.in/portal/xyz');
    });
  });

  describe('Indian Freelancer SAC Presets', () => {
    it('includes standard IT & Software development SAC code 998314', () => {
      const itDev = COMMON_FREELANCE_SAC_CODES.find(s => s.code === '998314');
      expect(itDev).toBeDefined();
      expect(itDev?.category).toBe('IT & Software');
      expect(itDev?.defaultGstRate).toBe(18);
    });

    it('includes design & advertising SAC code 998361', () => {
      const design = COMMON_FREELANCE_SAC_CODES.find(s => s.code === '998361');
      expect(design).toBeDefined();
      expect(design?.category).toBe('Design & Marketing');
    });

    it('has valid structure for all presets', () => {
      expect(COMMON_FREELANCE_SAC_CODES.length).toBeGreaterThanOrEqual(5);
      COMMON_FREELANCE_SAC_CODES.forEach(item => {
        expect(item.code).toMatch(/^\d{6}$/);
        expect(item.category.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.defaultGstRate).toBe(18);
      });
    });
  });
});
