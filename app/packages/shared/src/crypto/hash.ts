/**
 * SHA-256 hashing utilities for file fingerprints
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Calculate SHA-256 hash of a string
 */
export function sha256(data: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  await pipeline(stream, hash);

  return hash.digest('hex');
}

/**
 * Calculate SHA-256 hash of multiple values concatenated
 */
export function sha256Multi(...values: Array<string | Buffer>): string {
  const hash = createHash('sha256');
  for (const value of values) {
    hash.update(value);
  }
  return hash.digest('hex');
}
