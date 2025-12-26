/**
 * Schema inference orchestration
 */

import { Worksheet } from 'exceljs';
import { SchemaInference } from '../types';
import { matchHeaders, getCanonicalFields } from './header-matcher';
import { calculateOverallConfidence, calculateStageConfidences } from './scoring';

export function inferSchema(
  worksheet: Worksheet,
  headerRow: number,
  sheetConfidence: number,
  headerConfidence: number
): SchemaInference {
  // Get canonical fields to map
  const canonicalFields = getCanonicalFields();

  // Match headers to canonical fields
  const columnMappings = matchHeaders(worksheet, headerRow, canonicalFields);

  // Calculate mapping confidence
  const mappingConfidence = calculateOverallConfidence(columnMappings);

  // Calculate overall confidence
  const stageConfidences = calculateStageConfidences(
    sheetConfidence,
    headerConfidence,
    mappingConfidence
  );

  const overallConfidence = (
    sheetConfidence * 0.2 +
    headerConfidence * 0.3 +
    mappingConfidence * 0.5
  );

  // Determine table region
  const tableRegion = determineTableRegion(worksheet, headerRow, columnMappings);

  return {
    selected_sheet: worksheet.name,
    table_region: tableRegion,
    header_row: headerRow,
    column_mappings: columnMappings,
    confidence: overallConfidence
  };
}

function determineTableRegion(
  worksheet: Worksheet,
  headerRow: number,
  columnMappings: any[]
): string {
  if (columnMappings.length === 0) {
    return 'A1:A1';
  }

  // Find min and max columns
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const mapping of columnMappings) {
    const colIndex = columnLetterToIndex(mapping.source_column);
    minCol = Math.min(minCol, colIndex);
    maxCol = Math.max(maxCol, colIndex);
  }

  // Find last row with data
  let lastRow = headerRow;
  for (let row = headerRow + 1; row <= worksheet.rowCount; row++) {
    const rowObj = worksheet.getRow(row);
    let hasData = false;

    for (let col = minCol; col <= maxCol; col++) {
      const cell = rowObj.getCell(col);
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      lastRow = row;
    }
  }

  const startCell = `${indexToColumnLetter(minCol)}${headerRow}`;
  const endCell = `${indexToColumnLetter(maxCol)}${lastRow}`;

  return `${startCell}:${endCell}`;
}

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index;
}

function indexToColumnLetter(index: number): string {
  let letter = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

export * from './header-matcher';
export * from './synonyms';
export * from './type-detector';
export * from './scoring';
