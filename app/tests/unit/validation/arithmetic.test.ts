import { describe, it, expect } from 'vitest';

/**
 * Arithmetic validation unit tests
 * Tests for validating order calculations with tolerance
 */

describe('Arithmetic Validation', () => {
  describe('approxEqual', () => {
    it('should consider values equal within absolute tolerance', () => {
      const approxEqual = (a: number, b: number, absTol = 0.02): boolean => {
        return Math.abs(a - b) <= absTol;
      };

      expect(approxEqual(10.00, 10.01, 0.02)).toBe(true);
      expect(approxEqual(10.00, 10.02, 0.02)).toBe(true);
      expect(approxEqual(10.00, 9.99, 0.02)).toBe(true);
    });

    it('should reject values outside absolute tolerance', () => {
      const approxEqual = (a: number, b: number, absTol = 0.02): boolean => {
        return Math.abs(a - b) <= absTol;
      };

      expect(approxEqual(10.00, 10.03, 0.02)).toBe(false);
      expect(approxEqual(10.00, 9.97, 0.02)).toBe(false);
    });

    it('should use relative tolerance for large values', () => {
      const approxEqual = (a: number, b: number, absTol = 0.02, relTol = 0.01): boolean => {
        const maxTol = Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)));
        return Math.abs(a - b) <= maxTol;
      };

      // For 1000, 1% = 10, so values within 10 should match
      expect(approxEqual(1000, 1005, 0.02, 0.01)).toBe(true);
      expect(approxEqual(1000, 995, 0.02, 0.01)).toBe(true);
      expect(approxEqual(1000, 1015, 0.02, 0.01)).toBe(false);
    });

    it('should handle zero values', () => {
      const approxEqual = (a: number, b: number, absTol = 0.02): boolean => {
        return Math.abs(a - b) <= absTol;
      };

      expect(approxEqual(0, 0, 0.02)).toBe(true);
      expect(approxEqual(0, 0.01, 0.02)).toBe(true);
      expect(approxEqual(0, 0.03, 0.02)).toBe(false);
    });
  });

  describe('validateLineTotal', () => {
    it('should validate correct line total calculation', () => {
      const qty = 10;
      const unitPrice = 25.50;
      const lineTotal = 255.00;

      const calculated = qty * unitPrice;
      const approxEqual = Math.abs(calculated - lineTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });

    it('should accept line total within tolerance', () => {
      const qty = 3;
      const unitPrice = 10.33;
      const lineTotal = 31.00; // actual: 30.99

      const calculated = qty * unitPrice;
      const approxEqual = Math.abs(calculated - lineTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });

    it('should reject line total outside tolerance', () => {
      const qty = 10;
      const unitPrice = 25.50;
      const lineTotal = 260.00; // should be 255.00

      const calculated = qty * unitPrice;
      const approxEqual = Math.abs(calculated - lineTotal) <= 0.02;

      expect(approxEqual).toBe(false);
    });

    it('should handle quantity of zero', () => {
      const qty = 0;
      const unitPrice = 25.50;
      const lineTotal = 0;

      const calculated = qty * unitPrice;
      const approxEqual = Math.abs(calculated - lineTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });

    it('should flag mismatch when qty=0 but line total is not zero', () => {
      const qty = 0;
      const unitPrice = 25.50;
      const lineTotal = 100.00;

      const calculated = qty * unitPrice;
      const approxEqual = Math.abs(calculated - lineTotal) <= 0.02;

      expect(approxEqual).toBe(false);
    });

    it('should use relative tolerance for large line totals', () => {
      const qty = 100;
      const unitPrice = 150.00;
      const lineTotal = 15005.00; // actual: 15000.00, diff: 5.00

      const calculated = qty * unitPrice;
      const absTol = 0.02;
      const relTol = 0.01;
      const maxTol = Math.max(absTol, relTol * lineTotal);
      const approxEqual = Math.abs(calculated - lineTotal) <= maxTol;

      expect(approxEqual).toBe(true);
    });
  });

  describe('validateOrderTotal', () => {
    it('should validate correct order total', () => {
      const lineTotals = [255.00, 100.00, 50.50];
      const orderTotal = 405.50;

      const calculated = lineTotals.reduce((sum, total) => sum + total, 0);
      const approxEqual = Math.abs(calculated - orderTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });

    it('should accept order total within tolerance', () => {
      const lineTotals = [10.33, 20.66, 30.99];
      const orderTotal = 62.00; // actual: 61.98

      const calculated = lineTotals.reduce((sum, total) => sum + total, 0);
      const approxEqual = Math.abs(calculated - orderTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });

    it('should reject order total outside tolerance', () => {
      const lineTotals = [255.00, 100.00, 50.50];
      const orderTotal = 410.00; // should be 405.50

      const calculated = lineTotals.reduce((sum, total) => sum + total, 0);
      const approxEqual = Math.abs(calculated - orderTotal) <= 0.02;

      expect(approxEqual).toBe(false);
    });

    it('should handle empty line items', () => {
      const lineTotals: number[] = [];
      const orderTotal = 0;

      const calculated = lineTotals.reduce((sum, total) => sum + total, 0);
      const approxEqual = Math.abs(calculated - orderTotal) <= 0.02;

      expect(approxEqual).toBe(true);
    });
  });

  describe('arithmeticIssueGeneration', () => {
    it('should generate issue for line total mismatch', () => {
      const qty = 10;
      const unitPrice = 25.50;
      const lineTotal = 260.00;
      const calculated = qty * unitPrice;

      const hasMismatch = Math.abs(calculated - lineTotal) > 0.02;

      if (hasMismatch) {
        const issue = {
          code: 'ARITHMETIC_MISMATCH',
          severity: 'warn',
          message: `Line total mismatch: ${qty} × ${unitPrice} = ${calculated}, but spreadsheet shows ${lineTotal}`,
          evidence: [],
          requiresUserInput: false
        };

        expect(issue.code).toBe('ARITHMETIC_MISMATCH');
        expect(issue.severity).toBe('warn');
      }
    });

    it('should not generate issue for values within tolerance', () => {
      const qty = 3;
      const unitPrice = 10.33;
      const lineTotal = 31.00;
      const calculated = qty * unitPrice;

      const hasMismatch = Math.abs(calculated - lineTotal) > 0.02;

      expect(hasMismatch).toBe(false);
    });

    it('should include evidence in arithmetic issue', () => {
      const issue = {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'warn',
        message: 'Line total mismatch',
        evidence: [
          { sheet: 'Sheet1', cell: 'C5', raw_value: 10 },
          { sheet: 'Sheet1', cell: 'D5', raw_value: 25.50 },
          { sheet: 'Sheet1', cell: 'E5', raw_value: 260.00 }
        ]
      };

      expect(issue.evidence).toHaveLength(3);
      expect(issue.evidence[2].cell).toBe('E5');
    });
  });

  describe('toleranceConfiguration', () => {
    it('should allow configurable absolute tolerance', () => {
      const customTolerance = 0.05;

      const approxEqual = (a: number, b: number): boolean => {
        return Math.abs(a - b) <= customTolerance;
      };

      expect(approxEqual(10.00, 10.04, )).toBe(true);
      expect(approxEqual(10.00, 10.06)).toBe(false);
    });

    it('should allow configurable relative tolerance', () => {
      const absTol = 0.02;
      const relTol = 0.02; // 2%

      const approxEqual = (a: number, b: number): boolean => {
        const maxTol = Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)));
        return Math.abs(a - b) <= maxTol;
      };

      // For 1000, 2% = 20
      expect(approxEqual(1000, 1015)).toBe(true);
      expect(approxEqual(1000, 1025)).toBe(false);
    });
  });
});
