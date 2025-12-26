/**
 * Common validators for GTINs, SKUs, currency, and quantities
 */


/**
 * GTIN validation result
 */
export interface GtinValidationResult {
  valid: boolean;
  normalized?: string;
  type?: 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14';
  error?: string;
}

/**
 * Calculate GTIN check digit using the standard algorithm
 */
function calculateGtinCheckDigit(digits: string): number {
  let sum = 0;
  const length = digits.length;

  for (let i = 0; i < length; i++) {
    const digit = parseInt(digits[i], 10);
    // Weight alternates between 3 and 1, starting from right
    const weight = (length - i) % 2 === 0 ? 1 : 3;
    sum += digit * weight;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validate GTIN (8, 12, 13, or 14 digits) with check digit verification
 */
export function validateGtin(gtin: string | null | undefined): GtinValidationResult {
  if (!gtin) {
    return { valid: false, error: 'GTIN is empty' };
  }

  // Remove whitespace and non-numeric characters
  const cleaned = gtin.replace(/\s+/g, '').replace(/[^0-9]/g, '');

  // Check length
  const validLengths = [8, 12, 13, 14];
  if (!validLengths.includes(cleaned.length)) {
    return {
      valid: false,
      error: `GTIN must be 8, 12, 13, or 14 digits (got ${cleaned.length})`,
    };
  }

  // Verify check digit
  const digits = cleaned.slice(0, -1);
  const checkDigit = parseInt(cleaned.slice(-1), 10);
  const calculatedCheckDigit = calculateGtinCheckDigit(digits);

  if (checkDigit !== calculatedCheckDigit) {
    return {
      valid: false,
      error: `Invalid check digit (expected ${calculatedCheckDigit}, got ${checkDigit})`,
    };
  }

  // Determine type
  const typeMap: Record<number, 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14'> = {
    8: 'GTIN-8',
    12: 'GTIN-12',
    13: 'GTIN-13',
    14: 'GTIN-14',
  };

  return {
    valid: true,
    normalized: cleaned,
    type: typeMap[cleaned.length],
  };
}

/**
 * Normalize SKU by trimming and converting to uppercase
 */
export function normalizeSku(sku: string | null | undefined): string | null {
  if (!sku) {
    return null;
  }

  // Trim whitespace and convert to uppercase
  const normalized = sku.trim().toUpperCase();

  // Return null if empty after normalization
  return normalized.length > 0 ? normalized : null;
}

/**
 * Parse currency value from string
 */
export function parseCurrency(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  // Remove common currency symbols and separators
  const cleaned = value
    .replace(/[$€£¥₹]/g, '') // Currency symbols
    .replace(/,/g, '') // Thousand separators
    .replace(/\s+/g, '') // Whitespace
    .trim();

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return null;
  }

  // Round to 2 decimal places for currency
  return Math.round(parsed * 100) / 100;
}

/**
 * Validate quantity (must be >= 0, decimals allowed)
 */
export function validateQuantity(
  quantity: number | string | null | undefined
): { valid: boolean; value?: number; error?: string } {
  if (quantity === null || quantity === undefined || quantity === '') {
    return { valid: false, error: 'Quantity is required' };
  }

  const value = typeof quantity === 'string' ? parseFloat(quantity) : quantity;

  if (isNaN(value)) {
    return { valid: false, error: 'Quantity must be a number' };
  }

  if (value < 0) {
    return { valid: false, error: 'Quantity cannot be negative' };
  }

  return { valid: true, value };
}

/**
 * Validate that a number is within tolerance of expected value
 */
export function isWithinTolerance(
  actual: number,
  expected: number,
  options: {
    absoluteTolerance?: number;
    relativeTolerance?: number;
  } = {}
): boolean {
  const { absoluteTolerance = 0.02, relativeTolerance = 0.01 } = options;

  const diff = Math.abs(actual - expected);
  const maxDiff = Math.max(
    absoluteTolerance,
    relativeTolerance * Math.max(Math.abs(actual), Math.abs(expected), 1.0)
  );

  return diff <= maxDiff;
}

/**
 * Validate arithmetic: quantity * unitPrice ≈ lineTotal
 */
export function validateLineArithmetic(
  quantity: number,
  unitPrice: number,
  lineTotal: number,
  options?: {
    absoluteTolerance?: number;
    relativeTolerance?: number;
  }
): { valid: boolean; expected?: number; actual: number; error?: string } {
  const expected = quantity * unitPrice;
  const valid = isWithinTolerance(lineTotal, expected, options);

  if (!valid) {
    return {
      valid: false,
      expected,
      actual: lineTotal,
      error: `Line total mismatch: expected ${expected.toFixed(2)}, got ${lineTotal.toFixed(2)}`,
    };
  }

  return { valid: true, expected, actual: lineTotal };
}

/**
 * Validate email format
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function validateUuid(uuid: string | null | undefined): boolean {
  if (!uuid) {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate ISO 8601 date format
 */
export function validateIsoDate(date: string | null | undefined): boolean {
  if (!date) {
    return false;
  }

  const parsed = new Date(date);
  return !isNaN(parsed.getTime()) && parsed.toISOString() === date;
}
