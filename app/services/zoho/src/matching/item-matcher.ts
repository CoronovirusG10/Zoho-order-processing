/**
 * Item Matcher
 *
 * Matches items from spreadsheets to Zoho items using priority matching:
 * 1. SKU exact match (primary)
 * 2. GTIN exact match (custom field)
 * 3. Name fuzzy match (if enabled)
 */

import { CachedItem, ItemMatchResult } from '../types.js';
import { FuzzyMatcher, normalizeString } from './fuzzy-matcher.js';

export interface ItemMatchOptions {
  fuzzyNameMatchEnabled?: boolean; // Default: false (SKU/GTIN only)
  fuzzyMatchThreshold?: number; // Default: 0.80
  ambiguityThreshold?: number; // Default: 0.1
  maxCandidates?: number; // Default: 5
}

export class ItemMatcher {
  private readonly options: Required<ItemMatchOptions>;

  constructor(options: ItemMatchOptions = {}) {
    this.options = {
      fuzzyNameMatchEnabled: options.fuzzyNameMatchEnabled ?? false,
      fuzzyMatchThreshold: options.fuzzyMatchThreshold ?? 0.80,
      ambiguityThreshold: options.ambiguityThreshold ?? 0.1,
      maxCandidates: options.maxCandidates ?? 5,
    };
  }

  /**
   * Match an item from the spreadsheet to Zoho items
   * Priority: SKU > GTIN > Name (if enabled)
   */
  async matchItem(
    sku: string | null,
    gtin: string | null,
    name: string | null,
    items: CachedItem[]
  ): Promise<ItemMatchResult> {
    // Priority 1: SKU exact match
    if (sku && sku.trim() !== '') {
      const skuMatch = this.matchBySku(sku, items);
      if (skuMatch) {
        return skuMatch;
      }
    }

    // Priority 2: GTIN exact match
    if (gtin && gtin.trim() !== '') {
      const gtinMatch = this.matchByGtin(gtin, items);
      if (gtinMatch) {
        return gtinMatch;
      }
    }

    // Priority 3: Name fuzzy match (if enabled)
    if (this.options.fuzzyNameMatchEnabled && name && name.trim() !== '') {
      const nameMatch = this.matchByName(name, items);
      if (nameMatch) {
        return nameMatch;
      }
    }

    // No match found
    return {
      status: 'not_found',
      confidence: 0,
      candidates: [],
    };
  }

  /**
   * Match by SKU (exact match, case-insensitive)
   */
  private matchBySku(sku: string, items: CachedItem[]): ItemMatchResult | null {
    const normalizedSku = this.normalizeSku(sku);

    const matches = items.filter((item) => {
      if (!item.sku) return false;
      return this.normalizeSku(item.sku) === normalizedSku;
    });

    if (matches.length === 0) {
      return null;
    }

    if (matches.length === 1) {
      const match = matches[0];
      return {
        status: 'resolved',
        item: {
          zoho_item_id: match.zoho_item_id,
          name: match.name,
          rate: match.rate,
        },
        method: 'sku',
        confidence: 1.0,
        candidates: [
          {
            zoho_item_id: match.zoho_item_id,
            sku: match.sku,
            gtin: match.gtin,
            name: match.name,
            rate: match.rate,
            score: 1.0,
            match_reason: 'Exact SKU match',
          },
        ],
      };
    }

    // Multiple SKU matches (should be rare, but possible)
    return {
      status: 'ambiguous',
      confidence: 1.0,
      candidates: matches.map((match) => ({
        zoho_item_id: match.zoho_item_id,
        sku: match.sku,
        gtin: match.gtin,
        name: match.name,
        rate: match.rate,
        score: 1.0,
        match_reason: 'Exact SKU match (multiple items with same SKU)',
      })),
    };
  }

