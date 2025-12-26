/**
 * Match headers to canonical fields using synonyms and fuzzy matching
 *
 * Matching strategy:
 * 1. Exact synonym match (dictionary lookup)
 * 2. Substring synonym match (partial match)
 * 3. Fuzzy match (Levenshtein distance)
 * 4. Type compatibility scoring
 */

import { distance as levenshteinDistance } from 'fastest-levenshtein';
import { normalizeHeader, matchesSynonym, getSynonyms } from './synonyms';
import { detectColumnType, isTypeCompatible } from './type-detector';
import { Worksheet } from 'exceljs';
import { ColumnMapping } from '../types';

interface MatchCandidate {
  header: string;
  column: string;
  columnIndex: number;
  score: number;
  method: 'exact' | 'synonym' | 'fuzzy';
}

export function matchHeaders(
  worksheet: Worksheet,
  headerRow: number,
  canonicalFields: string[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const headers = extractHeaders(worksheet, headerRow);

  for (const field of canonicalFields) {
    const match = findBestMatch(field, headers, worksheet, headerRow);

    if (match) {
      mappings.push({
        canonical_field: field,
        source_header: match.header,
        source_column: match.column,
        confidence: match.score,
        method: match.method === 'exact' || match.method === 'synonym' ? 'dictionary' : 'fuzzy',
        candidates: match.candidates?.map(c => ({
          header: c.header,
          column: c.column,
          score: c.score
        }))
      });
    }
  }

  return mappings;
}

function extractHeaders(worksheet: Worksheet, headerRow: number): Array<{
  header: string;
  column: string;
  columnIndex: number;
}> {
  const headers: Array<{ header: string; column: string; columnIndex: number }> = [];
  const row = worksheet.getRow(headerRow);

  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const value = cell.value;
    if (value && typeof value === 'string') {
      headers.push({
        header: value.trim(),
        column: cell.address.replace(/\d+/, ''),
        columnIndex: colNumber
      });
    }
  });

  return headers;
}

function findBestMatch(
  canonicalField: string,
  headers: Array<{ header: string; column: string; columnIndex: number }>,
  worksheet: Worksheet,
  headerRow: number
): (MatchCandidate & { candidates?: MatchCandidate[] }) | null {
  const candidates: MatchCandidate[] = [];
  const synonyms = getSynonyms(canonicalField);

  // Check each header
  for (const { header, column, columnIndex } of headers) {
    const normalized = normalizeHeader(header);

    // 1. Exact synonym match
    for (const syn of synonyms) {
      const normalizedSyn = normalizeHeader(syn);

      if (normalized === normalizedSyn) {
        candidates.push({
          header,
          column,
          columnIndex,
          score: 1.0,
          method: 'exact'
        });
        break;
      }
    }

    // 2. Synonym substring match
    if (matchesSynonym(header, canonicalField)) {
      const synScore = calculateSynonymScore(normalized, synonyms);
      if (synScore > 0.6) {
        candidates.push({
          header,
          column,
          columnIndex,
          score: synScore,
          method: 'synonym'
        });
      }
    }

    // 3. Fuzzy match
    const fuzzyScore = calculateFuzzyScore(normalized, synonyms);
    if (fuzzyScore > 0.6) {
      candidates.push({
        header,
        column,
        columnIndex,
        score: fuzzyScore,
        method: 'fuzzy'
      });
    }
  }

  // Remove duplicates (keep highest score)
  const uniqueCandidates = new Map<number, MatchCandidate>();
  for (const candidate of candidates) {
    const existing = uniqueCandidates.get(candidate.columnIndex);
    if (!existing || candidate.score > existing.score) {
      uniqueCandidates.set(candidate.columnIndex, candidate);
    }
  }

  const finalCandidates = Array.from(uniqueCandidates.values());

  // Apply type compatibility scoring
  for (const candidate of finalCandidates) {
    const typeResult = detectColumnType(worksheet, candidate.columnIndex, headerRow + 1, Math.min(worksheet.rowCount, headerRow + 50));
    const typeCompat = isTypeCompatible(typeResult.type, canonicalField);

    // Adjust score based on type compatibility
    candidate.score = candidate.score * 0.7 + typeCompat.confidence * 0.3;
  }

  // Sort by score
  finalCandidates.sort((a, b) => b.score - a.score);

  if (finalCandidates.length === 0) {
    return null;
  }

  const best = finalCandidates[0];

  return {
    ...best,
    candidates: finalCandidates.slice(0, 5)
  };
}

function calculateSynonymScore(normalized: string, synonyms: string[]): number {
  let bestScore = 0;

  for (const syn of synonyms) {
    const normalizedSyn = normalizeHeader(syn);

    if (normalized === normalizedSyn) {
      return 1.0;
    }

    // Substring match
    if (normalized.includes(normalizedSyn)) {
      const score = normalizedSyn.length / normalized.length;
      bestScore = Math.max(bestScore, score);
    } else if (normalizedSyn.includes(normalized)) {
      const score = normalized.length / normalizedSyn.length;
      bestScore = Math.max(bestScore, score);
    }
  }

  return bestScore;
}

function calculateFuzzyScore(normalized: string, synonyms: string[]): number {
  let bestScore = 0;

  for (const syn of synonyms) {
    const normalizedSyn = normalizeHeader(syn);

    // Use Levenshtein distance for fuzzy matching
    const dist = levenshteinDistance(normalized, normalizedSyn);
    const maxLen = Math.max(normalized.length, normalizedSyn.length);

    if (maxLen > 0) {
      const similarity = 1 - (dist / maxLen);
      bestScore = Math.max(bestScore, similarity);
    }
  }

  return bestScore;
}

/**
 * Get canonical fields in priority order
 */
export function getCanonicalFields(): string[] {
  return [
    'customer',
    'sku',
    'gtin',
    'product_name',
    'quantity',
    'unit_price',
    'line_total',
    'subtotal',
    'tax',
    'total'
  ];
}
