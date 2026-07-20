import { describe, it, expect } from 'vitest';
import { formatIndianDate, formatFriendlyDate, isPastDate } from '@/shared/utils/date';

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
});
