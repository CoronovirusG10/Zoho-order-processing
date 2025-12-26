/**
 * Azure OpenAI provider implementation
 *
 * Uses Azure OpenAI Service (GPT-5.x, GPT-4.x models)
 */

import { AzureOpenAI } from '@azure/openai';
import { DefaultAzureCredential } from '@azure/identity';
import { BaseProvider } from './base-provider';
import { EvidencePack, ProviderMappingOutput } from '../types';
import Ajv from 'ajv';

const ajv = new Ajv();

/**
 * JSON Schema for provider output validation
 */
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

export class AzureOpenAIProvider extends BaseProvider {
  private client: AzureOpenAI;

  constructor(config: any) {
    super(config);

    // Use Managed Identity for authentication
    const credential = new DefaultAzureCredential();

    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      azureADTokenProvider: async () => {
        const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
        return token.token;
      },
      apiVersion: '2024-10-21',
    });
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
        this.client.chat.completions.create({
          model: this.config.deploymentName!,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        }),
        timeoutMs
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      const parsed = JSON.parse(content);
      const output = this.validateOutput(parsed);

      // Override processing time with actual
      output.processingTimeMs = Date.now() - startTime;

      return output;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Azure OpenAI provider failed: ${errorMsg}`);
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
