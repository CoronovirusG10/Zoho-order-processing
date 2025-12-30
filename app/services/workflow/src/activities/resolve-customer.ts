/**
 * Resolve Customer Activity (Temporal)
 *
 * Resolves the customer name from the parsed spreadsheet against Zoho Books customers.
 * Uses the Zoho service's CustomerMatcher for exact/fuzzy matching.
 * Returns candidates for user selection if multiple matches or low confidence.
 *
 * Flow:
 * 1. Retrieve case from repository to get parsed customer name
 * 2. Use Zoho CustomerMatcher to find matches
 * 3. Return resolved customer ID or candidates for human selection
 */

import { log } from '@temporalio/activity';
import { getFeatureFlags } from '../config';

/**
 * Cached customer structure from Zoho service
 * Defined locally to avoid direct dependency on @order-processing/zoho
 */
export interface CachedCustomer {
  zoho_customer_id: string;
  display_name: string;
  company_name: string;
  contact_type: string;
  status: string;
  email?: string;
  phone?: string;
  last_cached_at: string;
}

/**
 * Customer match result from Zoho's CustomerMatcher
 * Defined locally to avoid direct dependency on @order-processing/zoho
 */
export interface CustomerMatchResult {
  status: 'resolved' | 'ambiguous' | 'not_found' | 'needs_user_input';
  customer?: {
    zoho_customer_id: string;
    display_name: string;
  };
  method?: 'exact' | 'fuzzy' | 'user_selected';
  confidence: number;
  candidates: Array<{
    zoho_customer_id: string;
    display_name: string;
    score: number;
    match_reason?: string;
  }>;
}

// Input/Output interfaces
export interface ResolveCustomerInput {
  caseId: string;
  tenantId: string;
  correlationId: string;
  /** Optional: customer name override (if not reading from case) */
  customerName?: string;
}

export interface CustomerCandidate {
  zohoCustomerId: string;
  zohoCustomerName: string;
  companyName?: string;
  email?: string;
  score: number;
  matchReason?: string;
}

export interface ResolveCustomerOutput {
  success: boolean;
  resolved: boolean;
  needsHuman: boolean;
  zohoCustomerId?: string;
  zohoCustomerName?: string;
  confidence?: number;
  matchMethod?: 'exact' | 'fuzzy' | 'user_selected';
  candidates?: CustomerCandidate[];
  error?: string;
}

/**
 * Interface for the Zoho customer matching service
 * This abstracts the Zoho client for testability
 */
export interface IZohoCustomerService {
  /**
   * Get all cached customers for matching
   */
  getCustomers(): Promise<CachedCustomer[]>;

  /**
   * Search customers by name (API call if cache not available)
   */
  searchCustomers?(searchText: string): Promise<CachedCustomer[]>;
}

/**
 * Interface for the customer matcher
 * This abstracts the CustomerMatcher class for testability
 */
export interface ICustomerMatcher {
  matchCustomer(
    inputName: string,
    customers: CachedCustomer[]
  ): Promise<CustomerMatchResult>;
}

/**
 * Interface for Cases Repository
 * Defines the contract for case retrieval
 */
export interface ICasesRepository {
  getCase(caseId: string, tenantId: string): Promise<CaseData | null>;
}

/**
 * Minimal case data needed for customer resolution
 */
export interface CaseData {
  id: string;
  tenantId: string;
  canonicalData?: {
    customerInfo?: {
      name?: string;
      email?: string;
      phone?: string;
    };
  };
  // Parser's canonical format
  parsedData?: {
    customer?: {
      input_name: string | null;
    };
  };
}

// Dependencies - will be injected via activity context
let casesRepository: ICasesRepository | null = null;
let zohoCustomerService: IZohoCustomerService | null = null;
let customerMatcher: ICustomerMatcher | null = null;

/**
 * Initialize dependencies for the resolveCustomer activity
 * Called at worker startup to inject service dependencies
 *
 * @param cases - Cases repository instance
 * @param zohoService - Zoho customer service instance
 * @param matcher - Customer matcher instance
 */
export function initializeResolveCustomerActivity(
  cases: ICasesRepository,
  zohoService: IZohoCustomerService,
  matcher: ICustomerMatcher
): void {
  casesRepository = cases;
  zohoCustomerService = zohoService;
  customerMatcher = matcher;
  log.info('ResolveCustomer activity dependencies initialized');
}

/**
 * Check if dependencies are initialized
 */
export function isResolveCustomerInitialized(): boolean {
  return casesRepository !== null && zohoCustomerService !== null && customerMatcher !== null;
}

/**
 * Resolves a customer name against Zoho Books customers
 *
 * @param input - The input containing caseId, tenantId, and correlationId
 * @returns Resolution result with customer ID or candidates for selection
 */
