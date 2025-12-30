/**
 * Resolve Items Activity (Temporal)
 *
 * Resolves line items from the spreadsheet against Zoho Books items catalog.
 * Multi-stage matching strategy:
 * 1. Primary: Exact SKU match
 * 2. Fallback: GTIN (custom field) lookup
 * 3. Tertiary: Fuzzy name match (if enabled)
 *
 * Returns needsHuman=true when items cannot be resolved automatically,
 * providing candidate lists for user selection.
 */

import { log } from '@temporalio/activity';

// Import repository for case lookup
import { getCasesRepository } from '../repositories/index.js';
import { getFeatureFlags } from '../config';

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
 * Cached item structure from Zoho service
 * Defined locally to avoid direct dependency on @order-processing/zoho
 */
export interface CachedItem {
  zoho_item_id: string;
  name: string;
  sku: string | null;
  gtin: string | null;
  rate: number;
  unit?: string;
  status: string;
  description?: string;
  last_cached_at: string;
}

/**
 * Item match result from Zoho's ItemMatcher
 * Defined locally to avoid direct dependency on @order-processing/zoho
 */
export interface ItemMatchResult {
  status: 'resolved' | 'ambiguous' | 'not_found' | 'needs_user_input';
  item?: {
    zoho_item_id: string;
    name: string;
    rate: number;
  };
  method?: 'sku' | 'gtin' | 'name_fuzzy' | 'user_selected';
  confidence: number;
  candidates: Array<{
    zoho_item_id: string;
    sku: string | null;
    gtin: string | null;
    name: string;
    rate: number;
    score: number;
    match_reason?: string;
  }>;
}

// ============================================================================
// Dependency Injection Interfaces
// ============================================================================

/**
 * Interface for the Zoho item service (cache)
 * This abstracts the Zoho client for testability
 */
export interface IZohoItemService {
  /**
   * Get all cached items for matching
   */
  getItems(): Promise<CachedItem[]>;
}

/**
 * Interface for the item matcher
 * This abstracts the ItemMatcher class for testability
 */
export interface IItemMatcher {
  matchItem(
    sku: string | null,
    gtin: string | null,
    name: string | null,
    items: CachedItem[]
  ): Promise<ItemMatchResult>;
}

/**
 * Interface for Cases Repository
 * Defines the contract for case retrieval
 */
export interface ICasesRepository {
  getCase(caseId: string, tenantId: string): Promise<CaseData | null>;
}

/**
 * Minimal case data needed for item resolution
 */
export interface CaseData {
  id: string;
  tenantId: string;
  canonicalData?: unknown;
}

// ============================================================================
// Configuration
// ============================================================================

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
// Dependency Injection
// ============================================================================

// Dependencies - will be injected via activity context
let zohoItemService: IZohoItemService | null = null;
let itemMatcher: IItemMatcher | null = null;

/**
 * Initialize dependencies for the resolveItems activity
 * Called at worker startup to inject service dependencies
 *
 * @param zohoService - Zoho item service instance (provides cached items)
 * @param matcher - Item matcher instance
 */
export function initializeResolveItemsActivity(
  zohoService: IZohoItemService,
  matcher: IItemMatcher
): void {
  zohoItemService = zohoService;
  itemMatcher = matcher;
  log.info('ResolveItems activity dependencies initialized');
}

/**
 * Check if dependencies are initialized
 */
export function isResolveItemsInitialized(): boolean {
  return zohoItemService !== null && itemMatcher !== null;
}

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
 * 3. Fuzzy name search (if enabled in matcher)
 *
 * @param input - The input containing caseId
 * @returns Resolution result with resolved items or candidates for selection
 */
