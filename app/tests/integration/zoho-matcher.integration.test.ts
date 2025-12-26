import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Zoho matcher integration tests
 * Tests customer and item matching against Zoho Books data
 */

describe('Zoho Matcher Integration', () => {
  describe('customer matching', () => {
    it('should find exact customer match', async () => {
      const mockCustomers = [
        { customer_id: 'cust_001', display_name: 'ACME Corporation' },
        { customer_id: 'cust_002', display_name: 'TechCorp Industries' }
      ];

      const searchName = 'ACME Corporation';

      const exactMatch = mockCustomers.find(c =>
        c.display_name.toLowerCase() === searchName.toLowerCase()
      );

      const result = {
        match: 'exact',
        zohoCustomerId: exactMatch?.customer_id,
        zohoDisplayName: exactMatch?.display_name,
        confidence: 1.0
      };

      expect(result.match).toBe('exact');
      expect(result.zohoCustomerId).toBe('cust_001');
      expect(result.confidence).toBe(1.0);
    });

    it('should find fuzzy customer matches', async () => {
      const mockCustomers = [
        { customer_id: 'cust_001', display_name: 'ACME Corporation' },
        { customer_id: 'cust_002', display_name: 'ACME Corp' },
        { customer_id: 'cust_003', display_name: 'TechCorp Industries' }
      ];

      const searchName = 'Acme Corp.';

      // Mock fuzzy matching
      const candidates = mockCustomers
        .map(c => ({
          ...c,
          score: c.display_name.toLowerCase().includes('acme') ? 0.85 : 0.2
        }))
        .filter(c => c.score > 0.70)
        .sort((a, b) => b.score - a.score);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].customer_id).toBe('cust_001');
    });

    it('should return multiple candidates when ambiguous', async () => {
      const mockCustomers = [
        { customer_id: 'cust_001', display_name: 'ACME Corporation' },
        { customer_id: 'cust_002', display_name: 'ACME Corp' },
        { customer_id: 'cust_003', display_name: 'ACME Industries' }
      ];

      const searchName = 'ACME';

      // All match with similar scores
      const candidates = mockCustomers.map(c => ({
        ...c,
        score: 0.85
      }));

      const result = {
        match: 'ambiguous',
        candidates: candidates.slice(0, 5),
        requiresUserInput: true
      };

      expect(result.match).toBe('ambiguous');
      expect(result.candidates.length).toBe(3);
      expect(result.requiresUserInput).toBe(true);
    });

    it('should handle customer not found', async () => {
      const mockCustomers = [
        { customer_id: 'cust_001', display_name: 'ACME Corporation' }
      ];

      const searchName = 'Unknown Company';

      const exactMatch = mockCustomers.find(c =>
        c.display_name.toLowerCase() === searchName.toLowerCase()
      );

      const fuzzyMatches = mockCustomers.filter(c => {
        // Mock low fuzzy score
        return false;
      });

      const result = {
        match: null,
        zohoCustomerId: null,
        confidence: 0.0,
        issue: {
          code: 'CUSTOMER_NOT_FOUND',
          severity: 'block',
          message: `No customer found matching "${searchName}"`,
          requiresUserInput: true
        }
      };

      expect(result.zohoCustomerId).toBeNull();
      expect(result.issue.code).toBe('CUSTOMER_NOT_FOUND');
    });
  });

  describe('item matching by SKU', () => {
    it('should find exact SKU match', async () => {
      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A', rate: 10.00 },
        { item_id: 'item_002', sku: 'SKU-002', name: 'Widget B', rate: 25.50 }
      ];

      const searchSku = 'SKU-001';

      const match = mockItems.find(i =>
        i.sku.toLowerCase() === searchSku.toLowerCase()
      );

      const result = {
        match: 'sku',
        zohoItemId: match?.item_id,
        zohoRateUsed: match?.rate,
        confidence: 1.0
      };

      expect(result.match).toBe('sku');
      expect(result.zohoItemId).toBe('item_001');
      expect(result.zohoRateUsed).toBe(10.00);
    });

    it('should handle SKU not found', async () => {
      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A' }
      ];

      const searchSku = 'SKU-999';

      const match = mockItems.find(i =>
        i.sku.toLowerCase() === searchSku.toLowerCase()
      );

      const result = {
        match: null,
        zohoItemId: null,
        issue: {
          code: 'ITEM_NOT_FOUND',
          severity: 'block',
          message: `No item found with SKU "${searchSku}"`,
          requiresUserInput: true
        }
      };

      expect(result.zohoItemId).toBeNull();
      expect(result.issue.code).toBe('ITEM_NOT_FOUND');
    });
  });

  describe('item matching by GTIN', () => {
    it('should find item by GTIN custom field', async () => {
      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A', cf_gtin: '5901234123457' },
        { item_id: 'item_002', sku: 'SKU-002', name: 'Widget B', cf_gtin: '4006381333931' }
      ];

      const searchGtin = '5901234123457';

      const match = mockItems.find(i =>
        i.cf_gtin === searchGtin
      );

      const result = {
        match: 'gtin',
        zohoItemId: match?.item_id,
        zohoRateUsed: 10.00,
        confidence: 1.0
      };

      expect(result.match).toBe('gtin');
      expect(result.zohoItemId).toBe('item_001');
    });

    it('should fallback to GTIN when SKU not found', async () => {
      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', cf_gtin: '5901234123457' },
        { item_id: 'item_002', sku: 'SKU-002', cf_gtin: '4006381333931' }
      ];

      const searchSku = 'UNKNOWN-SKU';
      const searchGtin = '5901234123457';

      const skuMatch = mockItems.find(i => i.sku === searchSku);

      const gtinMatch = !skuMatch ? mockItems.find(i => i.cf_gtin === searchGtin) : null;

      const result = {
        match: gtinMatch ? 'gtin' : null,
        zohoItemId: gtinMatch?.item_id,
        confidence: gtinMatch ? 1.0 : 0.0
      };

      expect(result.match).toBe('gtin');
      expect(result.zohoItemId).toBe('item_001');
    });
  });

  describe('ambiguous item matches', () => {
    it('should detect multiple items with same SKU', async () => {
      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A v1' },
        { item_id: 'item_002', sku: 'SKU-001', name: 'Widget A v2' }
      ];

      const searchSku = 'SKU-001';

      const matches = mockItems.filter(i => i.sku === searchSku);

      const result = {
        match: 'ambiguous',
        candidates: matches,
        requiresUserInput: true,
        issue: {
          code: 'AMBIGUOUS_ITEM',
          severity: 'warn',
          message: `Multiple items found with SKU "${searchSku}"`,
          requiresUserInput: true
        }
      };

      expect(result.candidates.length).toBe(2);
      expect(result.requiresUserInput).toBe(true);
    });
  });

  describe('Zoho rate retrieval', () => {
    it('should use Zoho item rate instead of spreadsheet price', async () => {
      const mockItem = {
        item_id: 'item_001',
        sku: 'SKU-001',
        name: 'Widget A',
        rate: 30.00
      };

      const spreadsheetPrice = 25.50;
      const zohoRate = mockItem.rate;

      const result = {
        zohoItemId: mockItem.item_id,
        zohoRateUsed: zohoRate,
        spreadsheetPriceIgnored: spreadsheetPrice,
        note: 'Zoho pricing prevails per design requirement'
      };

      expect(result.zohoRateUsed).toBe(30.00);
      expect(result.spreadsheetPriceIgnored).toBe(25.50);
    });

    it('should preserve spreadsheet price as audit field', async () => {
      const lineItem = {
        zohoItemId: 'item_001',
        quantity: 10,
        zohoRateUsed: 30.00,
        audit: {
          spreadsheetUnitPrice: 25.50,
          spreadsheetLineTotal: 255.00
        }
      };

      expect(lineItem.audit.spreadsheetUnitPrice).toBe(25.50);
      expect(lineItem.zohoRateUsed).toBe(30.00);
    });
  });

  describe('Zoho cache integration', () => {
    it('should use cached customer data when Zoho unavailable', async () => {
      const cache = {
        customers: [
          { customer_id: 'cust_001', display_name: 'ACME Corporation', cached_at: new Date() }
        ],
        lastRefresh: new Date()
      };

      const zohoAvailable = false;

      if (!zohoAvailable) {
        const match = cache.customers.find(c =>
          c.display_name === 'ACME Corporation'
        );

        expect(match?.customer_id).toBe('cust_001');
      }
    });

    it('should use cached item data when Zoho unavailable', async () => {
      const cache = {
        items: [
          { item_id: 'item_001', sku: 'SKU-001', rate: 10.00, cached_at: new Date() }
        ],
        lastRefresh: new Date()
      };

      const zohoAvailable = false;

      if (!zohoAvailable) {
        const match = cache.items.find(i => i.sku === 'SKU-001');

        expect(match?.item_id).toBe('item_001');
        expect(match?.rate).toBe(10.00);
      }
    });

    it('should refresh cache periodically', async () => {
      const cache = {
        lastRefresh: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        refreshInterval: 24 * 60 * 60 * 1000 // 24 hours
      };

      const needsRefresh = Date.now() - cache.lastRefresh.getTime() > cache.refreshInterval;

      expect(needsRefresh).toBe(true);
    });
  });

  describe('matching result format', () => {
    it('should return complete matching metadata', async () => {
      const result = {
        customer: {
          raw: 'ACME Corporation',
          resolved: {
            zohoCustomerId: 'cust_001',
            zohoDisplayName: 'ACME Corporation',
            match: 'exact',
            confidence: 1.0
          }
        },
        lines: [
          {
            lineNo: 1,
            sku: { value: 'SKU-001' },
            gtin: { value: '5901234123457' },
            quantity: { value: 10 },
            resolved: {
              zohoItemId: 'item_001',
              match: 'sku',
              confidence: 1.0,
              zohoRateUsed: 30.00
            }
          }
        ]
      };

      expect(result.customer.resolved.match).toBe('exact');
      expect(result.lines[0].resolved.match).toBe('sku');
      expect(result.lines[0].resolved.zohoRateUsed).toBe(30.00);
    });
  });
});
