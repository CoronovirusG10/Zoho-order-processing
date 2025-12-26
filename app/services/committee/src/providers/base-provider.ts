/**
 * Base provider interface
 *
 * All AI providers must implement this interface to participate in the committee.
 */

import { EvidencePack, ProviderMappingOutput, ProviderConfig } from '../types';

/**
 * Abstract base class for all AI providers
 */
export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Get provider ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Execute schema mapping review
   *
   * @param evidencePack - Bounded evidence pack
   * @param expectedFields - Canonical field names to map
   * @param systemPrompt - System prompt for the provider
   * @param timeoutMs - Timeout in milliseconds
   * @returns Provider output with mappings and issues
   */
  abstract executeMapping(
    evidencePack: EvidencePack,
    expectedFields: string[],
    systemPrompt: string,
    timeoutMs: number
  ): Promise<ProviderMappingOutput>;

  /**
   * Validate the provider's output against JSON schema
   *
   * @param output - Raw output from the provider
   * @returns Validated and parsed output
   */
  protected abstract validateOutput(output: unknown): ProviderMappingOutput;

  /**
   * Build the user prompt from evidence pack
   *
   * @param evidencePack - Evidence pack
   * @param expectedFields - Expected canonical fields
   * @returns Formatted user prompt
   */
  protected buildUserPrompt(evidencePack: EvidencePack, expectedFields: string[]): string {
    const prompt = `
# Schema Mapping Task

**Case ID**: ${evidencePack.caseId}
**Detected Language**: ${evidencePack.detectedLanguage}
**Timestamp**: ${evidencePack.timestamp}

## Constraints
${evidencePack.constraints.map((c) => `- ${c}`).join('\n')}

## Expected Fields to Map
${expectedFields.map((f) => `- ${f}`).join('\n')}

## Available Columns (Candidates)

${evidencePack.candidateHeaders.map((header, idx) => `
### Column ${idx}
**Header**: ${header}
**Sample Values**:
${(evidencePack.sampleValues[idx.toString()] || []).map((v) => `  - ${v}`).join('\n')}
`).join('\n')}

## Column Statistics

${evidencePack.columnStats.map((stat) => `
**Column ${stat.columnId}**: ${stat.headerText}
- Non-empty count: ${stat.nonEmptyCount}
- Unique values: ${stat.uniqueCount}
- Data types: ${JSON.stringify(stat.dataTypes)}
- Detected patterns: ${stat.patterns.join(', ') || 'None'}
`).join('\n')}

## Your Task

For each expected field, select the best matching column ID from the candidates, or return null if no suitable match exists.
You MUST:
1. Only choose from the provided candidate column IDs
2. Never invent new columns or values
3. Return strict JSON matching the required schema
4. Provide reasoning with specific evidence references for every decision
5. Flag issues with appropriate severity levels

Return your response as valid JSON only.
`;

    return prompt.trim();
  }

  /**
   * Create timeout promise wrapper
   */
  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Provider timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
}
