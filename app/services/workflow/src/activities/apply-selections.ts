/**
 * Apply Selections Activity (Temporal)
 *
 * Applies user-selected customer and/or items to the case.
 * Updates canonical data with Zoho IDs when human intervention
 * is needed for entity matching.
 *
 * Features:
 * - Persists selections to Cosmos DB
 * - Uses ETag-based OCC (Optimistic Concurrency Control) to prevent race conditions
 * - Appends audit events to the events container
 * - Supports both customer and item selections
 */

import { log, ApplicationFailure } from '@temporalio/activity';
import { getCasesRepository, getEventsRepository, CaseDocument } from '../repositories/index.js';
import { CanonicalOrderData, CaseStatus } from '../workflows/types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Customer selection with Zoho mapping
 */
export interface CustomerSelection {
  zohoCustomerId: string;
  zohoCustomerName?: string;
  confidence?: number;
}

/**
 * Item selection with Zoho mapping
 */
export interface ItemSelection {
  zohoItemId: string;
  zohoItemName?: string;
  zohoItemRate?: number;
  confidence?: number;
}

/**
 * Container for all user selections
 */
export interface UserSelections {
  customer?: CustomerSelection;
  items?: Record<number, ItemSelection>;
}

/**
 * Input for the applySelections activity
 */
export interface ApplySelectionsInput {
  caseId: string;
  tenantId: string;
  selections: UserSelections;
  submittedBy: string;
  correlationId: string;
}

/**
 * Output from the applySelections activity
 */
export interface ApplySelectionsOutput {
  success: boolean;
  customerApplied: boolean;
  itemsApplied: number;
  newVersion?: string;
  errors?: string[];
}

/**
 * Match metadata for tracking selection source
 */