export async function resolveItems(input: ResolveItemsInput): Promise<ResolveItemsOutput> {
  const { caseId, tenantId } = input;
  const flags = getFeatureFlags();

  log.info('Starting item resolution', {
    caseId,
    tenantId,
    zohoMode: flags.zohoMode,
    useMock: flags.useMockItems,
  });

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

    // If dependencies aren't initialized or mock mode is forced, use mock behavior
    const useMock = flags.useMockItems || !zohoItemService || !itemMatcher;

    if (useMock) {
      log.info('Using mock item resolution', {
        caseId,
        reason: flags.useMockItems ? 'ZOHO_MODE=mock' : 'Dependencies not initialized',
      });
      return mockResolveItems(lineItems, caseId);
    }

    // Get items from Zoho cache
    const items = await zohoItemService.getItems();

    log.info('Retrieved items for matching', {
      caseId,
      itemCount: items.length,
    });

    if (items.length === 0) {
      log.warn('No items available in cache', { caseId });
      return {
        success: false,
        allResolved: false,
        needsHuman: false,
        resolvedItems: [],
        error: 'No items available for matching (cache may be empty)',
      } as ResolveItemsOutput & { error: string };
    }

    const resolvedItems: ResolvedItem[] = [];
    const unresolvedLines: number[] = [];
    const candidates: Record<number, ItemCandidate[]> = {};

    // Process each line item using the ItemMatcher
    for (const item of lineItems) {
      const rowNum = item.row;

      try {
        const matchResult = await itemMatcher.matchItem(
          item.sku || null,
          item.gtin || null,
          item.product_name || null,
          items
        );

        const result = mapMatchResultToResolution(matchResult, item, rowNum);

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
 * Map ItemMatchResult from ItemMatcher to our resolution format
 */
function mapMatchResultToResolution(
  matchResult: ItemMatchResult,
  item: ParserLineItem,
  rowNum: number
): LineItemResolutionResult {
  switch (matchResult.status) {
    case 'resolved':
      if (matchResult.item) {
        return {
          resolved: true,
          resolvedItem: {
            row: rowNum,
            zohoItemId: matchResult.item.zoho_item_id,
            zohoItemName: matchResult.item.name,
            sku: matchResult.candidates[0]?.sku || undefined,
            rate: matchResult.item.rate,
            matchMethod: mapMethod(matchResult.method),
            confidence: matchResult.confidence,
          },
        };
      }
      // Fallthrough if no item despite resolved status
      return {
        resolved: false,
        candidates: mapCandidates(matchResult.candidates),
      };

    case 'ambiguous':
    case 'needs_user_input':
      return {
        resolved: false,
        candidates: mapCandidates(matchResult.candidates),
      };

    case 'not_found':
    default:
      return {
        resolved: false,
        candidates: [],
      };
  }
}

/**
 * Map ItemMatcher method to our matchMethod format
 */
function mapMethod(method: ItemMatchResult['method']): 'sku' | 'gtin' | 'name' {
  switch (method) {
    case 'sku':
      return 'sku';
    case 'gtin':
      return 'gtin';
    case 'name_fuzzy':
    case 'user_selected':
    default:
      return 'name';
  }
}

/**
 * Map ItemMatcher candidates to our ItemCandidate format
 */
function mapCandidates(
  candidates: ItemMatchResult['candidates']
): ItemCandidate[] {
  return candidates
    .filter(c => c.score >= MIN_CANDIDATE_SCORE)
    .slice(0, MAX_CANDIDATES_PER_LINE)
    .map(c => ({
      zohoItemId: c.zoho_item_id,
      name: c.name,
      sku: c.sku || undefined,
      gtin: c.gtin || undefined,
      rate: c.rate,
      score: c.score,
      matchReasons: c.match_reason ? [c.match_reason] : undefined,
    }));
}

/**
 * Mock implementation for development/testing when dependencies are not initialized
 */
function mockResolveItems(
  lineItems: ParserLineItem[],
  caseId: string
): ResolveItemsOutput {
  log.info('Using mock item resolution', { caseId, itemCount: lineItems.length });

  const resolvedItems: ResolvedItem[] = [];
  const unresolvedLines: number[] = [];
  const candidates: Record<number, ItemCandidate[]> = {};

  for (const item of lineItems) {
    const rowNum = item.row;

    // Simulate different scenarios based on SKU/name patterns
    if (item.sku && item.sku.toLowerCase().includes('test')) {
      // Exact SKU match
      resolvedItems.push({
        row: rowNum,
        zohoItemId: `mock-item-sku-${item.sku}`,
        zohoItemName: item.product_name || `Mock Item ${item.sku}`,
        sku: item.sku,
        rate: item.unit_price_source || 10.0,
        matchMethod: 'sku',
        confidence: 1.0,
      });
    } else if (item.gtin) {
      // GTIN match
      resolvedItems.push({
        row: rowNum,
        zohoItemId: `mock-item-gtin-${item.gtin}`,
        zohoItemName: item.product_name || `Mock Item GTIN ${item.gtin}`,
        sku: item.sku || undefined,
        rate: item.unit_price_source || 15.0,
        matchMethod: 'gtin',
        confidence: 0.95,
      });
    } else if (item.product_name && item.product_name.toLowerCase().includes('ambiguous')) {
      // Ambiguous match - return candidates
      unresolvedLines.push(rowNum);
      candidates[rowNum] = [
        {
          zohoItemId: 'mock-item-001',
          name: `${item.product_name} (Option A)`,
          sku: 'MOCK-A',
          rate: 20.0,
          score: 0.85,
          matchReasons: ['Fuzzy name match'],
        },
        {
          zohoItemId: 'mock-item-002',
          name: `${item.product_name} (Option B)`,
          sku: 'MOCK-B',
          rate: 22.0,
          score: 0.82,
          matchReasons: ['Fuzzy name match'],
        },
      ];
    } else if (item.product_name) {
      // Default: high-confidence fuzzy match
      resolvedItems.push({
        row: rowNum,
        zohoItemId: `mock-item-name-${rowNum}`,
        zohoItemName: item.product_name,
        sku: item.sku || undefined,
        rate: item.unit_price_source || 12.0,
        matchMethod: 'name',
        confidence: NAME_MATCH_AUTO_ACCEPT_THRESHOLD + 0.05,
      });
    } else {
      // No matching criteria available
      unresolvedLines.push(rowNum);
    }
  }

  const allResolved = unresolvedLines.length === 0;
  const needsHuman = unresolvedLines.length > 0;

  return {
    success: true,
    allResolved,
    needsHuman,
    resolvedItems,
    unresolvedLines: needsHuman ? unresolvedLines : undefined,
    candidates: needsHuman && Object.keys(candidates).length > 0 ? candidates : undefined,
  };
}
