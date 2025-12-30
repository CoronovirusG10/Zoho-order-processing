/**
 * Create Zoho Draft Activity (Temporal)
 *
 * Creates a draft sales order in Zoho Books using the resolved data.
 * Implements idempotency check (using caseId as external order key) and
 * queue fallback if Zoho is unavailable.
 *
 * Flow:
 * 1. Fetch the case data (including canonical order) from the API service
 * 2. Call the Zoho tools endpoint to create the draft sales order
 * 3. Handle transient errors by returning queued status
 */

import { log } from '@temporalio/activity';
import { getFeatureFlags } from '../config';

// Input/Output interfaces
export interface CreateZohoDraftInput {
  caseId: string;
}

export interface CreateZohoDraftOutput {
  success: boolean;
  salesorder_id?: string;
  salesorder_number?: string;
  status?: string;
  error?: string;
  queued?: boolean;
  is_duplicate?: boolean;
}

// API service URLs
const API_SERVICE_URL = process.env.API_SERVICE_URL || 'http://localhost:3000';

// Internal API key for service-to-service calls
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

/**
 * Interface for the case data returned by the API
 */
interface CaseData {
  caseId: string;
  tenantId: string;
  status: string;
  canonicalOrder?: unknown;
  [key: string]: unknown;
}

/**
 * Interface for the Zoho create draft response
 */
interface ZohoCreateDraftResponse {
  case_id: string;
  ok: boolean;
  zoho_salesorder_id?: string;
  zoho_salesorder_number?: string;
  is_duplicate?: boolean;
  warnings?: Array<{ code: string; message: string }>;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Creates a draft sales order in Zoho Books
 * @param input - The input containing caseId
 * @returns Zoho order creation result
 */
export async function createZohoDraft(input: CreateZohoDraftInput): Promise<CreateZohoDraftOutput> {
  const { caseId } = input;
  const flags = getFeatureFlags();

  log.info('Creating Zoho draft sales order', {
    caseId,
    zohoMode: flags.zohoMode,
    useMock: flags.useMockDraft,
  });

  // If mock mode is enabled, return mock success
  if (flags.useMockDraft) {
    log.info('Using mock Zoho draft creation (ZOHO_MODE=mock)', { caseId });
    return mockCreateZohoDraft(caseId);
  }

  try {
    // Step 1: Fetch the case data including canonical order
    log.info('Fetching case data', { caseId });
    const caseData = await fetchCaseData(caseId);

    if (!caseData.canonicalOrder) {
      log.error('Case does not have canonical order data', { caseId });
      return {
        success: false,
        error: 'Case does not have canonical order data. Parsing may not be complete.',
      };
    }

    // Step 2: Call Zoho tools endpoint to create draft
    log.info('Calling Zoho create draft endpoint', { caseId });
    const zohoResult = await callZohoCreateDraft(caseId, caseData.canonicalOrder);

    // Step 3: Handle the response
    if (zohoResult.ok) {
      log.info('Zoho draft created successfully', {
        caseId,
        salesorder_id: zohoResult.zoho_salesorder_id,
        salesorder_number: zohoResult.zoho_salesorder_number,
        is_duplicate: zohoResult.is_duplicate,
      });

      return {
        success: true,
        salesorder_id: zohoResult.zoho_salesorder_id,
        salesorder_number: zohoResult.zoho_salesorder_number,
        status: 'draft',
        is_duplicate: zohoResult.is_duplicate,
      };
    }

    // Handle errors from Zoho
    const errorMessages = zohoResult.errors?.map((e) => e.message).join('; ') || 'Unknown Zoho error';
    log.error('Zoho create draft failed', { caseId, errors: zohoResult.errors });

    return {
      success: false,
      error: errorMessages,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to create Zoho draft', { caseId, error: errorMessage });

    // Check if this is a transient error that should trigger queueing
    if (isTransientError(error)) {
      log.warn('Transient error detected, marking for queue', { caseId, error: errorMessage });
      return {
        success: false,
        queued: true,
        error: errorMessage,
      };
    }

    // For non-transient errors, throw to trigger Temporal retry
    throw error;
  }
}

/**
 * Fetch case data from the API service
 */
async function fetchCaseData(caseId: string): Promise<CaseData> {
  const url = `${API_SERVICE_URL}/internal/cases/${caseId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': INTERNAL_API_KEY,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case ${caseId} not found`);
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch case: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<CaseData>;
}

/**
 * Call the Zoho tools endpoint to create a draft sales order
 */
async function callZohoCreateDraft(
  caseId: string,
  canonicalOrder: unknown
): Promise<ZohoCreateDraftResponse> {
  const url = `${API_SERVICE_URL}/internal/tools/zoho/create-draft-salesorder`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': INTERNAL_API_KEY,
      'X-Correlation-ID': `workflow-${caseId}`,
    },
    body: JSON.stringify({
      case_id: caseId,
      canonical_order: canonicalOrder,
      // Use caseId as the idempotency key to prevent duplicate orders
      external_order_key: caseId,
    }),
  });

  // Handle transient HTTP errors
  if (response.status === 503 || response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new TransientError(
      `Zoho service temporarily unavailable: ${response.status}`,
      retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho create draft failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<ZohoCreateDraftResponse>;
}

/**
 * Custom error class for transient errors
 */
class TransientError extends Error {
  constructor(
    message: string,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'TransientError';
  }
}

/**
 * Check if an error is transient and should trigger queueing rather than failure
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof TransientError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('429') ||
      message.includes('temporarily unavailable') ||
      message.includes('network') ||
      message.includes('socket hang up')
    );
  }

  return false;
}

/**
 * Mock implementation for development/testing
 * Returns a simulated successful draft creation
 */
function mockCreateZohoDraft(caseId: string): CreateZohoDraftOutput {
  // Generate mock IDs based on caseId for consistency
  const mockOrderId = `mock-so-${caseId.substring(0, 8)}`;
  const mockOrderNumber = `SO-MOCK-${Date.now().toString(36).toUpperCase()}`;

  log.info('Mock Zoho draft created', {
    caseId,
    salesorder_id: mockOrderId,
    salesorder_number: mockOrderNumber,
  });

  return {
    success: true,
    salesorder_id: mockOrderId,
    salesorder_number: mockOrderNumber,
    status: 'draft',
    is_duplicate: false,
  };
}