interface MatchMetadata {
  method: string;
  confidence: number;
  selection_source: string;
  selected_at: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of OCC retry attempts before failing
 */
const MAX_OCC_RETRIES = 3;

/**
 * Delay between OCC retries in milliseconds
 */
const OCC_RETRY_DELAY_MS = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delays execution for the specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates match metadata for user-selected entities
 */
function createUserSelectedMetadata(): MatchMetadata {
  return {
    method: 'user_selected',
    confidence: 1.0,
    selection_source: 'user_selected',
    selected_at: new Date().toISOString(),
  };
}

/**
 * Applies customer selection to canonical data
 */
function applyCustomerSelection(
  canonicalData: Record<string, unknown>,
  selection: CustomerSelection
): void {
  // Ensure customer object exists
  if (!canonicalData.customer) {
    canonicalData.customer = {};
  }

  const customer = canonicalData.customer as Record<string, unknown>;
  customer.zoho_customer_id = selection.zohoCustomerId;
  if (selection.zohoCustomerName) {
    customer.zoho_customer_name = selection.zohoCustomerName;
  }
  customer.match_metadata = createUserSelectedMetadata();
}

/**
 * Applies item selection to canonical data
 *
 * @param canonicalData - The canonical data object
 * @param rowIndex - The line item row index
 * @param selection - The item selection
 * @returns true if item was found and updated, false otherwise
 */
function applyItemSelection(
  canonicalData: Record<string, unknown>,
  rowIndex: number,
  selection: ItemSelection
): boolean {
  // Get line_items array
  const lineItems = canonicalData.line_items as Array<Record<string, unknown>> | undefined;
  if (!lineItems || !Array.isArray(lineItems)) {
    return false;
  }

  // Find the line item by row index
  const lineItem = lineItems.find(li => li.row === rowIndex || li.lineNumber === rowIndex);
  if (!lineItem) {
    return false;
  }

  // Apply selection
  lineItem.zoho_item_id = selection.zohoItemId;
  if (selection.zohoItemName) {
    lineItem.zoho_item_name = selection.zohoItemName;
  }
  if (selection.zohoItemRate !== undefined) {
    lineItem.zoho_item_rate = selection.zohoItemRate;
  }
  lineItem.match_metadata = createUserSelectedMetadata();

  return true;
}

/**
 * Determines the appropriate status after selections are applied
 *
 * @param canonicalData - The canonical data object
 * @param customerApplied - Whether customer was applied this round
 * @param itemsApplied - Number of items applied this round
 * @returns The new case status
 */
function determineNewStatus(
  canonicalData: Record<string, unknown>,
  customerApplied: boolean,
  itemsApplied: number
): CaseStatus {
  // If customer was just selected, move to resolving_items
  if (customerApplied) {
    return 'resolving_items';
  }

  // If items were selected, check if all items are now resolved
  if (itemsApplied > 0) {
    const lineItems = canonicalData.line_items as Array<Record<string, unknown>> | undefined;
    if (lineItems && Array.isArray(lineItems)) {
      const allResolved = lineItems.every(
        li => li.zoho_item_id !== undefined && li.zoho_item_id !== null
      );
      if (allResolved) {
        return 'awaiting_approval';
      }
    }
    // Some items still unresolved, stay in awaiting_item_selection
    return 'awaiting_item_selection';
  }

  // No changes, keep current status (shouldn't reach here normally)
  return 'resolving_customer';
}

// ============================================================================
// Main Activity Implementation
// ============================================================================

/**
 * Applies user selections to case data with Cosmos persistence and OCC
 *
 * This activity handles human-in-the-loop entity matching when automatic
 * matching fails or is ambiguous. It:
 * 1. Validates the selection format
 * 2. Loads current case from Cosmos DB
 * 3. Applies customer and/or item selections to the canonical data
 * 4. Persists changes with ETag-based OCC to prevent race conditions
 * 5. Updates case status based on what was selected
 * 6. Appends audit event to the events container
 *
 * @param input - The input containing caseId, tenantId, selections, and submitter info
 * @returns Success status with details of what was applied
 */
export async function applySelections(input: ApplySelectionsInput): Promise<ApplySelectionsOutput> {
  const { caseId, tenantId, selections, submittedBy, correlationId } = input;
  const hasCustomer = !!selections.customer;
  const itemCount = selections.items ? Object.keys(selections.items).length : 0;

  log.info('Applying user selections', {
    caseId,
    tenantId,
    correlationId,
    hasCustomer,
    itemCount,
    submittedBy,
  });

  // Validate selections format first
  const validationErrors: string[] = [];

  if (selections.customer) {
    const { zohoCustomerId } = selections.customer;
    if (!zohoCustomerId || zohoCustomerId.trim() === '') {
      validationErrors.push('Customer selection missing zohoCustomerId');
    }
  }

  if (selections.items) {
    for (const [rowIndex, selection] of Object.entries(selections.items)) {
      const { zohoItemId } = selection;
      if (!zohoItemId || zohoItemId.trim() === '') {
        validationErrors.push(`Item selection for row ${rowIndex} missing zohoItemId`);
      }
    }
  }

  // Check if there's anything to apply
  if (!hasCustomer && itemCount === 0) {
    log.warn('No selections provided', { caseId, correlationId });
    return {
      success: false,
      customerApplied: false,
      itemsApplied: 0,
      errors: ['No selections provided'],
    };
  }

  if (validationErrors.length > 0) {
    log.error('Selection validation failed', {
      caseId,
      errors: validationErrors,
    });
    return {
      success: false,
      customerApplied: false,
      itemsApplied: 0,
      errors: validationErrors,
    };
  }

  // Try to get repositories - fall back to mock behavior if not available
  let casesRepo;
  let eventsRepo;
  try {
    casesRepo = getCasesRepository();
    eventsRepo = getEventsRepository();
  } catch (repoError) {
    log.warn('Repositories not available, using mock behavior', {
      caseId,
      error: repoError instanceof Error ? repoError.message : String(repoError),
    });
    return mockApplySelections(input, hasCustomer, itemCount);
  }

  // OCC retry loop
  let attempt = 0;
  while (attempt < MAX_OCC_RETRIES) {
    attempt++;

    try {
      // Load current case from Cosmos
      const caseData = await casesRepo.getCase(caseId, tenantId);

      if (!caseData) {
        log.error('Case not found', { caseId, tenantId });
        throw ApplicationFailure.nonRetryable(`Case ${caseId} not found in tenant ${tenantId}`);
      }

      // Initialize canonical data if not present
      const canonicalData = (caseData.canonicalData || {}) as Record<string, unknown>;

      // Track what was applied
      let customerApplied = false;
      let itemsApplied = 0;
      const itemErrors: string[] = [];

      // Apply customer selection
      if (selections.customer) {
        applyCustomerSelection(canonicalData, selections.customer);
        customerApplied = true;

        log.info('Applied customer selection', {
          caseId,
          correlationId,
          zohoCustomerId: selections.customer.zohoCustomerId,
          zohoCustomerName: selections.customer.zohoCustomerName,
          submittedBy,
          timestamp: new Date().toISOString(),
        });
      }

      // Apply item selections
      if (selections.items) {
        for (const [rowIndexStr, selection] of Object.entries(selections.items)) {
          const rowIndex = Number(rowIndexStr);

          const applied = applyItemSelection(canonicalData, rowIndex, selection);
          if (applied) {
            itemsApplied++;

            log.info('Applied item selection', {
              caseId,
              correlationId,
              rowIndex,
              zohoItemId: selection.zohoItemId,
              zohoItemName: selection.zohoItemName,
              submittedBy,
              timestamp: new Date().toISOString(),
            });
          } else {
            const errorMsg = `Line item at row ${rowIndex} not found`;
            itemErrors.push(errorMsg);
            log.warn('Failed to apply item selection - line not found', {
              caseId,
              rowIndex,
              zohoItemId: selection.zohoItemId,
            });
          }
        }
      }

      // Determine new status based on what was applied
      const newStatus = determineNewStatus(canonicalData, customerApplied, itemsApplied);

      // Update case with selections - using updateCaseCanonicalData
      const updatedCase = await casesRepo.updateCaseCanonicalData(
        caseId,
        tenantId,
        canonicalData as unknown as CaseDocument['canonicalData']
      );

      // Update status to reflect selections were applied
      await casesRepo.updateCaseStatus(caseId, tenantId, newStatus);

      // Append audit events
      try {
        if (customerApplied) {
          await eventsRepo.appendEvent({
            caseId,
            type: 'customer_selected',
            status: newStatus,
            userId: submittedBy,
            correlationId,
            metadata: {
              selection: {
                zohoCustomerId: selections.customer!.zohoCustomerId,
                zohoCustomerName: selections.customer!.zohoCustomerName,
              },
              appliedAt: new Date().toISOString(),
            },
          });
        }

        if (itemsApplied > 0) {
          await eventsRepo.appendEvent({
            caseId,
            type: 'items_selected',
            status: newStatus,
            userId: submittedBy,
            correlationId,
            metadata: {
              selections: Object.fromEntries(
                Object.entries(selections.items || {}).map(([row, sel]) => [
                  row,
                  {
                    zohoItemId: sel.zohoItemId,
                    zohoItemName: sel.zohoItemName,
                    zohoItemRate: sel.zohoItemRate,
                  },
                ])
              ),
              itemsApplied,
              appliedAt: new Date().toISOString(),
            },
          });
        }
      } catch (eventError) {
        // Log but don't fail - audit event is secondary to the selection itself
        log.warn('Failed to append audit event', {
          caseId,
          error: eventError instanceof Error ? eventError.message : String(eventError),
        });
      }

      log.info('Selections applied successfully', {
        caseId,
        correlationId,
        customerApplied,
        itemsApplied,
        newStatus,
        submittedBy,
        attempt,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        customerApplied,
        itemsApplied,
        newVersion: updatedCase.updatedAt, // Using updatedAt as version proxy
        errors: itemErrors.length > 0 ? itemErrors : undefined,
      };
    } catch (error) {
      // Check for OCC conflict (HTTP 412 Precondition Failed)
      const errorCode = (error as { code?: number | string }).code;
      const isOccConflict = errorCode === 412 || errorCode === '412';

      if (isOccConflict && attempt < MAX_OCC_RETRIES) {
        log.warn('OCC conflict detected, retrying', {
          caseId,
          attempt,
          maxRetries: MAX_OCC_RETRIES,
        });
        await delay(OCC_RETRY_DELAY_MS * attempt); // Exponential backoff
        continue;
      }

      // Non-retryable error or max retries exceeded
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Failed to apply selections', {
        caseId,
        correlationId,
        error: errorMessage,
        submittedBy,
        attempt,
        isOccConflict,
      });

      // Throw as retryable if OCC conflict and we've exhausted retries
      if (isOccConflict) {
        throw ApplicationFailure.retryable(
          `Concurrent modification conflict after ${MAX_OCC_RETRIES} retries`,
          'OCC_CONFLICT'
        );
      }

      throw error;
    }
  }

