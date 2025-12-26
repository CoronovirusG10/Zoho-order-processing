/**
 * Run Committee Activity
 *
 * Runs the 3-model committee for bounded mapping cross-check.
 * Detects disagreements that require human intervention.
 */

import { InvocationContext } from '@azure/functions';
import { RunCommitteeInput, RunCommitteeOutput } from '../types';

export async function runCommitteeActivity(
  input: RunCommitteeInput,
  context: InvocationContext
): Promise<RunCommitteeOutput> {
  const { caseId } = input;

  context.log(`[${caseId}] Running committee mapping validation`);

  try {
    // TODO: Call committee service
    // POST /api/committee/validate
    // Body: { caseId }
    // Returns: { consensus, needsHuman, disagreements }

    const committeeServiceUrl = process.env.COMMITTEE_SERVICE_URL || 'http://localhost:7072/api';

    // Mock implementation for now
    const committeeResult: RunCommitteeOutput = {
      success: true,
      needsHuman: false,
      consensus: 'unanimous',
      disagreements: [],
    };

    context.log(`[${caseId}] Committee validation complete. Consensus: ${committeeResult.consensus}`);

    return committeeResult;
  } catch (error) {
    context.error(`[${caseId}] Failed to run committee:`, error);
    throw error;
  }
}

export default runCommitteeActivity;
