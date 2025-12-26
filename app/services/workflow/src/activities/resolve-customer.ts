/**
 * Resolve Customer Activity (Temporal)
 *
 * Resolves the customer name from the spreadsheet against Zoho Books customers.
 * Uses exact/fuzzy matching and provides candidates for user selection if needed.
 */

import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface ResolveCustomerInput {
  caseId: string;
}

export interface CustomerCandidate {
  zohoCustomerId: string;
  zohoCustomerName: string;
  score: number;
}

export interface ResolveCustomerOutput {
  success: boolean;
  resolved: boolean;
  needsHuman: boolean;
  zohoCustomerId?: string;
  zohoCustomerName?: string;
  candidates?: CustomerCandidate[];
}

/**
 * Resolves a customer against Zoho Books
 * @param input - The input containing caseId
 * @returns Resolution result with customer ID or candidates for selection
 */
export async function resolveCustomer(input: ResolveCustomerInput): Promise<ResolveCustomerOutput> {
  const { caseId } = input;

  log.info(`[${caseId}] Resolving customer against Zoho`);

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

    log.info(`[${caseId}] Customer resolved: ${resolutionResult.zohoCustomerName}`);

    return resolutionResult;
  } catch (error) {
    log.error(`[${caseId}] Failed to resolve customer: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
