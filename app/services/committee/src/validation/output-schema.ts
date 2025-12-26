/**
 * Shared JSON Schema for provider output validation
 *
 * Single source of truth for the output schema used by all providers.
 * This ensures consistent validation across Azure OpenAI, Anthropic, DeepSeek, Gemini, and xAI.
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import { ProviderMappingOutput } from '../types';

/**
 * JSON Schema for provider mapping output
 *
 * This schema enforces:
 * - Required fields: mappings, issues, overallConfidence, processingTimeMs
 * - Mapping structure: field, selectedColumnId (string or null), confidence (0-1), reasoning
 * - Issue structure: code, severity (info/warning/error), evidence
 * - Numeric constraints for confidence values
 */
export const PROVIDER_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['mappings', 'issues', 'overallConfidence', 'processingTimeMs'],
  additionalProperties: false,
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field', 'selectedColumnId', 'confidence', 'reasoning'],
        additionalProperties: false,
        properties: {
          field: {
            type: 'string',
            minLength: 1,
            description: 'Canonical field name (e.g., customer_name, sku, quantity)',
          },
          selectedColumnId: {
            type: ['string', 'null'],
            description: 'Column ID from candidates, or null if no match',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score between 0.0 and 1.0',
          },
          reasoning: {
            type: 'string',
            minLength: 1,
            description: 'Evidence-based explanation for the mapping decision',
          },
        },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'severity', 'evidence'],
        additionalProperties: false,
        properties: {
          code: {
            type: 'string',
            minLength: 1,
            pattern: '^[A-Z][A-Z0-9_]*$',
            description: 'Issue code (e.g., AMBIGUOUS_MAPPING, LOW_CONFIDENCE)',
          },
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'error'],
            description: 'Severity level of the issue',
          },
          evidence: {
            type: 'string',
            minLength: 1,
            description: 'Reference to specific evidence supporting the issue',
          },
        },
      },
    },
    overallConfidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Overall confidence in the entire mapping set',
    },
    processingTimeMs: {
      type: 'number',
      minimum: 0,
      description: 'Processing time in milliseconds',
    },
  },
} as const;

/**
 * Singleton AJV instance with schema compiled
 */
class OutputSchemaValidator {
  private static instance: OutputSchemaValidator;
  private ajv: Ajv;
  private validateFn: ValidateFunction;

  private constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
    });
    this.validateFn = this.ajv.compile(PROVIDER_OUTPUT_SCHEMA);
  }

  static getInstance(): OutputSchemaValidator {
    if (!OutputSchemaValidator.instance) {
      OutputSchemaValidator.instance = new OutputSchemaValidator();
    }
    return OutputSchemaValidator.instance;
  }

  /**
   * Validate provider output against schema
   *
   * @param output - Raw output from provider
   * @returns Validated output or throws error
   */
  validate(output: unknown): ProviderMappingOutput {
    if (!this.validateFn(output)) {
      const errors = this.formatErrors(this.validateFn.errors);
      throw new ValidationError('Invalid provider output', errors);
    }
    return output as ProviderMappingOutput;
  }

  /**
   * Check if output is valid without throwing
   *
   * @param output - Raw output to validate
   * @returns Validation result
   */
  isValid(output: unknown): { valid: boolean; errors?: string[] } {
    const valid = this.validateFn(output);
    if (valid) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: this.formatErrors(this.validateFn.errors),
    };
  }

  /**
   * Format AJV errors into readable messages
   */
  private formatErrors(errors: ErrorObject[] | null | undefined): string[] {
    if (!errors) return ['Unknown validation error'];

    return errors.map((err) => {
      const path = err.instancePath || 'root';
      const message = err.message || 'Unknown error';
      const params = err.params ? ` (${JSON.stringify(err.params)})` : '';
      return `${path}: ${message}${params}`;
    });
  }
}

/**
 * Custom validation error with detailed errors
 */
export class ValidationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(`${message}: ${errors.join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Get the singleton validator instance
 */
export function getValidator(): OutputSchemaValidator {
  return OutputSchemaValidator.getInstance();
}

/**
 * Validate provider output (convenience function)
 */
export function validateProviderOutput(output: unknown): ProviderMappingOutput {
  return getValidator().validate(output);
}

/**
 * Check if output is valid (convenience function)
 */
export function isValidProviderOutput(output: unknown): boolean {
  return getValidator().isValid(output).valid;
}

/**
 * Validate that all expected fields are covered
 *
 * @param output - Validated provider output
 * @param expectedFields - List of expected canonical field names
 * @returns List of missing fields
 */
export function validateFieldCoverage(
  output: ProviderMappingOutput,
  expectedFields: string[]
): string[] {
  const mappedFields = new Set(output.mappings.map((m) => m.field));
  const missingFields: string[] = [];

  for (const field of expectedFields) {
    if (!mappedFields.has(field)) {
      missingFields.push(field);
    }
  }

  return missingFields;
}

/**
 * Validate that selected column IDs are from candidates
 *
 * @param output - Validated provider output
 * @param validColumnIds - Set of valid column IDs
 * @returns List of invalid column IDs used
 */
export function validateColumnIdConstraints(
  output: ProviderMappingOutput,
  validColumnIds: Set<string>
): string[] {
  const invalidIds: string[] = [];

  for (const mapping of output.mappings) {
    if (mapping.selectedColumnId !== null && !validColumnIds.has(mapping.selectedColumnId)) {
      invalidIds.push(
        `Field '${mapping.field}' references invalid column '${mapping.selectedColumnId}'`
      );
    }
  }

  return invalidIds;
}

/**
 * Full validation pipeline
 *
 * @param rawOutput - Raw output from provider
 * @param expectedFields - Expected canonical fields
 * @param validColumnIds - Valid column IDs from evidence pack
 * @returns Validation result with output or errors
 */
export function validateFull(
  rawOutput: unknown,
  expectedFields: string[],
  validColumnIds: Set<string>
): {
  valid: boolean;
  output?: ProviderMappingOutput;
  errors: string[];
} {
  const errors: string[] = [];

  // Step 1: Schema validation
  const schemaResult = getValidator().isValid(rawOutput);
  if (!schemaResult.valid) {
    return {
      valid: false,
      errors: schemaResult.errors || ['Schema validation failed'],
    };
  }

  const output = rawOutput as ProviderMappingOutput;

  // Step 2: Field coverage validation
  const missingFields = validateFieldCoverage(output, expectedFields);
  if (missingFields.length > 0) {
    errors.push(`Missing fields: ${missingFields.join(', ')}`);
  }

  // Step 3: Column ID constraint validation
  const invalidColumns = validateColumnIdConstraints(output, validColumnIds);
  errors.push(...invalidColumns);

  return {
    valid: errors.length === 0,
    output,
    errors,
  };
}
