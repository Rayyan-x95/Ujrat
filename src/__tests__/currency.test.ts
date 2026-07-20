import { describe, it, expect } from 'vitest';
import { formatINR, numberToIndianWords } from '@/shared/utils/currency';

describe('Currency Utility Functions', () => {
  describe('formatINR', () => {
    it('should format numbers to Indian currency representation', () => {
      // Note: Intl.NumberFormat might use non-breaking spaces or different formatting depending on node version,
      // but we check if it contains the basic characters and structure.
      const formatted = formatINR(150000);
      expect(formatted).toContain('1,50,000.00');
    });

    it('should handle zero amounts', () => {
      const formatted = formatINR(0);
      expect(formatted).toContain('0.00');
    });
  });

  describe('numberToIndianWords', () => {
    it('should return Rupees Zero Only for 0', () => {
      expect(numberToIndianWords(0)).toBe('Rupees Zero Only');
    });

    it('should convert small numbers correctly', () => {
      expect(numberToIndianWords(5)).toBe('Rupees Five Only');
      expect(numberToIndianWords(15)).toBe('Rupees Fifteen Only');
      expect(numberToIndianWords(42)).toBe('Rupees Forty Two Only');
    });

    it('should convert large numbers correctly using Indian numbering groups', () => {
      expect(numberToIndianWords(150000)).toBe('Rupees One Lakh Fifty Thousand Only');
      expect(numberToIndianWords(2500000)).toBe('Rupees Twenty Five Lakh Only');
      expect(numberToIndianWords(12345678)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
    });
  });
});
