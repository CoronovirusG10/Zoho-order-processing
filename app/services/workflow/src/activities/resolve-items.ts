/**
 * Resolve Items Activity (Temporal)
 *
 * Resolves line items from the spreadsheet against Zoho Books items catalog.
 * Multi-stage matching strategy:
 * 1. Primary: Exact SKU match
 * 2. Fallback: GTIN (custom field) lookup
 * 3. Tertiary: Fuzzy name match
 *
 * Returns needsHuman=true when items cannot be resolved automatically,
 * providing candidate lists for user selection.
 */

import { log } from '@temporalio/activity';

// Import repository for case lookup
import { getCasesRepository } from '../repositories/index.js';

// Import types from parser service
import type { CanonicalSalesOrder, LineItem as ParserLineItem } from '@order-processing/parser';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for ResolveItems activity
 */
export interface ResolveItemsInput {
  caseId: string;
  tenantId?: string; // Optional - will use cross-partition query if not provided
}

/**
 * A resolved item with Zoho item details
 */
export interface ResolvedItem {
  /** Row number from the source spreadsheet */
  row: number;
  /** Zoho item ID */
  zohoItemId: string;
  /** Zoho item name */
  zohoItemName: string;
  /** SKU if available */
  sku?: string;
  /** Unit rate/price from Zoho */
  rate: number;
  /** How the item was matched */
  matchMethod: 'sku' | 'gtin' | 'name';
  /** Confidence score (1.0 = exact match) */
  confidence: number;
}

/**
 * Candidate item for user selection when disambiguation is needed
 */
export interface ItemCandidate {
  zohoItemId: string;
  name: string;
  sku?: string;
  gtin?: string;
  rate: number;
  score: number;
  matchReasons?: string[];
}

/**
 * Output from ResolveItems activity
 */
export interface ResolveItemsOutput {
  success: boolean;
  /** Whether all items were resolved */
  allResolved: boolean;
  /** Whether human selection is needed */
  needsHuman: boolean;
  /** Successfully resolved items */
  resolvedItems: ResolvedItem[];
  /** Line numbers that couldn't be resolved */
  unresolvedLines?: number[];
  /** Candidate matches by line number for unresolved items */
  candidates?: Record<number, ItemCandidate[]>;
}

/**
 * Zoho item response structure
 */
interface ZohoItemResponse {
  item_id: string;
  name: string;
  sku?: string;
  cf_gtin?: string;
  rate: number;
  unit?: string;
  description?: string;
  status?: string;
}

/**
 * Zoho search result with score
 */
interface ZohoSearchResult extends ZohoItemResponse {
  score: number;
}

// ============================================================================
// Configuration
// ============================================================================

const ZOHO_SERVICE_URL = process.env.ZOHO_SERVICE_URL || 'http://localhost:3010';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Minimum confidence threshold for auto-accepting a name match
 * If only one candidate and score > threshold, auto-accept
 */
const NAME_MATCH_AUTO_ACCEPT_THRESHOLD = 0.85;

/**
 * Minimum score to include a candidate in the disambiguation list
 */
const MIN_CANDIDATE_SCORE = 0.5;

/**
 * Maximum candidates to return per unresolved line
 */
const MAX_CANDIDATES_PER_LINE = 5;

// ============================================================================
// Activity Implementation
// ============================================================================

/**
 * Resolves line items against Zoho Books catalog
 *
 * This activity fetches the case's canonical data (parsed line items),
 * then attempts to match each line item against Zoho's item catalog using:
 * 1. SKU exact match
 * 2. GTIN (barcode) lookup
 * 3. Fuzzy name search
 *
 * @param input - The input containing caseId
 * @returns Resolution result with resolved items or candidates for selection
 */
