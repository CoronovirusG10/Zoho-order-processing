/**
 * Sheet selection: score each sheet for "order-like" structure
 * - Has header row
 * - Has numeric columns (qty, price)
 * - Density of data
 *
 * If multiple sheets score above threshold with small gap, returns
 * requiresUserChoice=true to prompt user for selection
 */

import { Workbook, Worksheet } from 'exceljs';
import { SheetSelection, SheetCandidate, ParserConfig, DEFAULT_PARSER_CONFIG } from './types';

export interface SheetSelectionOptions {
  /**
   * Minimum score threshold for a sheet to be considered viable
   */
  threshold?: number;
  /**
   * Minimum gap between top two candidates to auto-select
   */
  minGap?: number;
}

export function selectBestSheet(
  workbook: Workbook,
  options: SheetSelectionOptions = {}
): SheetSelection {
  const threshold = options.threshold ?? DEFAULT_PARSER_CONFIG.sheetSelectionThreshold;
  const minGap = options.minGap ?? DEFAULT_PARSER_CONFIG.sheetSelectionMinGap;

  const candidates: SheetCandidate[] = [];

  workbook.worksheets.forEach((worksheet) => {
    // Skip hidden sheets
    if (worksheet.state === 'hidden' || worksheet.state === 'veryHidden') {
      return;
    }

    const score = scoreSheet(worksheet);
    if (score.score > 0) {
      candidates.push(score);
    }
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // No candidates found
  if (candidates.length === 0) {
    return {
      selectedSheet: '',
      confidence: 0,
      candidates: [],
      requiresUserChoice: false,
      status: 'none'
    };
  }

  const topCandidate = candidates[0];

  // Only one candidate or single viable sheet
  if (candidates.length === 1) {
    return {
      selectedSheet: topCandidate.name,
      confidence: topCandidate.score,
      candidates,
      requiresUserChoice: false,
      status: topCandidate.score >= threshold ? 'selected' : 'none'
    };
  }

  const secondCandidate = candidates[1];
  const scoreGap = topCandidate.score - secondCandidate.score;

  // Check if multiple sheets are viable candidates
  const viableCandidates = candidates.filter(c => c.score >= threshold);

  // If multiple viable candidates and gap is small, require user choice
  if (viableCandidates.length > 1 && scoreGap < minGap) {
    return {
      selectedSheet: topCandidate.name, // Still suggest the top one
      confidence: topCandidate.score,
      candidates: viableCandidates, // Only return viable ones
      requiresUserChoice: true,
      status: 'ambiguous'
    };
  }

  // Clear winner
  return {
    selectedSheet: topCandidate.name,
    confidence: topCandidate.score,
    candidates,
    requiresUserChoice: false,
    status: topCandidate.score >= threshold ? 'selected' : 'none'
  };
}

function scoreSheet(worksheet: Worksheet): SheetCandidate {
  const stats = analyzeSheet(worksheet);
  let score = 0;
  const reasons: string[] = [];

  // Base score for having data
  if (stats.rowCount > 0 && stats.columnCount > 0) {
    score += 0.1;
  }

  // Density score (0-0.3)
  if (stats.density > 0.5) {
    score += stats.density * 0.3;
    reasons.push(`good density (${(stats.density * 100).toFixed(0)}%)`);
  }

  // Row count score (prefer 5-1000 rows)
  if (stats.rowCount >= 5 && stats.rowCount <= 1000) {
    score += 0.2;
    reasons.push(`suitable row count (${stats.rowCount})`);
  } else if (stats.rowCount > 1000) {
    score += 0.1;
  }

  // Column count score (prefer 3-20 columns)
  if (stats.columnCount >= 3 && stats.columnCount <= 20) {
    score += 0.1;
    reasons.push(`suitable column count (${stats.columnCount})`);
  }

  // Has numeric columns (likely quantities/prices)
  if (stats.hasNumericColumns) {
    score += 0.2;
    reasons.push('has numeric columns');
  }

  // Has text columns (likely descriptions/SKUs)
  if (stats.hasTextColumns) {
    score += 0.1;
    reasons.push('has text columns');
  }

  return {
    name: worksheet.name,
    score: Math.min(score, 1.0),
    reason: reasons.join(', '),
    stats
  };
}

function analyzeSheet(worksheet: Worksheet): {
  rowCount: number;
  columnCount: number;
  density: number;
  hasNumericColumns: boolean;
  hasTextColumns: boolean;
} {
  let rowCount = 0;
  let columnCount = 0;
  let totalCells = 0;
  let filledCells = 0;
  const columnTypes = new Map<number, { numeric: number; text: number }>();

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    rowCount = Math.max(rowCount, rowNumber);

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      columnCount = Math.max(columnCount, colNumber);
      filledCells++;

      // Track column types
      if (!columnTypes.has(colNumber)) {
        columnTypes.set(colNumber, { numeric: 0, text: 0 });
      }

      const types = columnTypes.get(colNumber)!;
      if (typeof cell.value === 'number') {
        types.numeric++;
      } else if (typeof cell.value === 'string') {
        types.text++;
      }
    });
  });

  totalCells = rowCount * columnCount;
  const density = totalCells > 0 ? filledCells / totalCells : 0;

  // Check if we have predominantly numeric and text columns
  let numericColumns = 0;
  let textColumns = 0;

  columnTypes.forEach((types) => {
    if (types.numeric > types.text && types.numeric > 3) {
      numericColumns++;
    }
    if (types.text > types.numeric && types.text > 3) {
      textColumns++;
    }
  });

  return {
    rowCount,
    columnCount,
    density,
    hasNumericColumns: numericColumns >= 1,
    hasTextColumns: textColumns >= 1
  };
}
