/**
 * Resolve Items Activity (Temporal)
 *
 * Resolves line items from the spreadsheet against Zoho Books items catalog.
 * Primary: SKU match, Fallback: GTIN (custom field), Tertiary: fuzzy name match.
 */

import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface ResolveItemsInput {
  caseId: string;
}

export interface ItemCandidate {
  zohoItemId: string;
  sku?: string;
  name: string;
  gtin?: string;
  score: number;
}

export interface ResolveItemsOutput {
  success: boolean;
  allResolved: boolean;
  needsHuman: boolean;
  unresolvedLines?: number[];
  candidates?: Record<number, ItemCandidate[]>;
}

/**
 * Resolves line items against Zoho Books catalog
 * @param input - The input containing caseId
 * @returns Resolution result with item IDs or candidates for selection
 */
export async function resolveItems(input: ResolveItemsInput): Promise<ResolveItemsOutput> {
  const { caseId } = input;

  log.info(`[${caseId}] Resolving line items against Zoho catalog`);

  try {
    // TODO: Call Zoho service
    // POST /api/zoho/resolve-items
    // Body: { caseId }
    // Returns: { allResolved, needsHuman, unresolvedLines, candidates }

    const zohoServiceUrl = process.env.ZOHO_SERVICE_URL || 'http://localhost:7073/api';

    // Mock implementation for now
    const resolutionResult: ResolveItemsOutput = {
      success: true,
      allResolved: true,
      needsHuman: false,
      unresolvedLines: [],
      candidates: {},
    };

    log.info(`[${caseId}] Items resolved. All resolved: ${resolutionResult.allResolved}`);

    return resolutionResult;
  } catch (error) {
    log.error(`[${caseId}] Failed to resolve items: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
