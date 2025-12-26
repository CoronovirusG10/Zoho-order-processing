/**
 * Customer Matcher
 *
 * Matches input customer names from spreadsheets to Zoho customers.
 * Priority: exact match > fuzzy match > user selection needed
 */

import { CachedCustomer, CustomerMatchResult } from '../types.js';
import { FuzzyMatcher, normalizeString, calculateSimilarity } from './fuzzy-matcher.js';

export interface CustomerMatchOptions {
  exactMatchThreshold?: number; // Default: 0.95
  fuzzyMatchThreshold?: number; // Default: 0.75
  ambiguityThreshold?: number; // Default: 0.1
  maxCandidates?: number; // Default: 5
}

export class CustomerMatcher {
  private readonly options: Required<CustomerMatchOptions>;

  constructor(options: CustomerMatchOptions = {}) {
    this.options = {
      exactMatchThreshold: options.exactMatchThreshold ?? 0.95,
      fuzzyMatchThreshold: options.fuzzyMatchThreshold ?? 0.75,
      ambiguityThreshold: options.ambiguityThreshold ?? 0.1,
      maxCandidates: options.maxCandidates ?? 5,
    };
  }

  /**
   * Match a customer name from the spreadsheet to Zoho customers
   */
  async matchCustomer(
    inputName: string,
    customers: CachedCustomer[]
  ): Promise<CustomerMatchResult> {
    if (!inputName || inputName.trim() === '') {
      return {
        status: 'not_found',
        confidence: 0,
        candidates: [],
      };
    }

    const normalizedInput = normalizeString(inputName);

    // Step 1: Try exact match on display_name
    const exactMatch = this.findExactMatch(normalizedInput, customers);
    if (exactMatch) {
      return {
        status: 'resolved',
        customer: {
          zoho_customer_id: exactMatch.zoho_customer_id,
          display_name: exactMatch.display_name,
        },
        method: 'exact',
        confidence: 1.0,
        candidates: [
          {
            zoho_customer_id: exactMatch.zoho_customer_id,
            display_name: exactMatch.display_name,
            score: 1.0,
            match_reason: 'Exact match on customer name',
          },
        ],
      };
    }

    // Step 2: Try fuzzy matching
    const fuzzyResults = this.findFuzzyMatches(inputName, customers);

    if (fuzzyResults.length === 0) {
      return {
        status: 'not_found',
        confidence: 0,
        candidates: [],
      };
    }

    const bestMatch = fuzzyResults[0];

    // Check if best match is confident enough
    if (bestMatch.score >= this.options.fuzzyMatchThreshold) {
      // Check for ambiguity
      const isAmbiguous = this.isAmbiguous(fuzzyResults);

      if (isAmbiguous) {
        return {
          status: 'ambiguous',
          confidence: bestMatch.score,
          candidates: fuzzyResults.slice(0, this.options.maxCandidates),
        };
      }

      return {
        status: 'resolved',
        customer: {
          zoho_customer_id: bestMatch.zoho_customer_id,
          display_name: bestMatch.display_name,
        },
        method: 'fuzzy',
        confidence: bestMatch.score,
        candidates: fuzzyResults.slice(0, this.options.maxCandidates),
      };
    }

    // Low confidence matches - needs user input
    return {
      status: 'needs_user_input',
      confidence: bestMatch.score,
      candidates: fuzzyResults.slice(0, this.options.maxCandidates),
    };
  }

  /**
   * Find exact match
   */
  private findExactMatch(
    normalizedInput: string,
    customers: CachedCustomer[]
  ): CachedCustomer | null {
    for (const customer of customers) {
      const normalizedName = normalizeString(customer.display_name);
      const normalizedCompany = customer.company_name
        ? normalizeString(customer.company_name)
        : '';

      if (
        normalizedName === normalizedInput ||
        normalizedCompany === normalizedInput
      ) {
        return customer;
      }
    }

    return null;
  }

  /**
   * Find fuzzy matches using multiple strategies
   */
  private findFuzzyMatches(
    inputName: string,
    customers: CachedCustomer[]
  ): Array<{
    zoho_customer_id: string;
    display_name: string;
    score: number;
    match_reason?: string;
  }> {
    const results: Array<{
      zoho_customer_id: string;
      display_name: string;
      score: number;
      match_reason?: string;
    }> = [];

    // Use Fuse.js for fuzzy matching on display_name and company_name
    const fuzzyMatcher = new FuzzyMatcher(customers, {
      threshold: 0.4,
      keys: ['display_name', 'company_name'],
      limit: this.options.maxCandidates * 2,
    });

    const fuzzyResults = fuzzyMatcher.search(inputName, this.options.maxCandidates * 2);

    for (const result of fuzzyResults) {
      results.push({
        zoho_customer_id: result.item.zoho_customer_id,
        display_name: result.item.display_name,
        score: result.score,
        match_reason: this.getMatchReason(result.matches),
      });
    }

    // Also calculate direct similarity scores
    for (const customer of customers) {
      const nameScore = calculateSimilarity(inputName, customer.display_name);
      const companyScore = customer.company_name
        ? calculateSimilarity(inputName, customer.company_name)
        : 0;

      const bestScore = Math.max(nameScore, companyScore);

      // Add if not already in results
      const exists = results.some(
        (r) => r.zoho_customer_id === customer.zoho_customer_id
      );

      if (!exists && bestScore > 0.6) {
        results.push({
          zoho_customer_id: customer.zoho_customer_id,
          display_name: customer.display_name,
          score: bestScore,
          match_reason:
            nameScore > companyScore
              ? 'Similar to customer name'
              : 'Similar to company name',
        });
      }
    }

    // Sort by score descending and remove duplicates
    const uniqueResults = Array.from(
      new Map(
        results.map((r) => [r.zoho_customer_id, r])
      ).values()
    ).sort((a, b) => b.score - a.score);

    return uniqueResults.slice(0, this.options.maxCandidates);
  }

  /**
   * Check if top matches are ambiguous
   */
  private isAmbiguous(
    results: Array<{ score: number }>
  ): boolean {
    if (results.length < 2) {
      return false;
    }

    const topScore = results[0].score;
    const secondScore = results[1].score;

    return Math.abs(topScore - secondScore) < this.options.ambiguityThreshold;
  }

  /**
   * Get human-readable match reason from Fuse.js matches
   */
  private getMatchReason(matches?: readonly any[]): string {
    if (!matches || matches.length === 0) {
      return 'Fuzzy match';
    }

    const firstMatch = matches[0];
    if (firstMatch.key === 'display_name') {
      return 'Matched on customer name';
    } else if (firstMatch.key === 'company_name') {
      return 'Matched on company name';
    }

    return 'Fuzzy match';
  }
}
