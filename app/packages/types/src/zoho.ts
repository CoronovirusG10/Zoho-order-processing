/**
 * Zoho Books integration types
 */

/**
 * Zoho Books customer candidate from matching
 */
export interface ZohoCustomerCandidate {
  /** Zoho customer ID */
  zoho_customer_id: string;
  /** Customer name in Zoho */
  zoho_customer_name: string;
  /** Match score (0-1) */
  score: number;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Zoho Books item candidate from matching
 */
export interface ZohoItemCandidate {
  /** Zoho item ID */
  zoho_item_id: string;
  /** SKU if available */
  sku?: string | null;
  /** Item name */
  name: string;
  /** GTIN if available */
  gtin?: string | null;
  /** Match score (0-1) */
  score: number;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Zoho Books sales order information
 */
export interface ZohoSalesOrder {
  /** Zoho organisation ID */
  organisation_id?: string | null;
  /** Zoho sales order ID */
  salesorder_id?: string | null;
  /** Zoho sales order number */
  salesorder_number?: string | null;
  /** Status of the sales order in Zoho */
  status?: string | null;
  /** Request payload sent to Zoho API */
  request_payload?: Record<string, unknown> | null;
  /** Response payload received from Zoho API */
  response_payload?: Record<string, unknown> | null;
  /** Allow additional properties */
  [key: string]: unknown;
}
