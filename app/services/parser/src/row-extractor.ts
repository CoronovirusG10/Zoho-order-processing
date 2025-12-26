/**
 * Row extraction: extract data rows with evidence
 * Skip total rows, handle merged cells
 *
 * Features:
 * - Detect and skip totals rows by keywords and patterns
 * - Handle merged cells (expand header merges, flag body merges)
 * - Normalize and track evidence for every extracted value
 */

import { Worksheet, Cell, CellValue } from 'exceljs';
import { ExtractedRow, ColumnMapping, EvidenceCell } from './types';

// Keywords that indicate total rows (English and Farsi)
const TOTAL_KEYWORDS = [
  // English
  'total', 'grand total', 'subtotal', 'sub total', 'sub-total', 'sum',
  'overall', 'final', 'net total', 'gross total', 'order total',
  'invoice total', 'amount due', 'balance', 'payable',
  // Farsi
  'جمع', 'مجموع', 'جمع کل', 'مجموع کل', 'جمع فرعی', 'جمع نهایی',
  'مبلغ کل', 'کل', 'قابل پرداخت', 'مانده'
];

/**
 * Information about merged cells in the worksheet
 */
interface MergedCellInfo {
  /** The master cell address (top-left of merge) */
  masterCell: string;
  /** Range of the merge (e.g., "A1:C1") */
  range: string;
  /** Start row of the merge */
  startRow: number;
  /** End row of the merge */
  endRow: number;
  /** Start column of the merge */
  startCol: number;
  /** End column of the merge */
  endCol: number;
}

/**
 * Get merged cell information for a worksheet
 */
function getMergedCells(worksheet: Worksheet): Map<string, MergedCellInfo> {
  const mergedCells = new Map<string, MergedCellInfo>();

  // ExcelJS stores merges as array of range strings
  if (worksheet.model && (worksheet.model as any).merges) {
    const merges: string[] = (worksheet.model as any).merges;

    for (const range of merges) {
      // Parse range like "A1:C3"
      const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (match) {
        const startCol = columnLetterToIndex(match[1].toUpperCase());
        const startRow = parseInt(match[2], 10);
        const endCol = columnLetterToIndex(match[3].toUpperCase());
        const endRow = parseInt(match[4], 10);

        // Master cell is top-left
        const masterCell = `${match[1].toUpperCase()}${startRow}`;

        const info: MergedCellInfo = {
          masterCell,
          range,
          startRow,
          endRow,
          startCol,
          endCol
        };

        // Map all cells in the merge to this info
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const cellAddr = `${indexToColumnLetter(col)}${row}`;
            mergedCells.set(cellAddr, info);
          }
        }
      }
    }
  }

  return mergedCells;
}

/**
 * Convert column letter to 1-based index
 */
function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index;
}

/**
 * Convert 1-based index to column letter
 */
function indexToColumnLetter(index: number): string {
  let letter = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

export interface ExtractedRowWithFlags extends ExtractedRow {
  /** Flags for any special conditions detected */
  flags: string[];
}

export function extractRows(
  worksheet: Worksheet,
  headerRow: number,
  columnMappings: ColumnMapping[]
): ExtractedRowWithFlags[] {
  const rows: ExtractedRowWithFlags[] = [];

  // Get merged cell information
  const mergedCells = getMergedCells(worksheet);

  // Build column index map
  const columnMap = new Map<string, string>();
  for (const mapping of columnMappings) {
    columnMap.set(mapping.canonical_field, mapping.source_column);
  }

  // Start from row after header
  const startRow = headerRow + 1;
  const endRow = worksheet.rowCount;

  for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
    const row = worksheet.getRow(rowNum);

    // Skip empty rows
    if (isRowEmpty(row)) {
      continue;
    }

    // Check if this is a total row
    const isTotal = isTotalRow(row, columnMap);

    // Extract cells for mapped columns
    const cells: Record<string, { value: any; evidence: EvidenceCell }> = {};
    const flags: string[] = [];

    for (const mapping of columnMappings) {
      const colLetter = mapping.source_column;
      const colIndex = columnLetterToIndex(colLetter);
      const cellAddress = `${colLetter}${rowNum}`;

      // Check for merged cell
      const mergeInfo = mergedCells.get(cellAddress);
      let cell = getCellByColumn(row, colLetter);

      if (mergeInfo) {
        // This cell is part of a merge
        if (mergeInfo.masterCell !== cellAddress) {
          // Not the master cell - get value from master
          const masterRow = worksheet.getRow(mergeInfo.startRow);
          const masterColLetter = mergeInfo.masterCell.replace(/\d+/, '');
          cell = getCellByColumn(masterRow, masterColLetter);

          // Flag that we used a merged cell value
          if (!flags.includes('MERGED_CELL_VALUE')) {
            flags.push('MERGED_CELL_VALUE');
          }
        }

        // Flag multi-row merges in body as suspicious
        if (mergeInfo.endRow > mergeInfo.startRow && mergeInfo.startRow > headerRow) {
          if (!flags.includes('MULTI_ROW_MERGE')) {
            flags.push('MULTI_ROW_MERGE');
          }
        }
      }

      if (cell) {
        cells[mapping.canonical_field] = {
          value: cell.value,
          evidence: {
            sheet: worksheet.name,
            cell: mergeInfo ? mergeInfo.masterCell : cell.address,
            raw_value: cell.value,
            display_value: cell.text,
            number_format: cell.numFmt || null
          }
        };
      }
    }

    // Only add row if it has at least one non-empty cell
    if (Object.keys(cells).length > 0) {
      rows.push({
        rowNumber: rowNum,
        cells,
        isTotal,
        flags
      });
    }
  }

  return rows;
}

