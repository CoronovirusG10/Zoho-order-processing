/**
 * Order fingerprint generation for idempotency
 * Combines file hash, customer ID, normalized line items, and date bucket
 */

import { sha256, sha256Multi } from './hash';
import { normalizeSku } from '../validation/validators';
import { getDateBucket } from '../datetime/buckets';

/**
 * Line item for fingerprint calculation
 */
export interface FingerprintLineItem {
  sku?: string | null;
  gtin?: string | null;
  quantity: number;
  productName?: string | null;
}

/**
 * Order data for fingerprint calculation
 */
export interface OrderFingerprintData {
  fileSha256: string;
  customerId: string;
  lineItems: FingerprintLineItem[];
  orderDate?: Date;
}

/**
 * Normalize a line item for consistent hashing
 */
function normalizeLineItem(item: FingerprintLineItem): string {
  // Use SKU (normalized) as primary identifier
  const sku = normalizeSku(item.sku) || '';

  // Use GTIN (trimmed) as fallback
  const gtin = item.gtin?.trim() || '';

  // Normalize quantity to 2 decimal places
  const qty = item.quantity.toFixed(2);

  // Combine in a consistent format
  return `${sku}|${gtin}|${qty}`;
}

/**
 * Calculate hash of all line items in a consistent order
 */
function calculateLineItemsHash(lineItems: FingerprintLineItem[]): string {
  // Sort line items by normalized representation for consistency
  const normalized = lineItems
    .map(normalizeLineItem)
    .sort() // Alphabetical sort for deterministic order
    .join('\n');

  return sha256(normalized);
}

/**
 * Generate order fingerprint for idempotency checking
 *
 * The fingerprint is calculated as:
 * SHA-256(fileSha256 + customerId + lineItemsHash + dateBucket)
 *
 * This ensures that:
 * - Same file + same customer + same items + same date = same fingerprint
 * - Small variations in order timing don't create different fingerprints
 * - Line item order doesn't matter (sorted before hashing)
 */
export function generateOrderFingerprint(data: OrderFingerprintData): string {
  const {
    fileSha256,
    customerId,
    lineItems,
    orderDate = new Date(),
  } = data;

  // Calculate line items hash
  const lineItemsHash = calculateLineItemsHash(lineItems);

  // Get date bucket (e.g., "2025-12-25" for daily bucketing)
  const dateBucket = getDateBucket(orderDate, 'day');

  // Combine all components
  return sha256Multi(
    fileSha256,
    customerId,
    lineItemsHash,
    dateBucket
  );
}

/**
 * Generate a partial fingerprint without customer ID
 * Useful for detecting potential duplicates before customer resolution
 */
export function generatePartialFingerprint(
  fileSha256: string,
  lineItems: FingerprintLineItem[],
  orderDate?: Date
): string {
  const lineItemsHash = calculateLineItemsHash(lineItems);
  const dateBucket = getDateBucket(orderDate || new Date(), 'day');

  return sha256Multi(fileSha256, lineItemsHash, dateBucket);
}

/**
 * Check if two line item sets are similar enough to be the same order
 * (more lenient than fingerprint matching)
 */
export function areLineItemsSimilar(
  items1: FingerprintLineItem[],
  items2: FingerprintLineItem[],
  threshold: number = 0.8
): boolean {
  if (items1.length === 0 || items2.length === 0) {
    return false;
  }

  // Normalize both sets
  const normalized1 = new Set(items1.map(normalizeLineItem));
  const normalized2 = new Set(items2.map(normalizeLineItem));

  // Calculate Jaccard similarity
  const intersection = new Set(
    [...normalized1].filter((x) => normalized2.has(x))
  );
  const union = new Set([...normalized1, ...normalized2]);

  const similarity = intersection.size / union.size;

  return similarity >= threshold;
}
