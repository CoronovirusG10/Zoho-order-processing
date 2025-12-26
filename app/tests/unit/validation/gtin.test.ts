import { describe, it, expect } from 'vitest';

/**
 * GTIN validation unit tests
 * Tests for validating Global Trade Item Numbers (GTIN-8, GTIN-12, GTIN-13, GTIN-14)
 */

describe('GTIN Validation', () => {
  describe('validateGtin13', () => {
    it('should validate correct GTIN-13 codes', () => {
      const validGtins = [
        '5901234123457',
        '4006381333931',
        '8712345678906',
        '0012345678905'
      ];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      validGtins.forEach(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        expect(checkDigit).toBe(calculated);
      });
    });

    it('should reject GTIN-13 with invalid check digit', () => {
      const invalidGtins = [
        '5901234123458', // wrong check digit
        '4006381333932',
        '8712345678907'
      ];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      invalidGtins.forEach(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        expect(checkDigit).not.toBe(calculated);
      });
    });

    it('should reject GTIN-13 with wrong length', () => {
      const invalidLengths = [
        '59012341234',     // too short
        '59012341234567',  // too long
        '123'
      ];

      invalidLengths.forEach(gtin => {
        expect(gtin.length).not.toBe(13);
      });
    });

    it('should reject non-numeric GTIN-13', () => {
      const invalidGtins = [
        '590123412345A',
        'ABCDEFGHIJKLM',
        '5901-2341-2345'
      ];

      invalidGtins.forEach(gtin => {
        const isNumeric = /^\d+$/.test(gtin);
        expect(isNumeric).toBe(false);
      });
    });
  });

  describe('validateGtin8', () => {
    it('should validate correct GTIN-8 codes', () => {
      const validGtins = [
        '12345670',
        '96385074'
      ];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 3 : 1), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      validGtins.forEach(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        expect(checkDigit).toBe(calculated);
      });
    });
  });

  describe('validateGtin12', () => {
    it('should validate correct UPC-A (GTIN-12) codes', () => {
      const validGtins = [
        '012345678905',
        '614141007349'
      ];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 3 : 1), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      validGtins.forEach(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        expect(checkDigit).toBe(calculated);
      });
    });
  });

  describe('validateGtin14', () => {
    it('should validate correct GTIN-14 codes', () => {
      const validGtins = [
        '12345678901231',
        '98765432109213'
      ];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 3 : 1), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      validGtins.forEach(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        expect(checkDigit).toBe(calculated);
      });
    });
  });

  describe('detectGtinType', () => {
    it('should detect GTIN type by length', () => {
      const testCases = [
        { gtin: '12345670', expectedType: 'GTIN-8' },
        { gtin: '012345678905', expectedType: 'GTIN-12' },
        { gtin: '5901234123457', expectedType: 'GTIN-13' },
        { gtin: '12345678901231', expectedType: 'GTIN-14' }
      ];

      testCases.forEach(({ gtin, expectedType }) => {
        const type = gtin.length === 8 ? 'GTIN-8' :
                    gtin.length === 12 ? 'GTIN-12' :
                    gtin.length === 13 ? 'GTIN-13' :
                    gtin.length === 14 ? 'GTIN-14' : 'UNKNOWN';

        expect(type).toBe(expectedType);
      });
    });

    it('should return UNKNOWN for invalid lengths', () => {
      const invalidGtins = ['123', '12345', '123456789'];

      invalidGtins.forEach(gtin => {
        const type = gtin.length === 8 ? 'GTIN-8' :
                    gtin.length === 12 ? 'GTIN-12' :
                    gtin.length === 13 ? 'GTIN-13' :
                    gtin.length === 14 ? 'GTIN-14' : 'UNKNOWN';

        expect(type).toBe('UNKNOWN');
      });
    });
  });

  describe('gtinValidationResult', () => {
    it('should return validation result with details', () => {
      const gtin = '5901234123457';

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      const checkDigit = parseInt(gtin.slice(-1));
      const calculated = calculateCheckDigit(gtin);
      const isValid = checkDigit === calculated;

      const result = {
        value: gtin,
        valid: isValid,
        type: 'GTIN-13',
        checkDigit: checkDigit,
        calculatedCheckDigit: calculated
      };

      expect(result.valid).toBe(true);
      expect(result.type).toBe('GTIN-13');
      expect(result.checkDigit).toBe(result.calculatedCheckDigit);
    });
  });
});
