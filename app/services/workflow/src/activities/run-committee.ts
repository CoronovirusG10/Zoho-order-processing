/**
 * Run Committee Activity (Temporal)
 *
 * Runs the 3-model committee for bounded mapping cross-check.
 * Detects disagreements that require human intervention.
 */

import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface RunCommitteeInput {
  caseId: string;
}

export interface CommitteeDisagreement {
  field: string;
  votes: Record<string, string>;
}

export interface RunCommitteeOutput {
  success: boolean;
  needsHuman: boolean;
  consensus: 'unanimous' | 'majority' | 'split' | 'no_consensus';
  disagreements?: CommitteeDisagreement[];
}

/**
 * Runs the committee mapping validation for a case
 * @param input - The input containing caseId
 * @returns Committee consensus result and any disagreements
 */
export async function runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  const { caseId } = input;

  log.info(`[${caseId}] Running committee mapping validation`);

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

    log.info(`[${caseId}] Committee validation complete. Consensus: ${committeeResult.consensus}`);

    return committeeResult;
  } catch (error) {
    log.error(`[${caseId}] Failed to run committee: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
