/**
 * Apply Selections Activity
 *
 * Applies user-selected customer and/or items to the case.
 * Updates canonical data with Zoho IDs.
 */

import { InvocationContext } from '@azure/functions';
import { ApplySelectionsInput, ApplySelectionsOutput } from '../types';

export async function applySelectionsActivity(
  input: ApplySelectionsInput,
  context: InvocationContext
): Promise<ApplySelectionsOutput> {
  const { caseId, selections } = input;

  context.log(`[${caseId}] Applying user selections`);

  try {
    // TODO: Apply selections to case data
    // 1. Load current canonical data from Cosmos
    // 2. Update customer.zohoCustomerId if customer selection provided
    // 3. Update line_items[].zohoItemId if item selections provided
    // 4. Mark as user_selected in match metadata
    // 5. Store updated canonical data
    // 6. Log selection event to audit trail

    if (selections.customer) {
      context.log(`[${caseId}] Customer selected: ${selections.customer.zohoCustomerId}`);
    }

    if (selections.items) {
      const itemCount = Object.keys(selections.items).length;
      context.log(`[${caseId}] Items selected: ${itemCount} items`);
    }

    return {
      success: true,
    };
  } catch (error) {
    context.error(`[${caseId}] Failed to apply selections:`, error);
    throw error;
  }
}

export default applySelectionsActivity;
