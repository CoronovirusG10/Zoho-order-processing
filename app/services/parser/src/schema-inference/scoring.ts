/**
 * Confidence scoring for schema inference
 */

import { ColumnMapping } from '../types';

export function calculateOverallConfidence(mappings: ColumnMapping[]): number {
  if (mappings.length === 0) {
    return 0;
  }

  // Required fields for a valid sales order
  const requiredFields = ['quantity'];
  const importantFields = ['sku', 'gtin', 'product_name', 'customer'];
  const optionalFields = ['unit_price', 'line_total'];

  let totalScore = 0;
  let requiredFound = 0;
  let importantFound = 0;

  const mappingsByField = new Map<string, ColumnMapping>();
  for (const mapping of mappings) {
    mappingsByField.set(mapping.canonical_field, mapping);
  }

  // Check required fields
  for (const field of requiredFields) {
    const mapping = mappingsByField.get(field);
    if (mapping) {
      requiredFound++;
      totalScore += mapping.confidence * 0.4; // 40% weight for required
    }
  }

  // Check important fields
  for (const field of importantFields) {
    const mapping = mappingsByField.get(field);
    if (mapping) {
      importantFound++;
      totalScore += mapping.confidence * 0.15; // 15% weight each
    }
  }

  // Check optional fields
  for (const field of optionalFields) {
    const mapping = mappingsByField.get(field);
    if (mapping) {
      totalScore += mapping.confidence * 0.075; // 7.5% weight each
    }
  }

  // Penalty if missing required fields
  if (requiredFound < requiredFields.length) {
    totalScore *= 0.5;
  }

  // Bonus if have most important fields
  if (importantFound >= 3) {
    totalScore *= 1.1;
  }

  return Math.min(totalScore, 1.0);
}

export function calculateStageConfidences(
  sheetConfidence: number,
  headerConfidence: number,
  mappingConfidence: number
): Record<string, number> {
  return {
    sheet_selection: sheetConfidence,
    header_detection: headerConfidence,
    column_mapping: mappingConfidence
  };
}

/**
 * Determine if confidence is sufficient for auto-processing
 */
export function isSufficientConfidence(
  overallConfidence: number,
  threshold: number = 0.80
): boolean {
  return overallConfidence >= threshold;
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.80) return 'high';
  if (confidence >= 0.60) return 'medium';
  return 'low';
}
