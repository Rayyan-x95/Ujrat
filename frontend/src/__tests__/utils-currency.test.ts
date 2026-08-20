import { describe, it, expect } from 'vitest';
import { formatINR, numberToIndianRupeeWords } from '@/shared/utils/currency';

describe('Currency Utility Functions', () => {
  describe('formatINR', () => {
    it('should format numbers to Indian currency representation', () => {
      const formatted = formatINR(150000);
      expect(formatted).toContain('1,50,000.00');
    });

    it('should handle zero amounts', () => {
      const formatted = formatINR(0);
      expect(formatted).toContain('0.00');
    });
  });

  describe('numberToIndianRupeeWords', () => {
    it('should return Zero Rupees Only for 0', () => {
      expect(numberToIndianRupeeWords(0)).toBe('Zero Rupees Only');
    });

    it('should convert small numbers correctly', () => {
      expect(numberToIndianRupeeWords(5)).toBe('Five Rupees Only');
      expect(numberToIndianRupeeWords(15)).toBe('Fifteen Rupees Only');
      expect(numberToIndianRupeeWords(42)).toBe('Forty Two Rupees Only');
    });

    it('should convert large numbers correctly using Indian numbering groups', () => {
      expect(numberToIndianRupeeWords(150000)).toBe('One Lakh Fifty Thousand Rupees Only');
      expect(numberToIndianRupeeWords(2500000)).toBe('Twenty Five Lakh Rupees Only');
      expect(numberToIndianRupeeWords(12345678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only');
    });
  });
});
