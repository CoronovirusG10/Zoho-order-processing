/**
 * Tests for error handling utilities
 */

import { describe, it, expect } from 'vitest';
import { BaseError, ValidationError } from '../base-error';
import {
  classifyError,
  generateUserMessage,
  getRetryRecommendation,
} from '../error-handler';

describe('classifyError', () => {
  it('should classify BaseError instances', () => {
    const error = new ValidationError('Invalid input', { field: 'sku' });
    const classification = classifyError(error);

    expect(classification.code).toBe('VALIDATION_ERROR');
    expect(classification.message).toBe('Invalid input');
    expect(classification.httpStatus).toBe(400);
    expect(classification.isRetryable).toBe(false);
    expect(classification.context).toEqual({ field: 'sku' });
  });

  it('should classify standard Error instances', () => {
    const error = new Error('Something went wrong');
    const classification = classifyError(error);

    expect(classification.code).toBe('UNKNOWN_ERROR');
    expect(classification.message).toBe('Something went wrong');
    expect(classification.httpStatus).toBe(500);
  });

  it('should handle unknown error types', () => {
    const classification = classifyError('string error');

    expect(classification.code).toBe('UNKNOWN_ERROR');
    expect(classification.httpStatus).toBe(500);
  });
});

describe('generateUserMessage', () => {
  it('should generate message from BaseError', () => {
    const error = new ValidationError('Invalid SKU format', { field: 'sku' });
    const message = generateUserMessage(error);

    expect(message).toContain('Invalid SKU format');
    expect(message).toContain('Field: sku');
  });

  it('should use default message if none provided', () => {
    const error = new BaseError('', 'VALIDATION_ERROR');
    const message = generateUserMessage(error);

    expect(message).toContain('invalid');
  });

  it('should handle standard Error', () => {
    const error = new Error('Test error');
    const message = generateUserMessage(error);

    expect(message).toBe('Test error');
  });
});

describe('getRetryRecommendation', () => {
  it('should recommend retry for retryable errors', () => {
    const error = new BaseError('Service unavailable', 'EXTERNAL_SERVICE_UNAVAILABLE');
    const recommendation = getRetryRecommendation(error, 1);

    expect(recommendation.shouldRetry).toBe(true);
    expect(recommendation.delayMs).toBe(1000);
    expect(recommendation.maxAttempts).toBe(5);
  });

  it('should not recommend retry for non-retryable errors', () => {
    const error = new ValidationError('Invalid input');
    const recommendation = getRetryRecommendation(error, 1);

    expect(recommendation.shouldRetry).toBe(false);
  });

  it('should use exponential backoff', () => {
    const error = new BaseError('Service unavailable', 'EXTERNAL_SERVICE_UNAVAILABLE');

    const rec1 = getRetryRecommendation(error, 1);
    const rec2 = getRetryRecommendation(error, 2);
    const rec3 = getRetryRecommendation(error, 3);

    expect(rec1.delayMs).toBe(1000);
    expect(rec2.delayMs).toBe(2000);
    expect(rec3.delayMs).toBe(4000);
  });

  it('should stop recommending retry after max attempts', () => {
    const error = new BaseError('Service unavailable', 'EXTERNAL_SERVICE_UNAVAILABLE');
    const recommendation = getRetryRecommendation(error, 5);

    expect(recommendation.shouldRetry).toBe(false);
  });
});
