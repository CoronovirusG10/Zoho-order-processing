/**
 * JSON Schema validation using Ajv
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from '../errors/base-error';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationErrorDetail[];
}

/**
 * Detailed validation error
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

/**
 * Schema validator using Ajv
 */
export class SchemaValidator {
  private readonly ajv: Ajv;
  private readonly compiledSchemas: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
      coerceTypes: false,
    });

    // Add format validators
    addFormats(this.ajv);

    this.compiledSchemas = new Map();
  }

  /**
   * Compile and cache a schema
   */
  compileSchema(schemaId: string, schema: Record<string, unknown>): ValidateFunction {
    const existing = this.compiledSchemas.get(schemaId);
    if (existing) {
      return existing;
    }

    const validate = this.ajv.compile(schema);
    this.compiledSchemas.set(schemaId, validate);
    return validate;
  }

  /**
   * Validate data against a schema
   */
  validate(
    data: unknown,
    schema: Record<string, unknown> | string,
    schemaId?: string
  ): ValidationResult {
    let validateFn: ValidateFunction;

    if (typeof schema === 'string') {
      // Schema ID provided
      const cached = this.compiledSchemas.get(schema);
      if (!cached) {
        throw new ValidationError(`Schema not found: ${schema}`);
      }
      validateFn = cached;
    } else {
      // Schema object provided
      const id = schemaId || 'anonymous';
      validateFn = this.compileSchema(id, schema);
    }

    const valid = validateFn(data);

    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(validateFn.errors || []),
    };
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(
    data: unknown,
    schema: Record<string, unknown> | string,
    schemaId?: string
  ): void {
    const result = this.validate(data, schema, schemaId);
    if (!result.valid) {
      const errorMessages = result.errors?.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new ValidationError(`Schema validation failed: ${errorMessages}`, {
        errors: result.errors,
      });
    }
  }

  /**
   * Format Ajv errors into a more readable format
   */
  private formatErrors(errors: ErrorObject[]): ValidationErrorDetail[] {
    return errors.map((error) => ({
      path: error.instancePath || '(root)',
      message: error.message || 'Validation failed',
      keyword: error.keyword,
      params: error.params,
    }));
  }

  /**
   * Get a compiled schema
   */
  getSchema(schemaId: string): ValidateFunction | undefined {
    return this.compiledSchemas.get(schemaId);
  }

  /**
   * Remove a compiled schema from cache
   */
  removeSchema(schemaId: string): boolean {
    return this.compiledSchemas.delete(schemaId);
  }

  /**
   * Clear all compiled schemas
   */
  clearSchemas(): void {
    this.compiledSchemas.clear();
  }
}

/**
 * Default schema validator instance
 */
export const schemaValidator = new SchemaValidator();
