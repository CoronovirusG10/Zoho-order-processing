/**
 * xAI Grok provider implementation (Direct API)
 *
 * Uses xAI API for Grok models
 */

import { BaseProvider } from './base-provider';
import { EvidencePack, ProviderMappingOutput } from '../types';
import Ajv from 'ajv';

const ajv = new Ajv();

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mappings', 'issues', 'overallConfidence', 'processingTimeMs'],
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field', 'selectedColumnId', 'confidence', 'reasoning'],
        properties: {
          field: { type: 'string' },
          selectedColumnId: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
        },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'severity', 'evidence'],
        properties: {
          code: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'error'] },
          evidence: { type: 'string' },
        },
      },
    },
    overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
    processingTimeMs: { type: 'number', minimum: 0 },
  },
};

const validateOutput = ajv.compile(OUTPUT_SCHEMA);

/**
 * xAI Grok provider using direct API
 */
export class XAIProvider extends BaseProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(config: any) {
    super(config);

    if (!config.apiKey) {
      throw new Error('xAI provider requires apiKey');
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || 'https://api.x.ai/v1';
  }

  async executeMapping(
    evidencePack: EvidencePack,
    expectedFields: string[],
    systemPrompt: string,
    timeoutMs: number
  ): Promise<ProviderMappingOutput> {
    const startTime = Date.now();

    try {
      const userPrompt = this.buildUserPrompt(evidencePack, expectedFields);

      const response = await this.withTimeout(
        fetch(`${this.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            response_format: { type: 'json_object' },
          }),
        }),
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      const parsed = JSON.parse(content);
      const output = this.validateOutput(parsed);

      output.processingTimeMs = Date.now() - startTime;

      return output;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`xAI provider failed: ${errorMsg}`);
    }
  }

  protected validateOutput(output: unknown): ProviderMappingOutput {
    if (!validateOutput(output)) {
      const errors = validateOutput.errors?.map((e) => `${e.instancePath}: ${e.message}`).join(', ');
      throw new Error(`Invalid provider output: ${errors}`);
    }

    return output as ProviderMappingOutput;
  }
}
