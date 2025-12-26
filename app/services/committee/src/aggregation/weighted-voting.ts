/**
 * Weighted voting aggregation
 *
 * Aggregates votes from multiple providers using weights
 */

import { ProviderOutput, FieldVote, AggregatedResult } from '../types';

/**
 * Aggregate votes from multiple providers using weighted voting
 *
 * @param outputs - Provider outputs with mappings
 * @param weights - Provider weights (higher = more trusted)
 * @param confidenceThreshold - Minimum margin to avoid human review
 * @returns Aggregated result with field votes
 */
export function aggregateVotes(
  outputs: ProviderOutput[],
  weights: Record<string, number>,
  confidenceThreshold: number = 0.25
): AggregatedResult {
  // Collect all unique fields across all outputs
  const allFields = new Set<string>();
  for (const output of outputs) {
    for (const mapping of output.output.mappings) {
      allFields.add(mapping.field);
    }
  }

  const fieldVotes: FieldVote[] = [];

  // Process each field
  for (const field of allFields) {
    const votes = new Map<string | null, { weight: number; confidence: number; providers: string[] }>();

    // Collect votes for this field
    for (const output of outputs) {
      const mapping = output.output.mappings.find((m) => m.field === field);
      if (!mapping) continue;

      const providerWeight = weights[output.providerId] || 1.0;
      const columnId = mapping.selectedColumnId;

      if (!votes.has(columnId)) {
        votes.set(columnId, { weight: 0, confidence: 0, providers: [] });
      }

      const vote = votes.get(columnId)!;
      vote.weight += providerWeight * mapping.confidence;
      vote.confidence = Math.max(vote.confidence, mapping.confidence);
      vote.providers.push(output.providerId);
    }

    // Convert to sorted array
    const voteArray = Array.from(votes.entries())
      .map(([columnId, vote]) => ({
        columnId,
        weight: vote.weight,
        confidence: vote.confidence,
        providers: vote.providers,
      }))
      .sort((a, b) => b.weight - a.weight);

    // Determine winner and margin
    const winner = voteArray[0]?.columnId || null;
    const winnerWeight = voteArray[0]?.weight || 0;
    const runnerUpWeight = voteArray[1]?.weight || 0;
    const margin = winnerWeight - runnerUpWeight;

    // Determine if human review is needed
    const requiresHuman = margin < confidenceThreshold || winnerWeight < 0.5;

    fieldVotes.push({
      field,
      votes: voteArray,
      winner,
      winnerMargin: margin,
      requiresHuman,
    });
  }

  // Calculate overall confidence
  const totalConfidence = outputs.reduce((sum, o) => sum + o.output.overallConfidence, 0);
  const overallConfidence = outputs.length > 0 ? totalConfidence / outputs.length : 0;

  // Find disagreements
  const disagreements = fieldVotes
    .filter((fv) => fv.votes.length > 1 && fv.requiresHuman)
    .map((fv) => ({
      field: fv.field,
      reason: `Providers disagree or low confidence (margin: ${fv.winnerMargin.toFixed(2)})`,
      providerOutputs: Object.fromEntries(
        outputs.map((o) => {
          const mapping = o.output.mappings.find((m) => m.field === fv.field);
          return [o.providerId, mapping?.selectedColumnId || null];
        })
      ),
    }));

  // Determine consensus type
  const consensus = determineConsensusType(fieldVotes);

  return {
    consensus,
    fieldVotes,
    overallConfidence,
    disagreements,
  };
}

/**
 * Determine consensus type based on field votes
 */
function determineConsensusType(fieldVotes: FieldVote[]): 'unanimous' | 'majority' | 'split' | 'no_consensus' {
  if (fieldVotes.length === 0) {
    return 'no_consensus';
  }

  const unanimousCount = fieldVotes.filter((fv) => fv.votes.length === 1).length;
  const majorityCount = fieldVotes.filter(
    (fv) => fv.votes.length > 1 && fv.winnerMargin >= 0.25
  ).length;

  const unanimousRatio = unanimousCount / fieldVotes.length;
  const majorityRatio = (unanimousCount + majorityCount) / fieldVotes.length;

  if (unanimousRatio === 1.0) {
    return 'unanimous';
  } else if (majorityRatio >= 0.66) {
    return 'majority';
  } else if (majorityRatio >= 0.33) {
    return 'split';
  } else {
    return 'no_consensus';
  }
}
