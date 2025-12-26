/**
 * Resolve Customer Activity
 *
 * Resolves the customer name from the spreadsheet against Zoho Books customers.
 * Uses exact/fuzzy matching and provides candidates for user selection if needed.
 */

import { InvocationContext } from '@azure/functions';
import { ResolveCustomerInput, ResolveCustomerOutput } from '../types';

export async function resolveCustomerActivity(
  input: ResolveCustomerInput,
  context: InvocationContext
): Promise<ResolveCustomerOutput> {
  const { caseId } = input;

  context.log(`[${caseId}] Resolving customer against Zoho`);

  try {
    // TODO: Call Zoho service
    // POST /api/zoho/resolve-customer
    // Body: { caseId }
    // Returns: { resolved, needsHuman, zohoCustomerId, candidates }

    const zohoServiceUrl = process.env.ZOHO_SERVICE_URL || 'http://localhost:7073/api';

    // Mock implementation for now
    const resolutionResult: ResolveCustomerOutput = {
      success: true,
      resolved: true,
      needsHuman: false,
      zohoCustomerId: 'mock-customer-id',
      zohoCustomerName: 'Mock Customer Inc.',
      candidates: [],
    };

    context.log(`[${caseId}] Customer resolved: ${resolutionResult.zohoCustomerName}`);

    return resolutionResult;
  } catch (error) {
    context.error(`[${caseId}] Failed to resolve customer:`, error);
    throw error;
  }
}

export default resolveCustomerActivity;
