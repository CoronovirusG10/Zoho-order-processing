/**
 * Extraction review task (future use)
 *
 * Coordinates the committee review of data extractions
 */

import { CommitteeConfig, ExtractionReviewTask, ProviderOutput } from '../types';
import { BaseProvider } from '../providers/base-provider';
import { getExtractionReviewSystemPrompt } from '../prompts/extraction-review-prompt';

/**
 * Execute extraction review with multiple providers
 *
 * This is a placeholder for future implementation.
 * V1 focuses on schema mapping only.
 *
 * @param task - Extraction review task
 * @param providers - Selected providers for the committee
 * @param config - Committee configuration
 * @returns Array of provider outputs
 */
export async function executeExtractionReview(
  task: ExtractionReviewTask,
  providers: BaseProvider[],
  config: CommitteeConfig
): Promise<ProviderOutput[]> {
  // TODO: Implement extraction review
  // This would follow a similar pattern to schema mapping review
  // but would validate extracted values instead of column mappings

  throw new Error('Extraction review not yet implemented');
}
