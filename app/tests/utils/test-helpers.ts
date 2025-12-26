/**
 * Test helper utilities
 */

import type { EvidenceCell } from '@order-processing/types';

/**
 * Deep equality comparison for objects, with option to ignore specific paths
 */
export function deepEqual(
  obj1: any,
  obj2: any,
  options: { ignore?: string[] } = {}
): boolean {
  const { ignore = [] } = options;

  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== typeof obj2) return false;

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, idx) => deepEqual(item, obj2[idx], options));
  }

  if (typeof obj1 === 'object' && typeof obj2 === 'object') {
    const keys1 = Object.keys(obj1).filter(k => !ignore.includes(k));
    const keys2 = Object.keys(obj2).filter(k => !ignore.includes(k));

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => {
      if (!keys2.includes(key)) return false;
      return deepEqual(obj1[key], obj2[key], options);
    });
  }

  return false;
}

/**
 * Compute diff between two objects
 */
export function computeDiff(actual: any, expected: any, path: string = ''): any {
  if (deepEqual(actual, expected)) return null;

  if (typeof actual !== typeof expected) {
    return { path, type: 'type-mismatch', actual, expected };
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return { path, type: 'length-mismatch', actualLength: actual.length, expectedLength: expected.length };
    }

    const diffs: any[] = [];
    actual.forEach((item, idx) => {
      const diff = computeDiff(item, expected[idx], `${path}[${idx}]`);
      if (diff) diffs.push(diff);
    });

    return diffs.length > 0 ? diffs : null;
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    const diffs: any = {};

    allKeys.forEach(key => {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in actual)) {
        diffs[key] = { path: newPath, type: 'missing-in-actual', expected: expected[key] };
      } else if (!(key in expected)) {
        diffs[key] = { path: newPath, type: 'extra-in-actual', actual: actual[key] };
      } else {
        const diff = computeDiff(actual[key], expected[key], newPath);
        if (diff) diffs[key] = diff;
      }
    });

    return Object.keys(diffs).length > 0 ? diffs : null;
  }

  return { path, type: 'value-mismatch', actual, expected };
}

/**
 * Create mock evidence cell
 */
export function createMockEvidence(
  sheet: string,
  cell: string,
  rawValue: unknown,
  displayValue?: string
): EvidenceCell {
  return {
    sheet,
    cell,
    raw_value: rawValue,
    display_value: displayValue ?? String(rawValue)
  };
}

/**
 * Validate GTIN check digit
 */
export function validateGtinCheckDigit(gtin: string): boolean {
  if (!/^\d+$/.test(gtin)) return false;
  if (![8, 12, 13, 14].includes(gtin.length)) return false;

  const digits = gtin.slice(0, -1).split('').map(Number);
  const checkDigit = parseInt(gtin.slice(-1));

  let sum: number;

  if (gtin.length === 13) {
    // GTIN-13: odd positions × 1, even positions × 3
    sum = digits.reduce((acc, digit, idx) =>
      acc + digit * (idx % 2 === 0 ? 1 : 3), 0
    );
  } else {
    // GTIN-8, 12, 14: odd positions × 3, even positions × 1
    sum = digits.reduce((acc, digit, idx) =>
      acc + digit * (idx % 2 === 0 ? 3 : 1), 0
    );
  }

  const calculated = (10 - (sum % 10)) % 10;
  return checkDigit === calculated;
}

/**
 * Generate random GTIN with valid check digit
 */
export function generateRandomGtin(length: 8 | 12 | 13 | 14 = 13): string {
  const digits = Array.from({ length: length - 1 }, () =>
    Math.floor(Math.random() * 10)
  );

  let sum: number;

  if (length === 13) {
    sum = digits.reduce((acc, digit, idx) =>
      acc + digit * (idx % 2 === 0 ? 1 : 3), 0
    );
  } else {
    sum = digits.reduce((acc, digit, idx) =>
      acc + digit * (idx % 2 === 0 ? 3 : 1), 0
    );
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  return [...digits, checkDigit].join('');
}

/**
 * Wait for async operation with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return;

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create test timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Normalize Persian/Arabic digits to ASCII
 */
export function normalizePersianDigits(text: string): string {
  const persianDigits: Record<string, string> = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };

  const arabicDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };

  return text.split('').map(char =>
    persianDigits[char] || arabicDigits[char] || char
  ).join('');
}

/**
 * Check if value is approximately equal (for floating point comparisons)
 */
export function approxEqual(
  a: number,
  b: number,
  absTol = 0.02,
  relTol = 0.01
): boolean {
  const maxTol = Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b), 1.0));
  return Math.abs(a - b) <= maxTol;
}

/**
 * Create mock correlation ID
 */
export function createMockCorrelationId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create mock case ID
 */
export function createMockCaseId(): string {
  return `case-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Snapshot serializer for removing dynamic fields from snapshots
 */
export function sanitizeSnapshot(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeSnapshot);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip dynamic fields
      if (['timestamp', 'createdAt', 'updatedAt', 'received_at', 'correlation'].includes(key)) {
        sanitized[key] = '[DYNAMIC]';
      } else {
        sanitized[key] = sanitizeSnapshot(value);
      }
    }
    return sanitized;
  }

  return obj;
}
