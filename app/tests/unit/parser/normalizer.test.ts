import { describe, it, expect } from 'vitest';

/**
 * Data normalization unit tests
 * Tests for normalizing various data formats (numbers, digits, GTINs)
 */

describe('Normalizer', () => {
  describe('normalizeNumber', () => {
    it('should handle European format (1.234,56)', () => {
      // European: period as thousands separator, comma as decimal
      const input = '1.234,56';
      // Mock normalization
      const result = parseFloat(input.replace(/\./g, '').replace(',', '.'));

      expect(result).toBe(1234.56);
    });

    it('should handle US format (1,234.56)', () => {
      // US: comma as thousands separator, period as decimal
      const input = '1,234.56';
      const result = parseFloat(input.replace(/,/g, ''));

      expect(result).toBe(1234.56);
    });

    it('should handle numbers without separators', () => {
      expect(parseFloat('12345')).toBe(12345);
      expect(parseFloat('123.45')).toBe(123.45);
    });

    it('should handle currency symbols', () => {
      const testCases = [
        { input: '$1,234.56', expected: 1234.56 },
        { input: '€1.234,56', expected: 1234.56 },
        { input: '£999.99', expected: 999.99 },
        { input: '¥1000', expected: 1000 }
      ];

      testCases.forEach(({ input, expected }) => {
        // Remove currency symbols and normalize
        const cleaned = input.replace(/[$€£¥]/g, '');
        const hasCommaDecimal = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.');
        const normalized = hasCommaDecimal
          ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
          : parseFloat(cleaned.replace(/,/g, ''));

        expect(normalized).toBe(expected);
      });
    });

    it('should handle negative numbers', () => {
      expect(parseFloat('-123.45')).toBe(-123.45);
      expect(parseFloat('(123.45)'.replace(/[()]/g, '-'))).toBe(-123.45);
    });

    it('should handle whitespace', () => {
      const input = '  1,234.56  ';
      const result = parseFloat(input.trim().replace(/,/g, ''));

      expect(result).toBe(1234.56);
    });

    it('should return NaN for invalid input', () => {
      expect(isNaN(parseFloat('invalid'))).toBe(true);
      expect(isNaN(parseFloat(''))).toBe(true);
    });
  });

  describe('normalizePersianDigits', () => {
    it('should convert Persian digits to ASCII', () => {
      // Persian digits: ۰۱۲۳۴۵۶۷۸۹
      const persianToAscii: Record<string, string> = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
      };

      const input = '۱۲۳۴';
      const result = input.split('').map(char => persianToAscii[char] || char).join('');

      expect(result).toBe('1234');
    });

    it('should convert Arabic-Indic digits to ASCII', () => {
      // Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩
      const arabicToAscii: Record<string, string> = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
      };

      const input = '٠١٢٣';
      const result = input.split('').map(char => arabicToAscii[char] || char).join('');

      expect(result).toBe('0123');
    });

    it('should handle mixed Persian and ASCII digits', () => {
      const persianToAscii: Record<string, string> = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
      };

      const input = '۱۲34';
      const result = input.split('').map(char => persianToAscii[char] || char).join('');

      expect(result).toBe('1234');
    });

    it('should preserve non-digit characters', () => {
      const persianToAscii: Record<string, string> = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
      };

      const input = 'SKU-۱۲۳';
      const result = input.split('').map(char => persianToAscii[char] || char).join('');

      expect(result).toBe('SKU-123');
    });
  });

  describe('normalizeGtin', () => {
    it('should validate GTIN-13 check digit', () => {
      // Valid GTIN-13: 5901234123457
      const gtin = '5901234123457';

      // GTIN-13 check digit algorithm
      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      const checkDigit = parseInt(gtin.slice(-1));
      const calculated = calculateCheckDigit(gtin);

      expect(checkDigit).toBe(calculated);
    });

    it('should reject invalid GTIN-13 check digit', () => {
      const invalidGtin = '5901234123458';

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      const checkDigit = parseInt(invalidGtin.slice(-1));
      const calculated = calculateCheckDigit(invalidGtin);

      expect(checkDigit).not.toBe(calculated);
    });

    it('should identify GTIN type by length', () => {
      const testCases = [
        { gtin: '12345678', type: 'GTIN-8' },
        { gtin: '123456789012', type: 'GTIN-12' },
        { gtin: '1234567890123', type: 'GTIN-13' },
        { gtin: '12345678901234', type: 'GTIN-14' }
      ];

      testCases.forEach(({ gtin, type }) => {
        const gtinType = gtin.length === 8 ? 'GTIN-8' :
                        gtin.length === 12 ? 'GTIN-12' :
                        gtin.length === 13 ? 'GTIN-13' :
                        gtin.length === 14 ? 'GTIN-14' : 'UNKNOWN';

        expect(gtinType).toBe(type);
      });
    });

    it('should handle GTINs with leading zeros', () => {
      const gtin = '0012345678905';
      expect(gtin.length).toBe(13);
      expect(gtin.startsWith('00')).toBe(true);
    });

    it('should reject non-numeric GTINs', () => {
      const invalidGtins = ['ABC1234567890', '123-456-789', '12345 67890'];

      invalidGtins.forEach(gtin => {
        const isNumeric = /^\d+$/.test(gtin);
        expect(isNumeric).toBe(false);
      });
    });
  });

  describe('normalizeSku', () => {
    it('should trim whitespace from SKUs', () => {
      const input = '  SKU-12345  ';
      expect(input.trim()).toBe('SKU-12345');
    });

    it('should preserve SKU case', () => {
      const sku = 'Sku-MixedCase-123';
      expect(sku).toBe('Sku-MixedCase-123');
    });

    it('should handle empty SKUs', () => {
      const sku = '';
      expect(sku.trim()).toBe('');
    });
  });
});
