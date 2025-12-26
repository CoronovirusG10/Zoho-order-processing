/**
 * Google Gemini provider implementation (Direct API)
 *
 * Uses Google AI Studio API for Gemini models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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
 * Google Gemini provider using direct API
 */
export class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  constructor(config: any) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Gemini provider requires apiKey');
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async executeMapping(
    evidencePack: EvidencePack,
    expectedFields: string[],
    systemPrompt: string,
    timeoutMs: number
  ): Promise<ProviderMappingOutput> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          responseMimeType: 'application/json',
        },
        systemInstruction: systemPrompt,
      });

      const userPrompt = this.buildUserPrompt(evidencePack, expectedFields);

      const result = await this.withTimeout(
        model.generateContent(userPrompt),
        timeoutMs
      );

      const response = result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content in response');
      }

      const parsed = JSON.parse(content);
      const output = this.validateOutput(parsed);

      output.processingTimeMs = Date.now() - startTime;

      return output;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini provider failed: ${errorMsg}`);
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
