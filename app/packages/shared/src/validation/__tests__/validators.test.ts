/**
 * Tests for common validators
 */

import { describe, it, expect } from 'vitest';
import {
  validateGtin,
  normalizeSku,
  parseCurrency,
  validateQuantity,
  isWithinTolerance,
  validateLineArithmetic,
} from '../validators';

describe('validateGtin', () => {
  it('should validate valid GTIN-13', () => {
    const result = validateGtin('5901234123457');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('GTIN-13');
    expect(result.normalized).toBe('5901234123457');
  });

  it('should validate valid GTIN-8', () => {
    const result = validateGtin('96385074');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('GTIN-8');
  });

  it('should reject invalid check digit', () => {
    const result = validateGtin('5901234123456'); // Wrong check digit
    expect(result.valid).toBe(false);
    expect(result.error).toContain('check digit');
  });

  it('should reject invalid length', () => {
    const result = validateGtin('123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 8, 12, 13, or 14 digits');
  });

  it('should handle null/undefined', () => {
    expect(validateGtin(null).valid).toBe(false);
    expect(validateGtin(undefined).valid).toBe(false);
  });
});

describe('normalizeSku', () => {
  it('should trim and uppercase SKU', () => {
    expect(normalizeSku('  abc-123  ')).toBe('ABC-123');
  });

  it('should return null for empty strings', () => {
    expect(normalizeSku('')).toBe(null);
    expect(normalizeSku('   ')).toBe(null);
  });

  it('should handle null/undefined', () => {
    expect(normalizeSku(null)).toBe(null);
    expect(normalizeSku(undefined)).toBe(null);
  });
});

describe('parseCurrency', () => {
  it('should parse currency strings', () => {
    expect(parseCurrency('$123.45')).toBe(123.45);
    expect(parseCurrency('€1,234.56')).toBe(1234.56);
    expect(parseCurrency('1 234,56')).toBe(1234.56);
  });

  it('should handle numeric input', () => {
    expect(parseCurrency(123.45)).toBe(123.45);
  });

  it('should round to 2 decimal places', () => {
    expect(parseCurrency('123.456')).toBe(123.46);
  });

  it('should return null for invalid input', () => {
    expect(parseCurrency('abc')).toBe(null);
    expect(parseCurrency('')).toBe(null);
    expect(parseCurrency(null)).toBe(null);
  });
});

describe('validateQuantity', () => {
  it('should accept valid quantities', () => {
    expect(validateQuantity(0).valid).toBe(true);
    expect(validateQuantity(1).valid).toBe(true);
    expect(validateQuantity(10.5).valid).toBe(true);
  });

  it('should reject negative quantities', () => {
    const result = validateQuantity(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negative');
  });

  it('should reject non-numeric input', () => {
    expect(validateQuantity('abc').valid).toBe(false);
  });

  it('should handle string numbers', () => {
    const result = validateQuantity('10.5');
    expect(result.valid).toBe(true);
    expect(result.value).toBe(10.5);
  });
});

describe('isWithinTolerance', () => {
  it('should accept values within absolute tolerance', () => {
    expect(isWithinTolerance(100, 100.01, { absoluteTolerance: 0.02 })).toBe(true);
  });

  it('should accept values within relative tolerance', () => {
    expect(isWithinTolerance(1000, 1005, { relativeTolerance: 0.01 })).toBe(true);
  });

  it('should reject values outside tolerance', () => {
    expect(isWithinTolerance(100, 110, { absoluteTolerance: 0.02 })).toBe(false);
  });
});

describe('validateLineArithmetic', () => {
  it('should accept correct arithmetic', () => {
    const result = validateLineArithmetic(10, 5.0, 50.0);
    expect(result.valid).toBe(true);
    expect(result.expected).toBe(50.0);
  });

  it('should accept arithmetic within tolerance', () => {
    const result = validateLineArithmetic(10, 5.0, 50.01);
    expect(result.valid).toBe(true);
  });

  it('should reject arithmetic outside tolerance', () => {
    const result = validateLineArithmetic(10, 5.0, 60.0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mismatch');
  });
});
