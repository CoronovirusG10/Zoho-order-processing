/**
 * Formula detection: scan all cells for formulas
 * If formulas exist in data range → BLOCK (severity: blocker) by default
 *
 * Policy options:
 * - 'strict': Block file if any formulas found (default, safest)
 * - 'warn': Allow file but flag formulas as warnings
 * - 'allow': Ignore formulas entirely
 */

import { Workbook, Worksheet } from 'exceljs';
import { FormulaReport, FormulaCell, ParserConfig, DEFAULT_PARSER_CONFIG } from './types';

export interface FormulaDetectionOptions {
  policy?: ParserConfig['formulaPolicy'];
}

export function detectFormulas(
  workbook: Workbook,
  options: FormulaDetectionOptions = {}
): FormulaReport {
  const policy = options.policy ?? DEFAULT_PARSER_CONFIG.formulaPolicy;

  // If policy is 'allow', skip detection entirely
  if (policy === 'allow') {
    return {
      hasFormulas: false,
      formulaCells: [],
      severity: 'info'
    };
  }

  const formulaCells: FormulaCell[] = [];

  workbook.worksheets.forEach((worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        // Check if cell has a formula
        if (cell.formula || cell.formulaType) {
          formulaCells.push({
            sheet: worksheet.name,
            cell: cell.address,
            formula: cell.formula?.toString() || cell.value?.toString() || ''
          });
        }

        // Also check if the value is a string starting with '='
        // This catches cases where formulas might be stored as text
        if (typeof cell.value === 'string' && cell.value.trim().startsWith('=')) {
          formulaCells.push({
            sheet: worksheet.name,
            cell: cell.address,
            formula: cell.value
          });
        }
      });
    });
  });

  // Determine severity based on policy
  let severity: 'blocker' | 'warning' | 'info';
  if (formulaCells.length === 0) {
    severity = 'info';
  } else if (policy === 'strict') {
    severity = 'blocker';
  } else {
    // policy === 'warn'
    severity = 'warning';
  }

  return {
    hasFormulas: formulaCells.length > 0,
    formulaCells,
    severity
  };
}

/**
 * Check if formulas exist in a specific range
 */
export function hasFormulasInRange(
  worksheet: Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): FormulaCell[] {
  const formulaCells: FormulaCell[] = [];

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getRow(row).getCell(col);

      if (cell.formula || cell.formulaType) {
        formulaCells.push({
          sheet: worksheet.name,
          cell: cell.address,
          formula: cell.formula?.toString() || cell.value?.toString() || ''
        });
      }

      if (typeof cell.value === 'string' && cell.value.trim().startsWith('=')) {
        formulaCells.push({
          sheet: worksheet.name,
          cell: cell.address,
          formula: cell.value
        });
      }
    }
  }

  return formulaCells;
}
