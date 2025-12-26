/**
 * Resolve Items Activity
 *
 * Resolves line items from the spreadsheet against Zoho Books items catalog.
 * Primary: SKU match, Fallback: GTIN (custom field), Tertiary: fuzzy name match.
 */

import { InvocationContext } from '@azure/functions';
import { ResolveItemsInput, ResolveItemsOutput } from '../types';

export async function resolveItemsActivity(
  input: ResolveItemsInput,
  context: InvocationContext
): Promise<ResolveItemsOutput> {
  const { caseId } = input;

  context.log(`[${caseId}] Resolving line items against Zoho catalog`);

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

    context.log(`[${caseId}] Items resolved. All resolved: ${resolutionResult.allResolved}`);

    return resolutionResult;
  } catch (error) {
    context.error(`[${caseId}] Failed to resolve items:`, error);
    throw error;
  }
}

export default resolveItemsActivity;
