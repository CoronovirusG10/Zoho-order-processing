/**
 * Centralized error handling with classification and user-facing messages
 */

import { BaseError } from './base-error';
import { ErrorCode, getErrorMetadata } from './error-codes';
import type { Logger } from '../logging/logger';

/**
 * Error classification result
 */
export interface ErrorClassification {
  code: ErrorCode;
  message: string;
  userMessage: string;
  isTransient: boolean;
  isRetryable: boolean;
  retryAfterMs?: number;
  httpStatus: number;
  context?: Record<string, unknown>;
}

/**
 * Retry recommendation
 */
export interface RetryRecommendation {
  shouldRetry: boolean;
  delayMs?: number;
  maxAttempts?: number;
  backoffMultiplier?: number;
}

/**
 * Classify an error and extract information
 */
export function classifyError(error: unknown): ErrorClassification {
  // Handle BaseError instances
  if (error instanceof BaseError) {
    const metadata = getErrorMetadata(error.code);
    return {
      code: error.code,
      message: error.message,
      userMessage: generateUserMessage(error),
      isTransient: metadata.isTransient,
      isRetryable: metadata.isRetryable,
      httpStatus: error.httpStatus || 500,
      context: error.context,
    };
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
      isTransient: false,
      isRetryable: false,
      httpStatus: 500,
    };
  }

  // Handle unknown error types
  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    userMessage: 'An unexpected error occurred. Please try again.',
    isTransient: false,
    isRetryable: false,
    httpStatus: 500,
  };
}

/**
 * Generate a user-facing error message
 */
export function generateUserMessage(error: BaseError | Error): string {
  if (error instanceof BaseError) {
    const metadata = getErrorMetadata(error.code);

    // Use custom message if provided, otherwise use default
    let message = error.message || metadata.defaultMessage;

    // Add context-specific details
    if (error.context.field) {
      message += ` (Field: ${error.context.field})`;
    }
    if (error.context.operation) {
      message += ` (Operation: ${error.context.operation})`;
    }

    return message;
  }

  return error.message || 'An unexpected error occurred.';
}

/**
 * Get retry recommendation for an error
 */
export function getRetryRecommendation(
  error: unknown,
  attemptNumber: number = 1
): RetryRecommendation {
  const classification = classifyError(error);

  if (!classification.isRetryable) {
    return { shouldRetry: false };
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelayMs = 1000;
  const maxAttempts = 5;
  const backoffMultiplier = 2;

  if (attemptNumber >= maxAttempts) {
    return { shouldRetry: false };
  }

  const delayMs = baseDelayMs * Math.pow(backoffMultiplier, attemptNumber - 1);

  return {
    shouldRetry: true,
    delayMs,
    maxAttempts,
    backoffMultiplier,
  };
}

/**
 * Handle an error and log it appropriately
 */
export function handleError(error: unknown, logger?: Logger): ErrorClassification {
  const classification = classifyError(error);

  // Log the error
  if (logger) {
    const logData = {
      code: classification.code,
      isTransient: classification.isTransient,
      isRetryable: classification.isRetryable,
      httpStatus: classification.httpStatus,
      ...classification.context,
    };

    if (classification.httpStatus >= 500) {
      logger.error(classification.message, error instanceof Error ? error : undefined, logData);
    } else if (classification.httpStatus >= 400) {
      logger.warn(classification.message, logData);
    } else {
      logger.info(classification.message, logData);
    }
  }

  return classification;
}

/**
 * Convert error to HTTP response format
 */
export function errorToHttpResponse(error: unknown): {
  statusCode: number;
  body: {
    error: {
      code: string;
      message: string;
      isRetryable?: boolean;
      retryAfter?: number;
    };
  };
} {
  const classification = classifyError(error);

  return {
    statusCode: classification.httpStatus,
    body: {
      error: {
        code: classification.code,
        message: classification.userMessage,
        isRetryable: classification.isRetryable || undefined,
        retryAfter: classification.retryAfterMs,
      },
    },
  };
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandler<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  logger?: Logger
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, logger);
      throw error;
    }
  };
}