export async function resolveCustomer(input: ResolveCustomerInput): Promise<ResolveCustomerOutput> {
  const { caseId, tenantId, correlationId, customerName: overrideName } = input;
  const flags = getFeatureFlags();

  log.info('Starting customer resolution', {
    caseId,
    tenantId,
    hasOverrideName: !!overrideName,
    zohoMode: flags.zohoMode,
    useMock: flags.useMockCustomer,
  });

  // If dependencies aren't initialized or mock mode is forced, use mock behavior
  const useMock = flags.useMockCustomer || !casesRepository || !zohoCustomerService || !customerMatcher;

  if (useMock) {
    log.info('Using mock customer resolution', {
      caseId,
      reason: flags.useMockCustomer ? 'ZOHO_MODE=mock' : 'Dependencies not initialized',
    });
    return mockResolveCustomer(overrideName || 'Mock Customer');
  }

  try {
    // Step 1: Get customer name (from override or case data)
    let customerName = overrideName;

    if (!customerName) {
      const caseData = await casesRepository.getCase(caseId, tenantId);

      if (!caseData) {
        log.error('Case not found', { caseId, tenantId });
        return {
          success: false,
          resolved: false,
          needsHuman: false,
          error: `Case not found: ${caseId}`,
        };
      }

      // Try workflow types format first, then parser format
      customerName = caseData.canonicalData?.customerInfo?.name
        || caseData.parsedData?.customer?.input_name
        || null;
    }

    if (!customerName || customerName.trim() === '') {
      log.warn('No customer name found in case', { caseId });
      return {
        success: true,
        resolved: false,
        needsHuman: true,
        candidates: [],
        error: 'No customer name found in parsed data',
      };
    }

    log.info('Customer name extracted', {
      caseId,
      customerName,
      nameLength: customerName.length,
    });

    // Step 2: Get customers from Zoho cache
    const customers = await zohoCustomerService.getCustomers();

    log.info('Retrieved customers for matching', {
      caseId,
      customerCount: customers.length,
    });

    if (customers.length === 0) {
      log.warn('No customers available in cache', { caseId });
      return {
        success: false,
        resolved: false,
        needsHuman: false,
        error: 'No customers available for matching (cache may be empty)',
      };
    }

    // Step 3: Perform customer matching
    const matchResult = await customerMatcher.matchCustomer(customerName, customers);

    log.info('Customer matching completed', {
      caseId,
      status: matchResult.status,
      confidence: matchResult.confidence,
      candidateCount: matchResult.candidates?.length || 0,
    });

    // Step 4: Map result to output format
    return mapMatchResultToOutput(matchResult, caseId);
  } catch (error) {
    log.error('Customer resolution failed', {
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      resolved: false,
      needsHuman: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Map CustomerMatchResult to ResolveCustomerOutput
 */
function mapMatchResultToOutput(
  result: CustomerMatchResult,
  caseId: string
): ResolveCustomerOutput {
  const candidates: CustomerCandidate[] = (result.candidates || []).map(c => ({
    zohoCustomerId: c.zoho_customer_id,
    zohoCustomerName: c.display_name,
    score: c.score,
    matchReason: c.match_reason,
  }));

  switch (result.status) {
    case 'resolved':
      log.info('Customer resolved successfully', {
        caseId,
        zohoCustomerId: result.customer?.zoho_customer_id,
        confidence: result.confidence,
        method: result.method,
      });

      return {
        success: true,
        resolved: true,
        needsHuman: false,
        zohoCustomerId: result.customer?.zoho_customer_id,
        zohoCustomerName: result.customer?.display_name,
        confidence: result.confidence,
        matchMethod: result.method,
        candidates,
      };

    case 'ambiguous':
      log.info('Customer match is ambiguous, needs human selection', {
        caseId,
        candidateCount: candidates.length,
        topScore: candidates[0]?.score,
      });

      return {
        success: true,
        resolved: false,
        needsHuman: true,
        confidence: result.confidence,
        candidates,
      };

    case 'needs_user_input':
      log.info('Low confidence match, needs human selection', {
        caseId,
        candidateCount: candidates.length,
        topScore: candidates[0]?.score,
      });

      return {
        success: true,
        resolved: false,
        needsHuman: true,
        confidence: result.confidence,
        candidates,
      };

    case 'not_found':
      log.warn('No customer matches found', { caseId });

      return {
        success: true,
        resolved: false,
        needsHuman: true,
        candidates: [],
      };

    default:
      log.warn('Unknown match status', { caseId, status: result.status });

      return {
        success: true,
        resolved: false,
        needsHuman: true,
        candidates,
      };
  }
}

/**
 * Mock implementation for development/testing
 */
function mockResolveCustomer(customerName: string): ResolveCustomerOutput {
  log.info('Using mock customer resolution', { customerName });

  // Simulate different scenarios based on customer name
  if (customerName.toLowerCase().includes('test')) {
    return {
      success: true,
      resolved: true,
      needsHuman: false,
      zohoCustomerId: 'mock-customer-12345',
      zohoCustomerName: `${customerName} (Test Customer)`,
      confidence: 1.0,
      matchMethod: 'exact',
      candidates: [{
        zohoCustomerId: 'mock-customer-12345',
        zohoCustomerName: `${customerName} (Test Customer)`,
        score: 1.0,
        matchReason: 'Mock exact match',
      }],
    };
  }

  if (customerName.toLowerCase().includes('ambiguous')) {
    return {
      success: true,
      resolved: false,
      needsHuman: true,
      confidence: 0.75,
      candidates: [
        {
          zohoCustomerId: 'mock-customer-001',
          zohoCustomerName: `${customerName} Ltd`,
          score: 0.85,
          matchReason: 'Fuzzy match on company name',
        },
        {
          zohoCustomerId: 'mock-customer-002',
          zohoCustomerName: `${customerName} Inc`,
          score: 0.82,
          matchReason: 'Fuzzy match on company name',
        },
      ],
    };
  }

  // Default: return a single high-confidence match
  return {
    success: true,
    resolved: true,
    needsHuman: false,
    zohoCustomerId: 'mock-customer-default',
    zohoCustomerName: customerName,
    confidence: 0.95,
    matchMethod: 'fuzzy',
    candidates: [{
      zohoCustomerId: 'mock-customer-default',
      zohoCustomerName: customerName,
      score: 0.95,
      matchReason: 'Mock fuzzy match',
    }],
  };
}
