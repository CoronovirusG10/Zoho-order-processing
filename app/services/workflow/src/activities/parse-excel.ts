/**
 * Parse Excel Activity
 *
 * Calls the parser service to extract structured data from the Excel file.
 * Handles blocking scenarios (formulas, protected workbooks, multi-order).
 */

import { InvocationContext } from '@azure/functions';
import { ParseExcelInput, ParseExcelOutput } from '../types';

export async function parseExcelActivity(
  input: ParseExcelInput,
  context: InvocationContext
): Promise<ParseExcelOutput> {
  const { caseId } = input;

  context.log(`[${caseId}] Parsing Excel file`);

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

    context.log(`[${caseId}] Excel parsed successfully. Issues: ${parseResult.issues?.length || 0}`);

    return parseResult;
  } catch (error) {
    context.error(`[${caseId}] Failed to parse Excel:`, error);
    throw error;
  }
}

export default parseExcelActivity;
