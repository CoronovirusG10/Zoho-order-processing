/**
 * Zoho Mock Data Generators
 *
 * Provides realistic mock data for development and testing.
 * Used when ZOHO_MODE=mock or when Zoho is not configured.
 */

import type { CachedCustomer } from '../activities/resolve-customer';
import type { CachedItem, ItemCandidate } from '../activities/resolve-items';

/**
 * Sample customer names for realistic mock data
 */
const SAMPLE_CUSTOMER_NAMES = [
  'Acme Corporation',
  'TechStart Ltd',
  'Global Imports Co',
  'Premium Retail Group',
  'Fashion Forward Ltd',
  'Boutique Elegance',
  'Modern Living Stores',
  'Luxury Goods International',
  'HomeStyle Retailers',
  'Urban Outfitters UK',
  'The Design Company',
  'Lifestyle Brands Inc',
  'Quality Products Ltd',
  'Retail Solutions Group',
  'Consumer Direct Ltd',
];

/**
 * Sample product names for realistic mock data
 */
const SAMPLE_PRODUCT_NAMES = [
  'Silk Scarf - Floral Pattern',
  'Leather Handbag - Classic Black',
  'Cotton T-Shirt - Premium White',
  'Wool Sweater - Cashmere Blend',
  'Denim Jeans - Slim Fit',
  'Linen Shirt - Summer Collection',
  'Canvas Tote Bag - Large',
  'Silk Tie - Business Collection',
  'Leather Belt - Italian Style',
  'Cashmere Scarf - Winter Range',
  'Cotton Dress - Spring Design',
  'Wool Coat - Classic Cut',
  'Leather Wallet - Bifold',
  'Silk Blouse - Office Wear',
  'Cotton Polo - Sport Range',
];

/**
 * Generate mock customers for testing
 *
 * @param count - Number of customers to generate
 * @returns Array of mock cached customers
 */
export function generateMockCustomers(count: number = 10): CachedCustomer[] {
  return Array.from({ length: count }, (_, i) => {
    const name = SAMPLE_CUSTOMER_NAMES[i % SAMPLE_CUSTOMER_NAMES.length];
    const suffix = count > SAMPLE_CUSTOMER_NAMES.length ? ` ${Math.floor(i / SAMPLE_CUSTOMER_NAMES.length) + 1}` : '';

    return {
      zoho_customer_id: `mock-customer-${String(i + 1).padStart(5, '0')}`,
      display_name: `${name}${suffix}`,
      company_name: `${name}${suffix}`,
      contact_type: 'customer',
      status: 'active',
      email: `contact${i + 1}@${name.toLowerCase().replace(/[^a-z]/g, '')}.example.com`,
      phone: `+44 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(100000 + Math.random() * 900000)}`,
      last_cached_at: new Date().toISOString(),
    };
  });
}

/**
 * Generate mock items for testing
 *
 * @param count - Number of items to generate
 * @returns Array of mock cached items
 */
export function generateMockItems(count: number = 50): CachedItem[] {
  return Array.from({ length: count }, (_, i) => {
    const name = SAMPLE_PRODUCT_NAMES[i % SAMPLE_PRODUCT_NAMES.length];
    const variant = count > SAMPLE_PRODUCT_NAMES.length
      ? ` - Variant ${Math.floor(i / SAMPLE_PRODUCT_NAMES.length) + 1}`
      : '';

    // Generate realistic SKU and GTIN
    const skuBase = name.split(' ')[0].toUpperCase().substring(0, 3);
    const sku = `${skuBase}-${String(i + 1).padStart(5, '0')}`;

    // EAN-13 format GTIN (13 digits)
    const gtinBase = `5012345${String(i).padStart(5, '0')}`;
    const gtin = gtinBase + calculateEAN13CheckDigit(gtinBase);

    return {
      zoho_item_id: `mock-item-${String(i + 1).padStart(6, '0')}`,
      name: `${name}${variant}`,
      sku,
      gtin,
      rate: parseFloat((10 + Math.random() * 190).toFixed(2)),
      unit: 'pcs',
      status: 'active',
      description: `Mock item: ${name}${variant}`,
      last_cached_at: new Date().toISOString(),
    };
  });
}

/**
 * Generate mock item candidates for disambiguation scenarios
 *
 * @param baseName - Base product name to create variants of
 * @param count - Number of candidates to generate
 * @returns Array of mock item candidates
 */
export function generateMockItemCandidates(baseName: string, count: number = 3): ItemCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    zohoItemId: `mock-candidate-${i + 1}`,
    name: `${baseName} (Option ${String.fromCharCode(65 + i)})`,
    sku: `MOCK-${String.fromCharCode(65 + i)}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    gtin: undefined,
    rate: parseFloat((15 + Math.random() * 85).toFixed(2)),
    score: parseFloat((0.95 - i * 0.1).toFixed(2)),
    matchReasons: [i === 0 ? 'Best fuzzy match' : 'Fuzzy name match'],
  }));
}

/**
 * Get a specific mock customer by pattern matching
 *
 * Useful for consistent test scenarios.
 *
 * @param searchTerm - Term to search for in customer name
 * @returns Matching mock customer or undefined
 */
export function findMockCustomer(searchTerm: string): CachedCustomer | undefined {
  const customers = generateMockCustomers(15);
  const normalizedSearch = searchTerm.toLowerCase();

  return customers.find(
    (c) =>
      c.display_name.toLowerCase().includes(normalizedSearch) ||
      c.company_name.toLowerCase().includes(normalizedSearch)
  );
}

/**
 * Get a specific mock item by SKU or name pattern
 *
 * @param searchTerm - SKU or name to search for
 * @returns Matching mock item or undefined
 */
export function findMockItem(searchTerm: string): CachedItem | undefined {
  const items = generateMockItems(50);
  const normalizedSearch = searchTerm.toLowerCase();

  return items.find(
    (item) =>
      item.sku?.toLowerCase() === normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch)
  );
}

/**
 * Calculate EAN-13 check digit
 *
 * @param digits - First 12 digits of EAN-13
 * @returns Check digit (0-9)
 */
function calculateEAN13CheckDigit(digits: string): string {
  if (digits.length !== 12) {
    throw new Error('EAN-13 requires exactly 12 digits for check calculation');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Pre-generated mock data sets for common test scenarios
 */
export const MockScenarios = {
  /**
   * Single exact match customer
   */
  exactMatchCustomer: {
    input: 'Acme Corporation',
    expected: generateMockCustomers(1)[0],
  },

  /**
   * Ambiguous customer match (multiple similar names)
   */
  ambiguousCustomer: {
    input: 'Tech',
    candidates: generateMockCustomers(15).filter((c) =>
      c.display_name.toLowerCase().includes('tech')
    ),
  },

  /**
   * No match customer
   */
  noMatchCustomer: {
    input: 'NonExistent Company XYZ123',
    candidates: [],
  },

  /**
   * Single exact SKU match
   */
  exactSkuMatch: {
    sku: 'SIL-00001',
    expected: generateMockItems(1)[0],
  },

  /**
   * GTIN match
   */
  gtinMatch: {
    gtin: '5012345000001',
    expected: generateMockItems(2)[1],
  },

  /**
   * Ambiguous item match
   */
  ambiguousItem: {
    name: 'Silk',
    candidates: generateMockItems(50).filter((item) =>
      item.name.toLowerCase().includes('silk')
    ),
  },
} as const;
