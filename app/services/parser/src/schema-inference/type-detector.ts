/**
 * Column type detection from values
 */

import { Worksheet } from 'exceljs';
import { TypeDetectionResult } from '../types';

export function detectColumnType(
  worksheet: Worksheet,
  columnIndex: number,
  startRow: number,
  endRow: number,
  sampleSize: number = 50
): TypeDetectionResult {
  const samples: any[] = [];
  let numericCount = 0;
  let textCount = 0;
  let emptyCount = 0;
  let integerCount = 0;
  let decimalCount = 0;
  let currencyCount = 0;
  let dateCount = 0;

  const maxSamples = Math.min(endRow - startRow + 1, sampleSize);

  for (let row = startRow; row <= endRow && samples.length < maxSamples; row++) {
    const cell = worksheet.getRow(row).getCell(columnIndex);
    const value = cell.value;

    if (value === null || value === undefined || value === '') {
      emptyCount++;
      continue;
    }

    samples.push(value);

    // Check type
    if (typeof value === 'number') {
      numericCount++;

      if (Number.isInteger(value)) {
        integerCount++;
      } else {
        decimalCount++;
      }

      // Check for currency formatting
      if (cell.numFmt && isCurrencyFormat(cell.numFmt)) {
        currencyCount++;
      }
    } else if (typeof value === 'string') {
      textCount++;

      // Check if string represents a number with currency symbol
      if (isCurrencyString(value)) {
        currencyCount++;
      }
    } else if (value instanceof Date) {
      dateCount++;
    }
  }

  const total = samples.length + emptyCount;
  const nonEmpty = samples.length;

  // Determine type and confidence
  if (nonEmpty === 0) {
    return {
      type: 'empty',
      confidence: 1.0,
      samples: [],
      stats: { numeric: 0, text: 0, empty: emptyCount, total }
    };
  }

  // Currency
  if (currencyCount > nonEmpty * 0.5) {
    return {
      type: 'currency',
      confidence: currencyCount / nonEmpty,
      samples: samples.slice(0, 5),
      stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
    };
  }

  // Integer
  if (integerCount > nonEmpty * 0.8) {
    return {
      type: 'integer',
      confidence: integerCount / nonEmpty,
      samples: samples.slice(0, 5),
      stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
    };
  }

  // Decimal/number
  if (numericCount > nonEmpty * 0.8) {
    return {
      type: decimalCount > integerCount ? 'decimal' : 'number',
      confidence: numericCount / nonEmpty,
      samples: samples.slice(0, 5),
      stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
    };
  }

  // Date
  if (dateCount > nonEmpty * 0.7) {
    return {
      type: 'date',
      confidence: dateCount / nonEmpty,
      samples: samples.slice(0, 5),
      stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
    };
  }

  // Text
  if (textCount > nonEmpty * 0.7) {
    return {
      type: 'text',
      confidence: textCount / nonEmpty,
      samples: samples.slice(0, 5),
      stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
    };
  }

  // Mixed
  return {
    type: 'mixed',
    confidence: 0.5,
    samples: samples.slice(0, 5),
    stats: { numeric: numericCount, text: textCount, empty: emptyCount, total }
  };
}

function isCurrencyFormat(format: string): boolean {
  const currencyPatterns = [
    /\$/, /€/, /£/, /¥/, /₹/, /ریال/, /تومان/,
    /#,##0\.00/, /0\.00/
  ];

  return currencyPatterns.some(pattern => pattern.test(format));
}

function isCurrencyString(value: string): boolean {
  const currencySymbols = ['$', '€', '£', '¥', '₹', 'ریال', 'تومان'];
  return currencySymbols.some(symbol => value.includes(symbol));
}

/**
 * Check if column type is compatible with canonical field
 */
export function isTypeCompatible(
  detectedType: string,
  canonicalField: string
): { compatible: boolean; confidence: number } {
  const typeRequirements: Record<string, string[]> = {
    sku: ['text', 'mixed'],
    gtin: ['text', 'integer', 'number', 'mixed'],
    product_name: ['text', 'mixed'],
    quantity: ['integer', 'number', 'decimal'],
    unit_price: ['number', 'decimal', 'currency'],
    line_total: ['number', 'decimal', 'currency'],
    customer: ['text', 'mixed'],
    subtotal: ['number', 'decimal', 'currency'],
    tax: ['number', 'decimal', 'currency'],
    total: ['number', 'decimal', 'currency']
  };

  const required = typeRequirements[canonicalField];
  if (!required) {
    return { compatible: true, confidence: 0.5 };
  }

  if (required.includes(detectedType)) {
    return { compatible: true, confidence: 1.0 };
  }

  // Partial compatibility
  if (detectedType === 'mixed') {
    return { compatible: true, confidence: 0.6 };
  }

  return { compatible: false, confidence: 0.0 };
}
