/**
 * Value normalization
 * - Normalize numbers (handle locale: 1,234.56 vs 1.234,56)
 * - Parse currency symbols
 * - Normalize SKU (uppercase, trim)
 * - Validate GTIN (check digit)
 * - Handle Persian/Arabic digits (۱۲۳ → 123)
 */

export function normalizeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Already a number
  if (typeof value === 'number') {
    return value;
  }

  // Convert to string and normalize
  let str = String(value).trim();

  // Remove currency symbols
  str = removeCurrencySymbols(str);

  // Convert Persian/Arabic digits to ASCII
  str = convertPersianDigits(str);

  // Handle different decimal separators
  // Common patterns:
  // - 1,234.56 (US/UK)
  // - 1.234,56 (European)
  // - 1 234,56 (French)
  // - 1'234.56 (Swiss)

  // Remove spaces and quotes
  str = str.replace(/[\s']/g, '');

  // Determine decimal separator
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European format: 1.234,56
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,234.56
    str = str.replace(/,/g, '');
  }

  // Parse
  const num = parseFloat(str);

  return isNaN(num) ? null : num;
}

export function normalizeSKU(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Convert to string and normalize
  let sku = String(value).trim().toUpperCase();

  // Remove extra whitespace
  sku = sku.replace(/\s+/g, ' ');

  return sku || null;
}

export function normalizeGTIN(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Convert to string
  let gtin = String(value).trim();

  // Convert Persian/Arabic digits
  gtin = convertPersianDigits(gtin);

  // Remove non-digits
  gtin = gtin.replace(/\D/g, '');

  // GTIN must be 8, 12, 13, or 14 digits
  if (gtin.length !== 8 && gtin.length !== 12 && gtin.length !== 13 && gtin.length !== 14) {
    return null;
  }

  // Validate check digit
  if (!validateGTINCheckDigit(gtin)) {
    // Return anyway but flag as potentially invalid
    // The validator will create an issue
  }

  return gtin;
}

export function normalizeString(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  let str = String(value).trim();

  // Normalize whitespace
  str = str.replace(/\s+/g, ' ');

  return str || null;
}

export function normalizeCurrency(value: any): { amount: number | null; currency: string | null } {
  if (value === null || value === undefined || value === '') {
    return { amount: null, currency: null };
  }

  const str = String(value);

  // Detect currency
  const currency = detectCurrency(str);

  // Parse amount
  const amount = normalizeNumber(value);

  return { amount, currency };
}

function removeCurrencySymbols(str: string): string {
  const symbols = [
    '$', '€', '£', '¥', '₹', '₽', '₴', '₺',
    'USD', 'EUR', 'GBP', 'JPY', 'INR', 'RUB', 'UAH', 'TRY',
    'ریال', 'تومان', 'درهم'
  ];

  let cleaned = str;
  for (const symbol of symbols) {
    cleaned = cleaned.replace(new RegExp(symbol, 'g'), '');
  }

  return cleaned;
}

function detectCurrency(str: string): string | null {
  const currencyMap: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₽': 'RUB',
    '₴': 'UAH',
    '₺': 'TRY',
    'ریال': 'IRR',
    'تومان': 'IRR',
    'درهم': 'AED'
  };

  for (const [symbol, code] of Object.entries(currencyMap)) {
    if (str.includes(symbol)) {
      return code;
    }
  }

  // Check for ISO codes
  const isoCodes = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'RUB', 'UAH', 'TRY', 'IRR', 'AED'];
  for (const code of isoCodes) {
    if (str.includes(code)) {
      return code;
    }
  }

  return null;
}

function convertPersianDigits(str: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = str;

  // Convert Persian digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }

  // Convert Arabic digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }

  return result;
}

function validateGTINCheckDigit(gtin: string): boolean {
  if (!gtin || gtin.length < 8) {
    return false;
  }

  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < gtin.length - 1; i++) {
    const digit = parseInt(gtin[i], 10);
    const multiplier = (gtin.length - i - 1) % 2 === 0 ? 3 : 1;
    sum += digit * multiplier;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  const providedCheckDigit = parseInt(gtin[gtin.length - 1], 10);

  return checkDigit === providedCheckDigit;
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(texts: string[]): string | null {
  const persianChars = /[\u0600-\u06FF]/;
  let persianCount = 0;
  let totalCount = 0;

  for (const text of texts) {
    if (text && typeof text === 'string') {
      totalCount++;
      if (persianChars.test(text)) {
        persianCount++;
      }
    }
  }

  if (totalCount === 0) {
    return null;
  }

  if (persianCount / totalCount > 0.3) {
    return 'fa';
  }

  return 'en';
}
