/**
 * Base application error class with error codes and metadata
 */

import type { ErrorCode } from './error-codes';

/**
 * Additional context for errors
 */
export interface ErrorContext {
  caseId?: string;
  tenantId?: string;
  userId?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Base application error with structured metadata
 */
export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;
  public readonly httpStatus?: number;

  constructor(
    message: string,
    code: ErrorCode,
    context: ErrorContext = {},
    options: {
      cause?: Error;
      isOperational?: boolean;
      httpStatus?: number;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isOperational = options.isOperational ?? true;
    this.httpStatus = options.httpStatus;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      isOperational: this.isOperational,
      httpStatus: this.httpStatus,
      stack: this.stack,
      cause: this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
      } : undefined,
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends BaseError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'VALIDATION_ERROR', context, { httpStatus: 400 });
  }
}

/**
 * Error for missing or invalid data
 */
export class DataError extends BaseError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'DATA_ERROR', context, { httpStatus: 400 });
  }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends BaseError {
  constructor(
    service: string,
    message: string,
    context: ErrorContext = {},
    options: { cause?: Error; isTransient?: boolean } = {}
  ) {
    super(
      message,
      options.isTransient ? 'EXTERNAL_SERVICE_UNAVAILABLE' : 'EXTERNAL_SERVICE_ERROR',
      { ...context, service },
      {
        cause: options.cause,
        httpStatus: options.isTransient ? 503 : 502,
      }
    );
  }
}

/**
 * Error for authorization failures
 */
export class AuthorizationError extends BaseError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'UNAUTHORIZED', context, { httpStatus: 403 });
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends BaseError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'CONFIGURATION_ERROR', context, {
      isOperational: false,
      httpStatus: 500,
    });
  }
}
