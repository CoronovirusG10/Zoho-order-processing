/**
 * ISO 8601 date/time formatting utilities
 */

/**
 * Format a date as ISO 8601 string (UTC)
 */
export function toIsoString(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date as ISO 8601 date only (YYYY-MM-DD)
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date as ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss)
 */
export function toIsoDateTime(date: Date): string {
  return date.toISOString().split('.')[0];
}

/**
 * Parse ISO 8601 string to Date
 */
export function fromIsoString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Check if a string is a valid ISO 8601 date
 */
export function isValidIsoDate(str: string): boolean {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Get current date/time as ISO 8601 string
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Get current date as ISO 8601 date (YYYY-MM-DD)
 */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/**
 * Format a date for display (locale-aware)
 */
export function toDisplayDate(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a datetime for display (locale-aware)
 */
export function toDisplayDateTime(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Get the difference between two dates in milliseconds
 */
export function diffMilliseconds(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime());
}

/**
 * Get the difference between two dates in seconds
 */
export function diffSeconds(date1: Date, date2: Date): number {
  return Math.floor(diffMilliseconds(date1, date2) / 1000);
}

/**
 * Get the difference between two dates in minutes
 */
export function diffMinutes(date1: Date, date2: Date): number {
  return Math.floor(diffSeconds(date1, date2) / 60);
}

/**
 * Get the difference between two dates in hours
 */
export function diffHours(date1: Date, date2: Date): number {
  return Math.floor(diffMinutes(date1, date2) / 60);
}

/**
 * Get the difference between two dates in days
 */
export function diffDays(date1: Date, date2: Date): number {
  return Math.floor(diffHours(date1, date2) / 24);
}