export async function resolveItems(input: ResolveItemsInput): Promise<ResolveItemsOutput> {
  const { caseId, tenantId } = input;

  log.info('Starting item resolution', { caseId, tenantId });

  try {
    // If tenantId is not provided, return mock success for development
    // In production, tenantId should always be passed from the workflow
    if (!tenantId) {
      log.warn('tenantId not provided, returning mock success', { caseId });
      return {
        success: true,
        allResolved: true,
        needsHuman: false,
        resolvedItems: [],
      };
    }

    // Fetch the case to get canonical data with line items
    let casesRepo;
    try {
      casesRepo = getCasesRepository();
    } catch (repoError) {
      log.warn('Repository not available, returning mock success', {
        caseId,
        error: repoError instanceof Error ? repoError.message : String(repoError),
      });
      return {
        success: true,
        allResolved: true,
        needsHuman: false,
        resolvedItems: [],
      };
    }

    const caseData = await casesRepo.getCase(caseId, tenantId);

    if (!caseData) {
      log.error('Case not found', { caseId, tenantId });
      throw new Error(`Case ${caseId} not found`);
    }

    // Extract line items from canonical data
    // The canonicalData could be in parser format (line_items) or workflow format (lineItems)
    const lineItems = extractLineItems(caseData.canonicalData);

    if (!lineItems || lineItems.length === 0) {
      log.warn('No line items in canonical data', { caseId });
      return {
        success: true,
        allResolved: true,
        needsHuman: false,
        resolvedItems: [],
      };
    }
    log.info('Resolving line items against Zoho catalog', {
      caseId,
      itemCount: lineItems.length,
    });

    const resolvedItems: ResolvedItem[] = [];
    const unresolvedLines: number[] = [];
    const candidates: Record<number, ItemCandidate[]> = {};

    // Process each line item
    for (const item of lineItems) {
      const rowNum = item.row;

      try {
        const result = await resolveLineItem(item, caseId);

        if (result.resolved) {
          resolvedItems.push(result.resolvedItem!);
          log.info('Item resolved', {
            caseId,
            row: rowNum,
            method: result.resolvedItem!.matchMethod,
            zohoItemId: result.resolvedItem!.zohoItemId,
          });
        } else {
          unresolvedLines.push(rowNum);
          if (result.candidates && result.candidates.length > 0) {
            candidates[rowNum] = result.candidates;
            log.info('Item unresolved, candidates available', {
              caseId,
              row: rowNum,
              candidateCount: result.candidates.length,
            });
          } else {
            log.warn('Item unresolved, no candidates', {
              caseId,
              row: rowNum,
              productName: item.product_name,
            });
          }
        }
      } catch (error) {
        log.warn('Item resolution failed for line', {
          caseId,
          row: rowNum,
          error: error instanceof Error ? error.message : String(error),
        });
        unresolvedLines.push(rowNum);
      }
    }

    const allResolved = unresolvedLines.length === 0;
    const needsHuman = unresolvedLines.length > 0;

    log.info('Item resolution complete', {
      caseId,
      resolved: resolvedItems.length,
      unresolved: unresolvedLines.length,
      needsHuman,
    });

    return {
      success: true,
      allResolved,
      needsHuman,
      resolvedItems,
      unresolvedLines: needsHuman ? unresolvedLines : undefined,
      candidates: needsHuman && Object.keys(candidates).length > 0 ? candidates : undefined,
    };
  } catch (error) {
    log.error('Failed to resolve items', {
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract line items from case document's canonical data
 * Supports both parser format (line_items) and workflow format (lineItems)
 */
function extractLineItems(canonicalData: unknown): ParserLineItem[] | null {
  if (!canonicalData || typeof canonicalData !== 'object') {
    return null;
  }

  // Check for parser format (line_items from @order-processing/parser)
  if ('line_items' in canonicalData) {
    const parserData = canonicalData as unknown as CanonicalSalesOrder;
    return parserData.line_items || null;
  }

  // Check for workflow format (lineItems from workflow types)
  if ('lineItems' in canonicalData) {
    const workflowData = canonicalData as {
      lineItems: Array<{
        lineNumber: number;
        description: string;
        quantity: number;
        unitPrice?: number;
        sku?: string;
        gtin?: string;
      }>;
    };

    // Convert to parser format
    return workflowData.lineItems.map(item => ({
      row: item.lineNumber,
      source_row_number: item.lineNumber,
      sku: item.sku || null,
      gtin: item.gtin || null,
      product_name: item.description || null,
      quantity: item.quantity,
      unit_price_source: item.unitPrice || null,
      line_total_source: null,
      currency: null,
      evidence: {},
    }));
  }

  return null;
}

/**
 * Result of attempting to resolve a single line item
 */
interface LineItemResolutionResult {
  resolved: boolean;
  resolvedItem?: ResolvedItem;
  candidates?: ItemCandidate[];
}

/**
 * Attempts to resolve a single line item using multi-stage matching
 */
async function resolveLineItem(
  item: ParserLineItem,
  caseId: string
): Promise<LineItemResolutionResult> {
  const correlationId = caseId;

  // Stage 1: Try SKU exact match
  if (item.sku) {
    const skuResult = await searchBySku(item.sku, correlationId);
    if (skuResult) {
      return {
        resolved: true,
        resolvedItem: {
          row: item.row,
          zohoItemId: skuResult.item_id,
          zohoItemName: skuResult.name,
          sku: skuResult.sku,
          rate: skuResult.rate,
          matchMethod: 'sku',
          confidence: 1.0,
        },
      };
    }
  }

  // Stage 2: Try GTIN lookup
  if (item.gtin) {
    const gtinResult = await searchByGtin(item.gtin, correlationId);
    if (gtinResult) {
      return {
        resolved: true,
        resolvedItem: {
          row: item.row,
          zohoItemId: gtinResult.item_id,
          zohoItemName: gtinResult.name,
          sku: gtinResult.sku,
          rate: gtinResult.rate,
          matchMethod: 'gtin',
          confidence: 0.95,
        },
      };
    }
  }

  // Stage 3: Try fuzzy name match
  if (item.product_name) {
    const nameResults = await searchByName(item.product_name, correlationId);

    if (nameResults && nameResults.length > 0) {
      // If exactly one result with high confidence, auto-accept
      if (nameResults.length === 1 && nameResults[0].score > NAME_MATCH_AUTO_ACCEPT_THRESHOLD) {
        const match = nameResults[0];
        return {
          resolved: true,
          resolvedItem: {
            row: item.row,
            zohoItemId: match.item_id,
            zohoItemName: match.name,
            sku: match.sku,
            rate: match.rate,
            matchMethod: 'name',
            confidence: match.score,
          },
        };
      }

      // Return candidates for user selection
      const candidateList: ItemCandidate[] = nameResults
        .filter(r => r.score >= MIN_CANDIDATE_SCORE)
        .slice(0, MAX_CANDIDATES_PER_LINE)
        .map(r => ({
          zohoItemId: r.item_id,
          name: r.name,
          sku: r.sku,
          gtin: r.cf_gtin,
          rate: r.rate,
          score: r.score,
          matchReasons: [`Name similarity: ${Math.round(r.score * 100)}%`],
        }));

      return {
        resolved: false,
        candidates: candidateList,
      };
    }
  }

  // No matches found
  return {
    resolved: false,
    candidates: [],
  };
}

/**
 * Search Zoho items by SKU (exact match)
 */
async function searchBySku(sku: string, correlationId: string): Promise<ZohoItemResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(
      `${ZOHO_SERVICE_URL}/api/items/by-sku/${encodeURIComponent(sku)}`,
      {
        headers: {
          'X-Correlation-ID': correlationId,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // SKU not found
      }
      log.warn('SKU search request failed', {
        sku,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();
    return data as ZohoItemResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn('SKU search timed out', { sku });
    } else {
      log.warn('SKU search error', {
        sku,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

/**
 * Search Zoho items by GTIN (barcode)
 */
async function searchByGtin(gtin: string, correlationId: string): Promise<ZohoItemResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(
      `${ZOHO_SERVICE_URL}/api/items/by-gtin/${encodeURIComponent(gtin)}`,
      {
        headers: {
          'X-Correlation-ID': correlationId,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // GTIN not found
      }
      log.warn('GTIN search request failed', {
        gtin,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();
    return data as ZohoItemResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn('GTIN search timed out', { gtin });
    } else {
      log.warn('GTIN search error', {
        gtin,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

/**
 * Search Zoho items by name (fuzzy match)
 * Returns items sorted by relevance score
 */
async function searchByName(name: string, correlationId: string): Promise<ZohoSearchResult[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(
      `${ZOHO_SERVICE_URL}/api/items/search?name=${encodeURIComponent(name)}`,
      {
        headers: {
          'X-Correlation-ID': correlationId,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.warn('Name search request failed', {
        name,
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data = await response.json() as ZohoSearchResult[] | { items?: ZohoSearchResult[] };

    // Handle both array response and wrapped response
    if (Array.isArray(data)) {
      return data;
    }

    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }

    return [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn('Name search timed out', { name });
    } else {
      log.warn('Name search error', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }
}
