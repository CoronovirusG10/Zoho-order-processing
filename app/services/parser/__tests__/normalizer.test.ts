/**
 * Tests for normalizer
 */

import {
  normalizeNumber,
  normalizeSKU,
  normalizeGTIN,
  normalizeString,
  normalizeCurrency,
  detectLanguage
} from '../src/normalizer';

describe('Normalizer', () => {
  describe('normalizeNumber', () => {
    it('should normalize US format numbers', () => {
      expect(normalizeNumber('1,234.56')).toBe(1234.56);
      expect(normalizeNumber('1,234')).toBe(1234);
      expect(normalizeNumber('0.99')).toBe(0.99);
    });

    it('should normalize European format numbers', () => {
      expect(normalizeNumber('1.234,56')).toBe(1234.56);
      expect(normalizeNumber('1.234')).toBe(1234);
    });

    it('should handle numbers with currency symbols', () => {
      expect(normalizeNumber('$1,234.56')).toBe(1234.56);
      expect(normalizeNumber('€1.234,56')).toBe(1234.56);
      expect(normalizeNumber('£999.99')).toBe(999.99);
    });

    it('should convert Persian digits', () => {
      expect(normalizeNumber('۱۲۳۴')).toBe(1234);
      expect(normalizeNumber('۱۲۳.۴۵')).toBe(123.45);
    });

    it('should handle already numeric values', () => {
      expect(normalizeNumber(1234.56)).toBe(1234.56);
      expect(normalizeNumber(0)).toBe(0);
    });

    it('should return null for invalid values', () => {
      expect(normalizeNumber(null)).toBe(null);
      expect(normalizeNumber('')).toBe(null);
      expect(normalizeNumber('abc')).toBe(null);
    });
  });

  describe('normalizeSKU', () => {
    it('should normalize SKUs', () => {
      expect(normalizeSKU('abc-123')).toBe('ABC-123');
      expect(normalizeSKU('  xyz456  ')).toBe('XYZ456');
      expect(normalizeSKU('sku 789')).toBe('SKU 789');
    });

    it('should return null for empty values', () => {
      expect(normalizeSKU(null)).toBe(null);
      expect(normalizeSKU('')).toBe(null);
    });
  });

  describe('normalizeGTIN', () => {
    it('should normalize valid GTINs', () => {
      expect(normalizeGTIN('12345678')).toBe('12345678');
      expect(normalizeGTIN('123456789012')).toBe('123456789012');
      expect(normalizeGTIN('1234567890123')).toBe('1234567890123');
    });

    it('should handle GTINs with spaces/dashes', () => {
      expect(normalizeGTIN('1234-5678-9012')).toBe('123456789012');
      expect(normalizeGTIN('1234 5678 9012 3')).toBe('1234567890123');
    });

    it('should convert Persian digits', () => {
      expect(normalizeGTIN('۱۲۳۴۵۶۷۸')).toBe('12345678');
    });

    it('should return null for invalid lengths', () => {
      expect(normalizeGTIN('12345')).toBe(null);
      expect(normalizeGTIN('123456789')).toBe(null);
    });
  });

  describe('detectLanguage', () => {
    it('should detect English', () => {
      const texts = ['Product Name', 'SKU', 'Quantity', 'Price'];
      expect(detectLanguage(texts)).toBe('en');
    });

    it('should detect Farsi', () => {
      const texts = ['نام محصول', 'کد کالا', 'تعداد', 'قیمت'];
      expect(detectLanguage(texts)).toBe('fa');
    });

    it('should handle mixed content', () => {
      const texts = ['Product Name', 'کد کالا', 'Quantity'];
      const lang = detectLanguage(texts);
      expect(['en', 'fa']).toContain(lang);
    });

    it('should return null for empty input', () => {
      expect(detectLanguage([])).toBe(null);
    });
  });

  describe('normalizeCurrency', () => {
    it('should detect currency and extract amount', () => {
      expect(normalizeCurrency('$1,234.56')).toEqual({ amount: 1234.56, currency: 'USD' });
      expect(normalizeCurrency('€999.99')).toEqual({ amount: 999.99, currency: 'EUR' });
      expect(normalizeCurrency('£500')).toEqual({ amount: 500, currency: 'GBP' });
    });

    it('should handle currency without symbols', () => {
      const result = normalizeCurrency('1234.56');
      expect(result.amount).toBe(1234.56);
    });
  });
});