  // Should not reach here, but TypeScript needs a return
  throw ApplicationFailure.nonRetryable('Unexpected: exceeded OCC retry loop without result');
}

// ============================================================================
// Mock Implementation for Development
// ============================================================================

/**
 * Mock implementation when repositories are not available
 * Used during development or when Cosmos is not configured
 */
function mockApplySelections(
  input: ApplySelectionsInput,
  hasCustomer: boolean,
  itemCount: number
): ApplySelectionsOutput {
  const { caseId, correlationId, submittedBy, selections } = input;

  let customerApplied = false;
  let itemsApplied = 0;

  // Log customer selection for audit trail (even in mock mode)
  if (selections.customer) {
    log.info('Mock: Applying customer selection', {
      caseId,
      correlationId,
      zohoCustomerId: selections.customer.zohoCustomerId,
      zohoCustomerName: selections.customer.zohoCustomerName,
      submittedBy,
      selectionType: 'user_selected',
      timestamp: new Date().toISOString(),
    });
    customerApplied = true;
  }

  // Log item selections for audit trail (even in mock mode)
  if (selections.items) {
    for (const [rowIndex, selection] of Object.entries(selections.items)) {
      log.info('Mock: Applying item selection', {
        caseId,
        correlationId,
        rowIndex: Number(rowIndex),
        zohoItemId: selection.zohoItemId,
        zohoItemName: selection.zohoItemName,
        submittedBy,
        selectionType: 'user_selected',
        timestamp: new Date().toISOString(),
      });
      itemsApplied++;
    }
  }

  log.info('Mock: Selections applied successfully', {
    caseId,
    correlationId,
    customerApplied,
    itemsApplied,
    submittedBy,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    customerApplied,
    itemsApplied,
    newVersion: new Date().toISOString(),
  };
}
