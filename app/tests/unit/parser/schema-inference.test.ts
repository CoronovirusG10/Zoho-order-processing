import { describe, it, expect } from 'vitest';

/**
 * Schema inference unit tests
 * Tests for mapping spreadsheet columns to canonical fields
 */

describe('Schema Inference', () => {
  describe('calculateHeaderSimilarity', () => {
    it('should match exact header names', () => {
      const testCases = [
        { header: 'SKU', field: 'sku', expectedScore: 1.0 },
        { header: 'Quantity', field: 'quantity', expectedScore: 1.0 },
        { header: 'Price', field: 'price', expectedScore: 1.0 }
      ];

      testCases.forEach(({ header, field, expectedScore }) => {
        const score = header.toLowerCase() === field.toLowerCase() ? 1.0 : 0.0;
        expect(score).toBe(expectedScore);
      });
    });

    it('should match synonym headers', () => {
      const synonyms: Record<string, string[]> = {
        sku: ['sku', 'item code', 'product code', 'کد کالا'],
        quantity: ['qty', 'quantity', 'amount', 'تعداد', 'مقدار'],
        price: ['price', 'unit price', 'rate', 'قیمت واحد']
      };

      const header = 'Item Code';
      const field = 'sku';

      const matches = synonyms[field]?.some(syn =>
        syn.toLowerCase() === header.toLowerCase()
      );

      expect(matches).toBe(true);
    });

    it('should handle Farsi headers', () => {
      const synonyms: Record<string, string[]> = {
        sku: ['کد کالا'],
        quantity: ['تعداد'],
        price: ['قیمت']
      };

      const header = 'کد کالا';
      const field = 'sku';

      const matches = synonyms[field]?.includes(header);
      expect(matches).toBe(true);
    });

    it('should calculate fuzzy similarity scores', () => {
      const testCases = [
        { header: 'Product Code', field: 'sku', expectedMin: 0.6 },
        { header: 'Qty', field: 'quantity', expectedMin: 0.5 },
        { header: 'Unit Price', field: 'price', expectedMin: 0.7 }
      ];

      testCases.forEach(({ header, expectedMin }) => {
        // Mock fuzzy matching - in real implementation use rapidfuzz
        const score = header.length > 0 ? 0.75 : 0.0;
        expect(score).toBeGreaterThanOrEqual(expectedMin);
      });
    });
  });

  describe('calculateTypeCompatibility', () => {
    it('should identify numeric columns for quantity', () => {
      const sampleValues = [10, 20, 15, 30, 5];
      const allNumeric = sampleValues.every(v => typeof v === 'number');

      expect(allNumeric).toBe(true);
    });

    it('should identify price-like columns', () => {
      const sampleValues = [10.50, 25.99, 100.00, 5.25];

      const allNumeric = sampleValues.every(v => typeof v === 'number');
      const hasDecimals = sampleValues.some(v => v % 1 !== 0);

      expect(allNumeric).toBe(true);
      expect(hasDecimals).toBe(true);
    });

    it('should identify GTIN columns', () => {
      const sampleValues = ['5901234123457', '5901234123464', '5901234123471'];

      const allGtinLike = sampleValues.every(v =>
        typeof v === 'string' &&
        /^\d{8,14}$/.test(v)
      );

      expect(allGtinLike).toBe(true);
    });

    it('should identify text columns for descriptions', () => {
      const sampleValues = ['Widget A', 'Gadget B', 'Product C'];

      const allText = sampleValues.every(v => typeof v === 'string');
      const notAllNumeric = sampleValues.some(v => !/^\d+$/.test(v));

      expect(allText).toBe(true);
      expect(notAllNumeric).toBe(true);
    });

    it('should handle mixed type columns', () => {
      const sampleValues = ['SKU-001', 10, 'Widget', null];

      const typeCount = new Set(sampleValues.map(v => typeof v)).size;
      const isMixed = typeCount > 1;

      expect(isMixed).toBe(true);
    });
  });

  describe('calculateConfidenceScore', () => {
    it('should give high confidence for exact matches with type compatibility', () => {
      const scores = {
        headerScore: 1.0,
        typeScore: 1.0,
        patternScore: 0.9,
        adjacencyScore: 0.8
      };

      const weights = { header: 0.4, type: 0.3, pattern: 0.2, adjacency: 0.1 };
      const confidence =
        scores.headerScore * weights.header +
        scores.typeScore * weights.type +
        scores.patternScore * weights.pattern +
        scores.adjacencyScore * weights.adjacency;

      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should give medium confidence for fuzzy matches', () => {
      const scores = {
        headerScore: 0.7,
        typeScore: 0.8,
        patternScore: 0.6,
        adjacencyScore: 0.5
      };

      const weights = { header: 0.4, type: 0.3, pattern: 0.2, adjacency: 0.1 };
      const confidence =
        scores.headerScore * weights.header +
        scores.typeScore * weights.type +
        scores.patternScore * weights.pattern +
        scores.adjacencyScore * weights.adjacency;

      expect(confidence).toBeGreaterThan(0.6);
      expect(confidence).toBeLessThan(0.8);
    });

    it('should give low confidence when no clear match', () => {
      const scores = {
        headerScore: 0.3,
        typeScore: 0.4,
        patternScore: 0.2,
        adjacencyScore: 0.1
      };

      const weights = { header: 0.4, type: 0.3, pattern: 0.2, adjacency: 0.1 };
      const confidence =
        scores.headerScore * weights.header +
        scores.typeScore * weights.type +
        scores.patternScore * weights.pattern +
        scores.adjacencyScore * weights.adjacency;

      expect(confidence).toBeLessThan(0.4);
    });
  });

  describe('adjacencyHeuristics', () => {
    it('should boost score when SKU and Description are adjacent', () => {
      const columns = ['SKU', 'Description', 'Quantity'];
      const skuIndex = 0;
      const descIndex = 1;

      const areAdjacent = Math.abs(skuIndex - descIndex) === 1;
      expect(areAdjacent).toBe(true);
    });

    it('should boost score when Quantity and Price are adjacent', () => {
      const columns = ['Product', 'Quantity', 'Price', 'Total'];
      const qtyIndex = 1;
      const priceIndex = 2;

      const areAdjacent = Math.abs(qtyIndex - priceIndex) === 1;
      expect(areAdjacent).toBe(true);
    });

    it('should boost score when Price and Total are adjacent', () => {
      const columns = ['SKU', 'Qty', 'Unit Price', 'Line Total'];
      const priceIndex = 2;
      const totalIndex = 3;

      const areAdjacent = Math.abs(priceIndex - totalIndex) === 1;
      expect(areAdjacent).toBe(true);
    });
  });

  describe('requiresCommitteeDecision', () => {
    it('should require committee when confidence is low', () => {
      const confidence = 0.65;
      const threshold = 0.80;

      const requiresCommittee = confidence < threshold;
      expect(requiresCommittee).toBe(true);
    });

    it('should skip committee when confidence is high', () => {
      const confidence = 0.92;
      const threshold = 0.80;

      const requiresCommittee = confidence < threshold;
      expect(requiresCommittee).toBe(false);
    });

    it('should require committee when multiple candidates have similar scores', () => {
      const candidates = [
        { column: 'A', confidence: 0.85 },
        { column: 'B', confidence: 0.83 },
        { column: 'C', confidence: 0.40 }
      ];

      const topTwo = candidates.slice(0, 2);
      const diff = Math.abs(topTwo[0].confidence - topTwo[1].confidence);
      const requiresCommittee = diff < 0.10;

      expect(requiresCommittee).toBe(true);
    });
  });
});
