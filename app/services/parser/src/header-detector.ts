/**
 * Header detection: scan first N rows for header patterns
 * Score based on: text variety, position, formatting
 */

import { Worksheet, Row } from 'exceljs';
import { HeaderDetection, HeaderCandidate } from './types';

const MAX_HEADER_SEARCH_ROWS = 10;

export function detectHeaderRow(worksheet: Worksheet): HeaderDetection {
  const candidates: HeaderCandidate[] = [];

  // Scan first N rows
  for (let rowNum = 1; rowNum <= MAX_HEADER_SEARCH_ROWS; rowNum++) {
    const row = worksheet.getRow(rowNum);

    // Skip empty rows
    if (isRowEmpty(row)) {
      continue;
    }

    const score = scoreAsHeader(row, rowNum, worksheet);
    if (score.score > 0.3) {
      candidates.push({
        rowNumber: rowNum,
        score: score.score,
        headers: score.headers,
        reason: score.reason
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const headerRow = candidates.length > 0 ? candidates[0].rowNumber : null;
  const confidence = candidates.length > 0 ? candidates[0].score : 0;

  return {
    headerRow,
    confidence,
    candidates
  };
}

function scoreAsHeader(
  row: Row,
  rowNumber: number,
  worksheet: Worksheet
): { score: number; headers: string[]; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const headers: string[] = [];
  let textCellCount = 0;
  let uniqueValues = new Set<string>();

  row.eachCell({ includeEmpty: false }, (cell) => {
    const value = cell.value;

    // Headers should be text
    if (typeof value === 'string') {
      textCellCount++;
      const normalized = value.trim().toLowerCase();
      if (normalized.length > 0) {
        uniqueValues.add(normalized);
        headers.push(value.trim());
      }
    }
  });

  // Must have at least 2 text cells
  if (textCellCount < 2) {
    return { score: 0, headers: [], reason: 'too few text cells' };
  }

  // Position score (prefer rows 1-5)
  if (rowNumber === 1) {
    score += 0.3;
    reasons.push('first row');
  } else if (rowNumber <= 3) {
    score += 0.2;
    reasons.push('early row');
  } else if (rowNumber <= 5) {
    score += 0.1;
  }

  // Variety score (unique values)
  const varietyRatio = uniqueValues.size / textCellCount;
  if (varietyRatio > 0.8) {
    score += 0.3;
    reasons.push('high variety');
  } else if (varietyRatio > 0.6) {
    score += 0.2;
  }

  // Text cell count score
  if (textCellCount >= 3) {
    score += 0.2;
    reasons.push(`${textCellCount} text cells`);
  }

  // Check if row below has different types (data vs header)
  if (rowNumber < worksheet.rowCount) {
    const nextRow = worksheet.getRow(rowNumber + 1);
    if (hasNumericCells(nextRow) && !hasNumericCells(row)) {
      score += 0.2;
      reasons.push('data follows');
    }
  }

  // Check for common header keywords
  const headerKeywords = [
    'sku', 'item', 'code', 'product', 'description', 'name',
    'qty', 'quantity', 'price', 'total', 'amount',
    'customer', 'client', 'buyer',
    'gtin', 'ean', 'barcode',
    'کد', 'کالا', 'محصول', 'نام', 'شرح',
    'تعداد', 'مقدار', 'قیمت', 'جمع', 'مبلغ',
    'مشتری', 'خریدار', 'بارکد'
  ];

  let keywordMatches = 0;
  headers.forEach((header) => {
    const normalized = header.toLowerCase();
    if (headerKeywords.some(kw => normalized.includes(kw))) {
      keywordMatches++;
    }
  });

  if (keywordMatches >= 2) {
    score += 0.2;
    reasons.push(`${keywordMatches} keyword matches`);
  } else if (keywordMatches >= 1) {
    score += 0.1;
  }

  return {
    score: Math.min(score, 1.0),
    headers,
    reason: reasons.join(', ')
  };
}

function isRowEmpty(row: Row): boolean {
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
      hasValue = true;
    }
  });
  return !hasValue;
}

function hasNumericCells(row: Row): boolean {
  let numericCount = 0;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (typeof cell.value === 'number') {
      numericCount++;
    }
  });
  return numericCount >= 1;
}
