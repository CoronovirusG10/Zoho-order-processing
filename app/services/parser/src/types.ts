/**
 * Type definitions for the Excel parser
 */

export interface EvidenceCell {
  sheet: string;
  cell: string;
  raw_value: any;
  display_value?: string | null;
  number_format?: string | null;
}

export interface FormulaReport {
  hasFormulas: boolean;
  formulaCells: FormulaCell[];
  severity: 'blocker' | 'warning' | 'info';
}

export interface FormulaCell {
  sheet: string;
  cell: string;
  formula: string;
}

export interface SheetCandidate {
  name: string;
  score: number;
  reason: string;
  stats: {
    rowCount: number;
    columnCount: number;
    density: number;
    hasNumericColumns: boolean;
    hasTextColumns: boolean;
  };
}

export interface SheetSelection {
  selectedSheet: string;
  confidence: number;
  candidates: SheetCandidate[];
  /**
   * If true, multiple sheets are viable candidates and user should choose
   */
  requiresUserChoice: boolean;
  /**
   * Status of selection: 'selected', 'ambiguous', or 'none'
   */
  status: 'selected' | 'ambiguous' | 'none';
}

export interface HeaderCandidate {
  rowNumber: number;
  score: number;
  headers: string[];
  reason: string;
}

export interface HeaderDetection {
  headerRow: number | null;
  confidence: number;
  candidates: HeaderCandidate[];
}

export interface ColumnMapping {
  canonical_field: string;
  source_header: string;
  source_column: string; // e.g., "A", "B", "C"
  confidence: number;
  method: 'dictionary' | 'fuzzy' | 'embedding' | 'llm_tiebreak' | 'manual';
  candidates?: Array<{
    header: string;
    column: string;
    score: number;
  }>;
}

export interface SchemaInference {
  selected_sheet: string;
  table_region: string;
  header_row: number | null;
  column_mappings: ColumnMapping[];
  confidence: number;
}

export interface ExtractedRow {
  rowNumber: number; // 1-based spreadsheet row
  cells: Record<string, CellValue>;
  isTotal: boolean;
}

export interface CellValue {
  value: any;
  evidence: EvidenceCell;
}

export interface NormalizedValue {
  normalized: any;
  original: any;
  type: 'string' | 'number' | 'boolean' | 'null';
}

export interface Issue {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'blocker';
  message: string;
  fields?: string[];
  evidence?: EvidenceCell[];
  suggested_user_action?: string | null;
}

export interface LineItem {
  row: number;
  source_row_number: number | null;
  sku: string | null;
  gtin: string | null;
  product_name: string | null;
  quantity: number;
  unit_price_source: number | null;
  line_total_source: number | null;
  currency: string | null;
  evidence: {
    sku?: EvidenceCell;
    gtin?: EvidenceCell;
    product_name?: EvidenceCell;
    quantity?: EvidenceCell;
    unit_price_source?: EvidenceCell;
    line_total_source?: EvidenceCell;
  };
  flags?: string[];
}

export interface Customer {
  input_name: string | null;
  resolution_status: 'unresolved' | 'resolved' | 'ambiguous' | 'not_found';
  evidence?: EvidenceCell[];
}

export interface Totals {
  subtotal_source: number | null;
  tax_total_source: number | null;
  total_source: number | null;
  currency: string | null;
  evidence?: Record<string, EvidenceCell>;
}

export interface CanonicalSalesOrder {
  meta: {
    case_id: string;
    tenant_id?: string;
    received_at: string;
    source_filename: string;
    file_sha256: string;
    language_hint?: string | null;
    parsing?: {
      parser_version: string;
      contains_formulas: boolean;
      sheets_processed: string[];
    };
  };
  customer: Customer;
  line_items: LineItem[];
  totals?: Totals;
  schema_inference?: SchemaInference;
  confidence: {
    overall: number;
    by_stage?: Record<string, number>;
  };
  issues: Issue[];
}

export interface ParserConfig {
  /**
   * Formula handling policy - strict blocks formulas by default
   */
  formulaPolicy: 'strict' | 'warn' | 'allow';

  /**
   * Minimum confidence threshold for auto-selection of sheet
   * If multiple sheets exceed this threshold, return for user choice
   */
  sheetSelectionThreshold: number;

  /**
   * Minimum confidence difference between top two candidates
   * to auto-select without user input
   */
  sheetSelectionMinGap: number;

  /**
   * Maximum number of rows to scan for header detection
   */
  maxHeaderSearchRows: number;

  /**
   * Minimum confidence threshold for schema mapping
   */
  mappingConfidenceThreshold: number;

  /**
   * Arithmetic tolerance for validation
   */
  arithmeticAbsoluteTolerance: number;
  arithmeticRelativeTolerance: number;
}

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  formulaPolicy: 'strict',
  sheetSelectionThreshold: 0.5,
  sheetSelectionMinGap: 0.15,
  maxHeaderSearchRows: 10,
  mappingConfidenceThreshold: 0.80,
  arithmeticAbsoluteTolerance: 0.02,
  arithmeticRelativeTolerance: 0.01
};

export interface ParserOptions {
  caseId: string;
  filename: string;
  fileSha256: string;
  tenantId?: string;
  userId?: string;
  parserVersion?: string;
  config?: Partial<ParserConfig>;
}

export interface TypeDetectionResult {
  type: 'text' | 'number' | 'integer' | 'decimal' | 'currency' | 'date' | 'boolean' | 'mixed' | 'empty';
  confidence: number;
  samples: any[];
  stats?: {
    numeric?: number;
    text?: number;
    empty?: number;
    total?: number;
  };
}
