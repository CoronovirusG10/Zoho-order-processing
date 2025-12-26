/**
 * Date bucketing for fingerprints and time-based grouping
 */

import { toIsoDate } from './formats';

/**
 * Bucket granularity
 */
export type BucketGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * Get a date bucket string for grouping/fingerprinting
 */
export function getDateBucket(date: Date, granularity: BucketGranularity = 'day'): string {
  switch (granularity) {
    case 'hour':
      return getHourBucket(date);
    case 'day':
      return getDayBucket(date);
    case 'week':
      return getWeekBucket(date);
    case 'month':
      return getMonthBucket(date);
    default:
      return getDayBucket(date);
  }
}

/**
 * Get hour bucket (YYYY-MM-DD-HH)
 */
function getHourBucket(date: Date): string {
  const isoDate = toIsoDate(date);
  const hour = date.getUTCHours().toString().padStart(2, '0');
  return `${isoDate}-${hour}`;
}

/**
 * Get day bucket (YYYY-MM-DD)
 */
function getDayBucket(date: Date): string {
  return toIsoDate(date);
}

/**
 * Get week bucket (YYYY-Www)
 * ISO 8601 week numbering
 */
function getWeekBucket(date: Date): string {
  const year = getIsoWeekYear(date);
  const week = getIsoWeek(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get month bucket (YYYY-MM)
 */
function getMonthBucket(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get ISO week number (1-53)
 */
function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNum;
}

/**
 * Get ISO week year (may differ from calendar year for dates in early Jan or late Dec)
 */
function getIsoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Get the start of a bucket period
 */
export function getBucketStart(bucket: string, granularity: BucketGranularity): Date {
  switch (granularity) {
    case 'hour': {
      // Format: YYYY-MM-DD-HH
      const [dateStr, hour] = bucket.split('-').slice(0, 4).join('-').split('-');
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, parseInt(hour, 10), 0, 0, 0));
    }
    case 'day': {
      // Format: YYYY-MM-DD
      const [year, month, day] = bucket.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
    case 'week': {
      // Format: YYYY-Www
      const [year, weekStr] = bucket.split('-W');
      const week = parseInt(weekStr, 10);
      return getIsoWeekStartDate(parseInt(year, 10), week);
    }
    case 'month': {
      // Format: YYYY-MM
      const [year, month] = bucket.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    }
    default:
      throw new Error(`Invalid granularity: ${granularity}`);
  }
}

/**
 * Get the end of a bucket period
 */
export function getBucketEnd(bucket: string, granularity: BucketGranularity): Date {
  const start = getBucketStart(bucket, granularity);

  switch (granularity) {
    case 'hour':
      return new Date(start.getTime() + 60 * 60 * 1000 - 1);
    case 'day':
      return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    case 'week':
      return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    case 'month': {
      const nextMonth = new Date(start);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      return new Date(nextMonth.getTime() - 1);
    }
    default:
      throw new Error(`Invalid granularity: ${granularity}`);
  }
}

/**
 * Get the start date of an ISO week
 */
function getIsoWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  return weekStart;
}

/**
 * Check if a date is within a bucket
 */
export function isInBucket(date: Date, bucket: string, granularity: BucketGranularity): boolean {
  const bucketStr = getDateBucket(date, granularity);
  return bucketStr === bucket;
}
