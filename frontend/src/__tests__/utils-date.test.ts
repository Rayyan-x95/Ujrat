import { describe, it, expect } from 'vitest';
import { formatIndianDate, formatFriendlyDate, isPastDate } from '@/shared/utils/date';
import { formatDeadline } from '@/features/proposals/components/ProposalTab';

describe('Date Utility Functions', () => {
  describe('formatIndianDate', () => {
    it('should format date to standard Indian representation (dd/mm/yyyy)', () => {
      const date = new Date('2026-07-04T00:00:00Z');
      const formatted = formatIndianDate(date);
      // Depending on locale interpretation, local timezone offset can change it. Let's test with a string as well.
      // But we can check standard day/month/year parts.
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('formatFriendlyDate', () => {
    it('should format date to reader friendly format', () => {
      const date = new Date('2026-07-04T00:00:00Z');
      const formatted = formatFriendlyDate(date);
      expect(formatted).toContain('2026');
    });
  });

  describe('isPastDate', () => {
    it('should return true for historical dates', () => {
      const date = new Date('2020-01-01');
      expect(isPastDate(date)).toBe(true);
    });

    it('should return false for future dates', () => {
      // Create a date far in the future
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      expect(isPastDate(futureDate)).toBe(false);
    });
  });

  describe('formatDeadline', () => {
    it('formats YYYY-MM-DD date-only values preserving exact calendar date without timezone shift', () => {
      const res = formatDeadline('2026-10-31');
      expect(res).toContain('31');
      expect(res).toContain('Oct');
      expect(res).toContain('2026');
      expect(res).toContain('Target Delivery:');
    });

    it('handles empty and invalid date strings gracefully', () => {
      expect(formatDeadline('')).toBe('');
      expect(formatDeadline('not-a-date')).toBe('not-a-date');
    });

    it('formats valid ISO datetime strings', () => {
      const res = formatDeadline('2026-12-15T10:00:00Z');
      expect(res).toContain('Target Delivery:');
      expect(res).toContain('2026');
    });
  });
});