function isRowEmpty(row: any): boolean {
  let hasValue = false;

  row.eachCell({ includeEmpty: false }, (cell: any) => {
    if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
      hasValue = true;
    }
  });

  return !hasValue;
}

function isTotalRow(row: any, columnMap: Map<string, string>): boolean {
  // Check if any cell contains total keywords
  let hasTotalKeyword = false;

  row.eachCell({ includeEmpty: false }, (cell: any) => {
    if (typeof cell.value === 'string') {
      const normalized = cell.value.toLowerCase().trim();
      if (TOTAL_KEYWORDS.some(kw => normalized.includes(kw))) {
        hasTotalKeyword = true;
      }
    }
  });

  if (hasTotalKeyword) {
    return true;
  }

  // Check if SKU/product_name is empty but line_total has value
  // This pattern often indicates a total row
  const skuCol = columnMap.get('sku');
  const productCol = columnMap.get('product_name');
  const totalCol = columnMap.get('line_total');

  if (skuCol || productCol) {
    const skuCell = skuCol ? getCellByColumn(row, skuCol) : null;
    const productCell = productCol ? getCellByColumn(row, productCol) : null;
    const totalCell = totalCol ? getCellByColumn(row, totalCol) : null;

    const skuEmpty = !skuCell || !skuCell.value;
    const productEmpty = !productCell || !productCell.value;
    const totalHasValue = totalCell && totalCell.value !== null && totalCell.value !== undefined;

    if ((skuEmpty || productEmpty) && totalHasValue) {
      return true;
    }
  }

  return false;
}

function getCellByColumn(row: any, columnLetter: string): any | null {
  try {
    const colIndex = columnLetterToIndex(columnLetter);
    return row.getCell(colIndex);
  } catch (error) {
    return null;
  }
}

/**
 * Extract customer information from sheet
 * Look for customer in header area or first few rows
 */
export function extractCustomer(
  worksheet: Worksheet,
  headerRow: number,
  columnMappings: ColumnMapping[]
): { value: string | null; evidence: EvidenceCell[] } {
  const customerMapping = columnMappings.find(m => m.canonical_field === 'customer');

  if (!customerMapping) {
    // Try to find customer in top rows (before header)
    return findCustomerInTopRows(worksheet, headerRow);
  }

  // Look in the data rows
  const rows = extractRows(worksheet, headerRow, columnMappings);

  for (const row of rows) {
    if (row.isTotal) continue;

    const customerCell = row.cells['customer'];
    if (customerCell && customerCell.value) {
      return {
        value: String(customerCell.value),
        evidence: [customerCell.evidence]
      };
    }
  }

  return { value: null, evidence: [] };
}

function findCustomerInTopRows(
  worksheet: Worksheet,
  headerRow: number
): { value: string | null; evidence: EvidenceCell[] } {
  const customerKeywords = [
    'customer', 'client', 'buyer', 'bill to', 'sold to',
    'مشتری', 'خریدار', 'طرف حساب'
  ];

  // Search rows 1 to headerRow-1
  for (let rowNum = 1; rowNum < headerRow; rowNum++) {
    const row = worksheet.getRow(rowNum);

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = cell.value;

      if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim();

        // Check if this cell contains a customer keyword
        const hasKeyword = customerKeywords.some(kw => normalized.includes(kw));

        if (hasKeyword) {
          // Next cell or cell below might have the customer name
          const nextCell = row.getCell(colNumber + 1);
          const belowRow = worksheet.getRow(rowNum + 1);
          const belowCell = belowRow.getCell(colNumber);

          if (nextCell.value && typeof nextCell.value === 'string') {
            return {
              value: nextCell.value.trim(),
              evidence: [{
                sheet: worksheet.name,
                cell: nextCell.address,
                raw_value: nextCell.value,
                display_value: nextCell.text
              }]
            };
          }

          if (belowCell.value && typeof belowCell.value === 'string') {
            return {
              value: belowCell.value.trim(),
              evidence: [{
                sheet: worksheet.name,
                cell: belowCell.address,
                raw_value: belowCell.value,
                display_value: belowCell.text
              }]
            };
          }
        }
      }
    });
  }

  return { value: null, evidence: [] };
}
