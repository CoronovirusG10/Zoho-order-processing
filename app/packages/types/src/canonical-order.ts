/**
 * Canonical Sales Order types
 */

import {
  ResolutionStatus,
  CustomerMatchMethod,
  ItemMatchMethod,
  ColumnMappingMethod,
  IssueSeverity,
  ApprovalMethod,
} from './enums.js';
import { EvidenceCell, LineItemEvidence, TotalsEvidence } from './evidence.js';
import { CommitteeResult } from './committee.js';
import { Uploader, Correlation } from './teams.js';
import { ZohoCustomerCandidate, ZohoItemCandidate, ZohoSalesOrder } from './zoho.js';

/**
 * Metadata about the order processing case
 */
export interface OrderMeta {
  /** Unique case identifier */
  case_id: string;
  /** Teams tenant ID (from channelData.tenant.id) */
  tenant_id: string;
  /** ISO 8601 timestamp when the file was received */
  received_at: string;
  /** Original filename */
  source_filename: string;
  /** SHA-256 hash of the file */
  file_sha256: string;
  /** Information about the user who uploaded the file */
  uploader?: Uploader;
  /** Language hint detected from headers/values (e.g., "en", "fa") */
  language_hint?: string | null;
  /** Parsing metadata */
  parsing?: ParsingInfo;
  /** Correlation IDs for distributed tracing */
  correlation?: Correlation;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Information about how the file was parsed
 */
export interface ParsingInfo {
  /** Version of the parser used */
  parser_version?: string;
  /** Whether the spreadsheet contains formulas */
  contains_formulas?: boolean;
  /** Names of sheets that were processed */
  sheets_processed?: string[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Customer matching result
 */
export interface CustomerMatch {
  /** Method used for matching */
  method?: CustomerMatchMethod | null;
  /** Confidence score (0-1) */
  confidence?: number;
  /** List of candidate matches */
  candidates?: ZohoCustomerCandidate[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Customer information
 */
export interface Customer {
  /** Raw customer name from spreadsheet */
  input_name: string | null;
  /** Customer name if selected by user */
  selected_by_user?: string | null;
  /** Zoho customer ID if resolved */
  zoho_customer_id?: string | null;
  /** Zoho customer name if resolved */
  zoho_customer_name?: string | null;
  /** Resolution status */
  resolution_status: ResolutionStatus;
  /** Match information */
  match?: CustomerMatch;
  /** Evidence cells pointing to customer data in spreadsheet */
  evidence?: EvidenceCell[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Item matching result
 */
export interface ItemMatch {
  /** Resolution status */
  status?: ResolutionStatus;
  /** Method used for matching */
  method?: ItemMatchMethod | null;
  /** Confidence score (0-1) */
  confidence?: number;
  /** List of candidate matches */
  candidates?: ZohoItemCandidate[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Line item in the order
 */
export interface LineItem {
  /** 0-based index into detected line item rows */
  row: number;
  /** Spreadsheet row number (1-based) if known */
  source_row_number?: number | null;
  /** Stock Keeping Unit */
  sku?: string | null;
  /** Global Trade Item Number (8, 12, 13, or 14 digits) */
  gtin?: string | null;
  /** Product name */
  product_name?: string | null;
  /** Quantity (can be 0 or positive) */
  quantity: number;
  /** Unit price from source spreadsheet */
  unit_price_source?: number | null;
  /** Unit price from Zoho (takes precedence) */
  unit_price_zoho?: number | null;
  /** Line total from source spreadsheet */
  line_total_source?: number | null;
  /** ISO 4217 currency code if detected */
  currency?: string | null;
  /** Zoho item ID if resolved */
  zoho_item_id?: string | null;
  /** Item matching information */
  match?: ItemMatch;
  /** Evidence cells for each field */
  evidence?: LineItemEvidence;
  /** Flags for this line item */
  flags?: string[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Order totals
 */
export interface Totals {
  /** Subtotal from source spreadsheet */
  subtotal_source?: number | null;
  /** Tax total from source spreadsheet */
  tax_total_source?: number | null;
  /** Grand total from source spreadsheet */
  total_source?: number | null;
  /** Currency code */
  currency?: string | null;
  /** Evidence cells for total fields */
  evidence?: TotalsEvidence;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Column mapping from source to canonical field
 */
export interface ColumnMapping {
  /** Canonical field name */
  canonical_field: string;
  /** Source header text */
  source_header: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Method used for mapping */
  method?: ColumnMappingMethod;
  /** Candidate mappings considered */
  candidates?: Record<string, unknown>[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Schema inference information
 */
export interface SchemaInference {
  /** Sheet selected for processing */
  selected_sheet?: string;
  /** Table region (e.g., "A1:H42") */
  table_region?: string;
  /** 1-based row number of header if detected */
  header_row?: number | null;
  /** Column mappings from source to canonical fields */
  column_mappings?: ColumnMapping[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Confidence scores
 */
export interface Confidence {
  /** Overall confidence score (0-1) */
  overall: number;
  /** Confidence by processing stage */
  by_stage?: Record<string, number>;
  /** AI committee consensus information */
  committee?: CommitteeResult;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Issue raised during processing
 */
export interface Issue {
  /** Issue code */
  code: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Human-readable message */
  message: string;
  /** Fields affected by this issue */
  fields?: string[];
  /** Evidence cells related to this issue */
  evidence?: EvidenceCell[];
  /** Suggested action for the user */
  suggested_user_action?: string | null;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Approval information
 */
export interface Approvals {
  /** Whether the order has been approved */
  approved?: boolean;
  /** ISO 8601 timestamp of approval */
  approved_at?: string | null;
  /** AAD user ID who approved */
  approved_by?: string | null;
  /** Method used for approval */
  approval_method?: ApprovalMethod | null;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Canonical Sales Order - the main data structure representing a parsed and enriched sales order
 */
export interface CanonicalSalesOrder {
  /** Metadata about the order */
  meta: OrderMeta;
  /** Customer information */
  customer: Customer;
  /** Line items in the order */
  line_items: LineItem[];
  /** Order totals */
  totals?: Totals;
  /** Schema inference information */
  schema_inference?: SchemaInference;
  /** Confidence scores */
  confidence: Confidence;
  /** Issues found during processing */
  issues: Issue[];
  /** Approval information */
  approvals?: Approvals;
  /** Zoho Books integration data */
  zoho?: ZohoSalesOrder;
  /** Allow additional properties */
  [key: string]: unknown;
}
