/**
 * Parse Excel Activity (Temporal)
 *
 * Calls the parser service to extract structured data from the Excel file.
 * Handles blocking scenarios (formulas, protected workbooks, multi-order).
 */

import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface ParseExcelInput {
  caseId: string;
}

export interface ParseIssue {
  code: string;
  severity: string;
  message: string;
}

export interface ParseExcelOutput {
  success: boolean;
  blocked: boolean;
  blockReason?: string;
  containsFormulas?: boolean;
  canonicalData?: unknown;
  issues?: ParseIssue[];
}

/**
 * Parses an Excel file and extracts structured data
 * @param input - The input containing caseId
 * @returns Parse result with canonical data or blocking information
 */
export async function parseExcel(input: ParseExcelInput): Promise<ParseExcelOutput> {
  const { caseId } = input;

  log.info(`[${caseId}] Parsing Excel file`);

  try {
    // TODO: Call parser service
    // POST /api/parse
    // Body: { caseId }
    // Returns: { blocked, blockReason, containsFormulas, canonicalData, issues }

    const parserServiceUrl = process.env.PARSER_SERVICE_URL || 'http://localhost:7071/api';

    // Mock implementation for now
    const parseResult: ParseExcelOutput = {
      success: true,
      blocked: false,
      containsFormulas: false,
      canonicalData: {
        // Would contain the canonical sales order structure
      },
      issues: [],
    };

    log.info(`[${caseId}] Excel parsed successfully. Issues: ${parseResult.issues?.length || 0}`);

    return parseResult;
  } catch (error) {
    log.error(`[${caseId}] Failed to parse Excel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