  /**
   * Match by GTIN (exact match)
   */
  private matchByGtin(gtin: string, items: CachedItem[]): ItemMatchResult | null {
    const normalizedGtin = this.normalizeGtin(gtin);

    const matches = items.filter((item) => {
      if (!item.gtin) return false;
      return this.normalizeGtin(item.gtin) === normalizedGtin;
    });

    if (matches.length === 0) {
      return null;
    }

    if (matches.length === 1) {
      const match = matches[0];
      return {
        status: 'resolved',
        item: {
          zoho_item_id: match.zoho_item_id,
          name: match.name,
          rate: match.rate,
        },
        method: 'gtin',
        confidence: 1.0,
        candidates: [
          {
            zoho_item_id: match.zoho_item_id,
            sku: match.sku,
            gtin: match.gtin,
            name: match.name,
            rate: match.rate,
            score: 1.0,
            match_reason: 'Exact GTIN match',
          },
        ],
      };
    }

    // Multiple GTIN matches
    return {
      status: 'ambiguous',
      confidence: 1.0,
      candidates: matches.map((match) => ({
        zoho_item_id: match.zoho_item_id,
        sku: match.sku,
        gtin: match.gtin,
        name: match.name,
        rate: match.rate,
        score: 1.0,
        match_reason: 'Exact GTIN match (multiple items with same GTIN)',
      })),
    };
  }

  /**
   * Match by name using fuzzy matching
   */
  private matchByName(name: string, items: CachedItem[]): ItemMatchResult | null {
    const fuzzyMatcher = new FuzzyMatcher(items, {
      threshold: 0.3,
      keys: ['name'],
      limit: this.options.maxCandidates * 2,
    });

    const results = fuzzyMatcher.search(name, this.options.maxCandidates);

    if (results.length === 0) {
      return null;
    }

    const bestMatch = results[0];

    if (bestMatch.score < this.options.fuzzyMatchThreshold) {
      // Low confidence - needs user input
      return {
        status: 'needs_user_input',
        confidence: bestMatch.score,
        candidates: results.map((r) => ({
          zoho_item_id: r.item.zoho_item_id,
          sku: r.item.sku,
          gtin: r.item.gtin,
          name: r.item.name,
          rate: r.item.rate,
          score: r.score,
          match_reason: 'Fuzzy name match',
        })),
      };
    }

    // Check for ambiguity
    const isAmbiguous = this.isAmbiguous(results);

    if (isAmbiguous) {
      return {
        status: 'ambiguous',
        confidence: bestMatch.score,
        candidates: results.map((r) => ({
          zoho_item_id: r.item.zoho_item_id,
          sku: r.item.sku,
          gtin: r.item.gtin,
          name: r.item.name,
          rate: r.item.rate,
          score: r.score,
          match_reason: 'Fuzzy name match',
        })),
      };
    }

    return {
      status: 'resolved',
      item: {
        zoho_item_id: bestMatch.item.zoho_item_id,
        name: bestMatch.item.name,
        rate: bestMatch.item.rate,
      },
      method: 'name_fuzzy',
      confidence: bestMatch.score,
      candidates: results.map((r) => ({
        zoho_item_id: r.item.zoho_item_id,
        sku: r.item.sku,
        gtin: r.item.gtin,
        name: r.item.name,
        rate: r.item.rate,
        score: r.score,
        match_reason: 'Fuzzy name match',
      })),
    };
  }

  /**
   * Check if top matches are ambiguous
   */
  private isAmbiguous(results: Array<{ score: number }>): boolean {
    if (results.length < 2) {
      return false;
    }

    const topScore = results[0].score;
    const secondScore = results[1].score;

    return Math.abs(topScore - secondScore) < this.options.ambiguityThreshold;
  }

  /**
   * Normalize SKU for comparison
   */
  private normalizeSku(sku: string): string {
    return sku.trim().toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Normalize GTIN for comparison (remove spaces, dashes)
   */
  private normalizeGtin(gtin: string): string {
    return gtin.replace(/[\s\-]/g, '').trim();
  }

  /**
   * Validate GTIN format (8, 12, 13, or 14 digits)
   */
  isValidGtin(gtin: string): boolean {
    const normalized = this.normalizeGtin(gtin);
    return /^\d{8}$|^\d{12,14}$/.test(normalized);
  }
}
