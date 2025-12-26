/**
 * Consensus detection utilities
 */

import { FieldVote, ConsensusType } from '../types';

/**
 * Detect consensus type for a set of field votes
 *
 * @param fieldVotes - Field votes from aggregation
 * @returns Consensus type
 */
export function detectConsensus(fieldVotes: FieldVote[]): ConsensusType {
  if (fieldVotes.length === 0) {
    return 'no_consensus';
  }

  let unanimousFields = 0;
  let majorityFields = 0;
  let splitFields = 0;
  let noConsensusFields = 0;

  for (const fieldVote of fieldVotes) {
    const consensusType = detectFieldConsensus(fieldVote);

    switch (consensusType) {
      case 'unanimous':
        unanimousFields++;
        break;
      case 'majority':
        majorityFields++;
        break;
      case 'split':
        splitFields++;
        break;
      case 'no_consensus':
        noConsensusFields++;
        break;
    }
  }

  const total = fieldVotes.length;

  // If all fields are unanimous
  if (unanimousFields === total) {
    return 'unanimous';
  }

  // If majority of fields have consensus (unanimous or majority)
  const consensusFields = unanimousFields + majorityFields;
  if (consensusFields / total >= 0.66) {
    return 'majority';
  }

  // If there's significant disagreement
  if (splitFields / total >= 0.5 || noConsensusFields / total >= 0.3) {
    return 'no_consensus';
  }

  // Mixed results
  return 'split';
}

/**
 * Detect consensus for a single field
 */
export function detectFieldConsensus(fieldVote: FieldVote): ConsensusType {
  const { votes, winnerMargin } = fieldVote;

  // No votes = no consensus
  if (votes.length === 0) {
    return 'no_consensus';
  }

  // All providers agree (only one option)
  if (votes.length === 1) {
    return 'unanimous';
  }

  // Strong majority (large margin)
  if (winnerMargin >= 0.5) {
    return 'majority';
  }

  // Weak majority
  if (winnerMargin >= 0.25) {
    return 'majority';
  }

  // Very close votes or even split
  if (winnerMargin < 0.1) {
    return 'split';
  }

  // Low confidence overall
  const maxConfidence = Math.max(...votes.map((v) => v.confidence));
  if (maxConfidence < 0.5) {
    return 'no_consensus';
  }

  return 'split';
}

/**
 * Check if consensus is sufficient to auto-accept
 *
 * @param consensusType - Overall consensus type
 * @param overallConfidence - Overall confidence score
 * @param confidenceThreshold - Minimum confidence required
 * @returns True if consensus is sufficient
 */
export function isSufficientConsensus(
  consensusType: ConsensusType,
  overallConfidence: number,
  confidenceThreshold: number = 0.75
): boolean {
  // Unanimous with high confidence
  if (consensusType === 'unanimous' && overallConfidence >= confidenceThreshold) {
    return true;
  }

  // Majority with very high confidence
  if (consensusType === 'majority' && overallConfidence >= 0.85) {
    return true;
  }

  // All other cases require human review
  return false;
}
