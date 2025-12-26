/**
 * Evidence types for tracking data sources in spreadsheets
 */

/**
 * Evidence cell reference pointing to a specific cell in a spreadsheet
 */
export interface EvidenceCell {
  /** Sheet name */
  sheet: string;
  /** Cell reference (e.g., "A1", "B5") */
  cell: string;
  /** Raw value from the cell (can be any type: string, number, boolean, null, etc.) */
  raw_value?: unknown;
  /** Display/formatted value */
  display_value?: string | null;
  /** Excel number format string */
  number_format?: string | null;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Evidence for line item fields
 */
export interface LineItemEvidence {
  sku?: EvidenceCell;
  gtin?: EvidenceCell;
  product_name?: EvidenceCell;
  quantity?: EvidenceCell;
  unit_price_source?: EvidenceCell;
  line_total_source?: EvidenceCell;
  /** Allow additional evidence fields */
  [key: string]: EvidenceCell | undefined;
}

/**
 * Evidence for totals fields
 */
export interface TotalsEvidence {
  [key: string]: EvidenceCell;
}
