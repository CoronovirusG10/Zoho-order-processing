/**
 * Schema mapping review task
 *
 * Coordinates the committee review of schema mappings
 */

import { CommitteeConfig, SchemaMappingTask, ProviderOutput } from '../types';
import { BaseProvider } from '../providers/base-provider';
import { getMappingReviewSystemPrompt } from '../prompts/mapping-review-prompt';
import pLimit from 'p-limit';

/**
 * Execute schema mapping review with multiple providers
 *
 * @param task - Schema mapping task
 * @param providers - Selected providers for the committee
 * @param config - Committee configuration
 * @returns Array of provider outputs
 */
export async function executeSchemaMappingReview(
  task: SchemaMappingTask,
  providers: BaseProvider[],
  config: CommitteeConfig
): Promise<ProviderOutput[]> {
  const systemPrompt = getMappingReviewSystemPrompt();

  // Limit concurrent provider calls to avoid overwhelming the system
  const limit = pLimit(3);

  const providerPromises = providers.map((provider) =>
    limit(async (): Promise<ProviderOutput> => {
      const startTime = Date.now();

      try {
        const output = await provider.executeMapping(
          task.evidencePack,
          task.expectedFields,
          systemPrompt,
          config.timeoutMs
        );

        return {
          providerId: provider.getId(),
          providerName: provider.getName(),
          output,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Return a failed output
        return {
          providerId: provider.getId(),
          providerName: provider.getName(),
          error: errorMsg,
          output: {
            mappings: [],
            issues: [
              {
                code: 'PROVIDER_FAILED',
                severity: 'error',
                evidence: `Provider execution failed: ${errorMsg}`,
              },
            ],
            overallConfidence: 0,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }
    })
  );

  const results = await Promise.all(providerPromises);

  // Filter successful results
  const successful = results.filter((r) => !r.error);

  if (successful.length < config.minSuccessfulProviders) {
    throw new Error(
      `Insufficient successful provider responses. Required: ${config.minSuccessfulProviders}, Got: ${successful.length}`
    );
  }

  return results;
}

/**
 * Validate that provider outputs are complete for the task
 */
export function validateProviderOutputs(
  outputs: ProviderOutput[],
  expectedFields: string[]
): string[] {
  const errors: string[] = [];

  for (const output of outputs) {
    if (output.error) {
      continue; // Skip failed outputs
    }

    const mappedFields = new Set(output.output.mappings.map((m) => m.field));

    for (const field of expectedFields) {
      if (!mappedFields.has(field)) {
        errors.push(
          `Provider ${output.providerId} did not provide mapping for required field: ${field}`
        );
      }
    }
  }

  return errors;
}
