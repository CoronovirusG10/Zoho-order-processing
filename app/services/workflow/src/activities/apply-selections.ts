/**
 * Apply Selections Activity (Temporal)
 *
 * Applies user-selected customer and/or items to the case.
 * Updates canonical data with Zoho IDs.
 */

import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface CustomerSelection {
  zohoCustomerId: string;
}

export interface ItemSelection {
  zohoItemId: string;
}

export interface ApplySelectionsInput {
  caseId: string;
  selections: {
    customer?: CustomerSelection;
    items?: Record<number, ItemSelection>;
  };
}

export interface ApplySelectionsOutput {
  success: boolean;
}

/**
 * Applies user selections to case data
 * @param input - The input containing caseId and selections
 * @returns Success status
 */
export async function applySelections(input: ApplySelectionsInput): Promise<ApplySelectionsOutput> {
  const { caseId, selections } = input;

  log.info(`[${caseId}] Applying user selections`);

  try {
    // TODO: Apply selections to case data
    // 1. Load current canonical data from Cosmos
    // 2. Update customer.zohoCustomerId if customer selection provided
    // 3. Update line_items[].zohoItemId if item selections provided
    // 4. Mark as user_selected in match metadata
    // 5. Store updated canonical data
    // 6. Log selection event to audit trail

    if (selections.customer) {
      log.info(`[${caseId}] Customer selected: ${selections.customer.zohoCustomerId}`);
    }

    if (selections.items) {
      const itemCount = Object.keys(selections.items).length;
      log.info(`[${caseId}] Items selected: ${itemCount} items`);
    }

    return {
      success: true,
    };
  } catch (error) {
    log.error(`[${caseId}] Failed to apply selections: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
