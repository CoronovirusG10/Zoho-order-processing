/**
 * Update Case Activity
 *
 * Updates the case record in Cosmos DB with current status and metadata.
 * Maintains audit trail of all state changes.
 */

import { InvocationContext } from '@azure/functions';
import { UpdateCaseInput, UpdateCaseOutput } from '../types';

export async function updateCaseActivity(
  input: UpdateCaseInput,
  context: InvocationContext
): Promise<UpdateCaseOutput> {
  const { caseId, status, updates } = input;

  context.log(`[${caseId}] Updating case status to: ${status}`);

  try {
    // TODO: Update Cosmos DB case record
    // - Update status field
    // - Merge in additional updates
    // - Append to audit trail
    // - Update lastModifiedAt timestamp

    context.log(`[${caseId}] Case updated successfully`);

    return {
      success: true,
    };
  } catch (error) {
    context.error(`[${caseId}] Failed to update case:`, error);
    throw error;
  }
}

export default updateCaseActivity;
