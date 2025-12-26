/**
 * Tests for date bucketing
 */

import { describe, it, expect } from 'vitest';
import { getDateBucket, getBucketStart, getBucketEnd, isInBucket } from '../buckets';

describe('getDateBucket', () => {
  const testDate = new Date('2025-12-25T14:30:45Z');

  it('should generate day bucket', () => {
    expect(getDateBucket(testDate, 'day')).toBe('2025-12-25');
  });

  it('should generate hour bucket', () => {
    expect(getDateBucket(testDate, 'hour')).toBe('2025-12-25-14');
  });

  it('should generate month bucket', () => {
    expect(getDateBucket(testDate, 'month')).toBe('2025-12');
  });

  it('should generate week bucket', () => {
    const bucket = getDateBucket(testDate, 'week');
    expect(bucket).toMatch(/^2025-W\d{2}$/);
  });

  it('should default to day bucket', () => {
    expect(getDateBucket(testDate)).toBe('2025-12-25');
  });
});

describe('getBucketStart', () => {
  it('should get start of day bucket', () => {
    const start = getBucketStart('2025-12-25', 'day');
    expect(start.toISOString()).toBe('2025-12-25T00:00:00.000Z');
  });

  it('should get start of hour bucket', () => {
    const start = getBucketStart('2025-12-25-14', 'hour');
    expect(start.toISOString()).toBe('2025-12-25T14:00:00.000Z');
  });

  it('should get start of month bucket', () => {
    const start = getBucketStart('2025-12', 'month');
    expect(start.toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });
});

describe('getBucketEnd', () => {
  it('should get end of day bucket', () => {
    const end = getBucketEnd('2025-12-25', 'day');
    expect(end.toISOString()).toBe('2025-12-25T23:59:59.999Z');
  });

  it('should get end of hour bucket', () => {
    const end = getBucketEnd('2025-12-25-14', 'hour');
    expect(end.toISOString()).toBe('2025-12-25T14:59:59.999Z');
  });
});

describe('isInBucket', () => {
  it('should check if date is in day bucket', () => {
    const date = new Date('2025-12-25T14:30:00Z');
    expect(isInBucket(date, '2025-12-25', 'day')).toBe(true);
    expect(isInBucket(date, '2025-12-26', 'day')).toBe(false);
  });

  it('should check if date is in hour bucket', () => {
    const date = new Date('2025-12-25T14:30:00Z');
    expect(isInBucket(date, '2025-12-25-14', 'hour')).toBe(true);
    expect(isInBucket(date, '2025-12-25-15', 'hour')).toBe(false);
  });
});
