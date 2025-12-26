/**
 * Fuzzy Matching Utilities
 *
 * Provides fuzzy string matching using Fuse.js for customer and item name matching.
 * Used as fallback when exact SKU/GTIN matching fails.
 */

import Fuse, { IFuseOptions, FuseResultMatch } from 'fuse.js';
import { FuzzyMatchOptions } from '../types.js';

export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
  matches?: readonly FuseResultMatch[];
}

export class FuzzyMatcher<T> {
  private fuse: Fuse<T>;

  constructor(items: T[], options: Partial<FuzzyMatchOptions>) {
    const defaultOptions: IFuseOptions<T> = {
      includeScore: true,
      includeMatches: true,
      threshold: options.threshold || 0.4, // 0 = exact, 1 = match anything
      distance: options.distance || 100,
      minMatchCharLength: options.minMatchCharLength || 2,
      keys: options.keys || ['name'],
      shouldSort: options.shouldSort !== false,
      findAllMatches: options.findAllMatches !== false,
    };

    this.fuse = new Fuse(items, defaultOptions);
  }

  /**
   * Search for matches
   */
  search(query: string, limit?: number): FuzzyMatchResult<T>[] {
    const results = this.fuse.search(query, limit ? { limit } : undefined);

    return results.map((result) => ({
      item: result.item,
      score: 1 - (result.score || 0), // Invert score so higher = better match
      matches: result.matches,
    }));
  }

  /**
   * Find the best match (highest score)
   */
  findBest(query: string): FuzzyMatchResult<T> | null {
    const results = this.search(query, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Check if there are multiple high-scoring matches (ambiguous)
   */
  isAmbiguous(query: string, ambiguityThreshold: number = 0.1): boolean {
    const results = this.search(query, 5);

    if (results.length < 2) {
      return false;
    }

    // Check if top two results have similar scores
    const topScore = results[0].score;
    const secondScore = results[1].score;

    return Math.abs(topScore - secondScore) < ambiguityThreshold;
  }

  /**
   * Get top N candidates
   */
  getTopCandidates(query: string, n: number = 5): FuzzyMatchResult<T>[] {
    return this.search(query, n);
  }

  /**
   * Update the search index with new items
   */
  updateIndex(items: T[]): void {
    this.fuse.setCollection(items);
  }
}

/**
 * Normalize string for comparison
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

/**
 * Calculate simple Levenshtein distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score based on Levenshtein distance
 */
export function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(
    normalizeString(a),
    normalizeString(b)
  );

  const maxLength = Math.max(a.length, b.length);

  if (maxLength === 0) {
    return 1.0;
  }

  return 1 - distance / maxLength;
}
