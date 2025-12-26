/**
 * Test Fixtures Index
 *
 * Provides access to sample Excel files for integration testing.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FixtureInfo {
  name: string;
  path: string;
  description: string;
  expectedBehavior: 'success' | 'blocked' | 'warning';
  language: 'en' | 'fa' | 'mixed';
  hasFormulas: boolean;
  hasGtin: boolean;
  lineItemCount: number;
}

/**
 * Available test fixtures
 */
export const fixtureManifest: FixtureInfo[] = [
  {
    name: 'simple-order.xlsx',
    path: join(__dirname, 'simple-order.xlsx'),
    description: 'Simple English order with 2 line items',
    expectedBehavior: 'success',
    language: 'en',
    hasFormulas: false,
    hasGtin: false,
    lineItemCount: 2,
  },
  {
    name: 'multi-line-order.xlsx',
    path: join(__dirname, 'multi-line-order.xlsx'),
    description: 'Multi-line order with GTIN codes',
    expectedBehavior: 'success',
    language: 'en',
    hasFormulas: false,
    hasGtin: true,
    lineItemCount: 4,
  },
  {
    name: 'order-with-formulas.xlsx',
    path: join(__dirname, 'order-with-formulas.xlsx'),
    description: 'Order with Excel formulas (should be blocked)',
    expectedBehavior: 'blocked',
    language: 'en',
    hasFormulas: true,
    hasGtin: false,
    lineItemCount: 5,
  },
  {
    name: 'farsi-headers.xlsx',
    path: join(__dirname, 'farsi-headers.xlsx'),
    description: 'Order with Farsi/Persian headers',
    expectedBehavior: 'success',
    language: 'fa',
    hasFormulas: false,
    hasGtin: false,
    lineItemCount: 3,
  },
  {
    name: 'persian-digits.xlsx',
    path: join(__dirname, 'persian-digits.xlsx'),
    description: 'Order with Persian digits in quantity and price',
    expectedBehavior: 'warning',
    language: 'fa',
    hasFormulas: false,
    hasGtin: false,
    lineItemCount: 3,
  },
  {
    name: 'mixed-language.xlsx',
    path: join(__dirname, 'mixed-language.xlsx'),
    description: 'Order with mixed English/Farsi headers',
    expectedBehavior: 'success',
    language: 'mixed',
    hasFormulas: false,
    hasGtin: false,
    lineItemCount: 2,
  },
];

/**
 * Load a fixture file by name
 */
export async function loadFixture(name: string): Promise<Buffer> {
  const fixture = fixtureManifest.find(f => f.name === name);
  if (!fixture) {
    throw new Error(`Fixture not found: ${name}`);
  }
  return await readFile(fixture.path);
}

/**
 * Get fixture info by name
 */
export function getFixtureInfo(name: string): FixtureInfo | undefined {
  return fixtureManifest.find(f => f.name === name);
}

/**
 * Get all fixtures matching criteria
 */
export function getFixturesByLanguage(language: 'en' | 'fa' | 'mixed'): FixtureInfo[] {
  return fixtureManifest.filter(f => f.language === language);
}

/**
 * Get fixtures that should be blocked
 */
export function getBlockedFixtures(): FixtureInfo[] {
  return fixtureManifest.filter(f => f.expectedBehavior === 'blocked');
}

/**
 * Get fixtures that should succeed
 */
export function getSuccessFixtures(): FixtureInfo[] {
  return fixtureManifest.filter(f => f.expectedBehavior === 'success');
}

/**
 * Get fixtures with GTIN codes
 */
export function getGtinFixtures(): FixtureInfo[] {
  return fixtureManifest.filter(f => f.hasGtin);
}

export default {
  manifest: fixtureManifest,
  loadFixture,
  getFixtureInfo,
  getFixturesByLanguage,
  getBlockedFixtures,
  getSuccessFixtures,
  getGtinFixtures,
};
