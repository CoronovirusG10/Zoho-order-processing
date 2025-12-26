/**
 * Zoho Books Integration - Type Definitions
 *
 * This module defines all TypeScript types for the Zoho Books API integration,
 * including OAuth, API responses, cached data, and matching results.
 */

// ==================== OAuth & Authentication ====================

export interface ZohoOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  region: 'eu' | 'com' | 'in' | 'au' | 'jp';
}

export interface ZohoAccessToken {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface ZohoTokenRefreshResponse {
  access_token: string;
  expires_in: number; // Seconds
  api_domain: string;
  token_type: string;
}

// ==================== Zoho API Base Types ====================

export interface ZohoApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

export interface ZohoErrorResponse {
  code: number;
  message: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}

export interface ZohoPaginatedResponse<T> {
  code: number;
  message: string;
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    report_name?: string;
    sort_column?: string;
    sort_order?: string;
  };
  data?: T[];
}

// ==================== Zoho Customer Types ====================

export interface ZohoCustomer {
  contact_id: string;
  contact_name: string;
  company_name: string;
  contact_type: 'customer' | 'vendor';
  customer_sub_type?: string;
  status: 'active' | 'inactive' | 'crm';
  payment_terms?: number;
  currency_id?: string;
  currency_code?: string;
  outstanding_receivable_amount?: number;
  unused_credits_receivable_amount?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoCustomerListResponse {
  contacts: ZohoCustomer[];
}

// ==================== Zoho Item Types ====================

export interface ZohoItem {
  item_id: string;
  name: string;
  sku?: string;
  product_type?: string;
  rate: number;
  description?: string;
  unit?: string;
  status: 'active' | 'inactive';
  source?: string;
  is_taxable?: boolean;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  purchase_rate?: number;
  item_type?: 'sales' | 'purchases' | 'sales_and_purchases' | 'inventory';
  product_type_formatted?: string;
  is_combo_product?: boolean;
  stock_on_hand?: number;
  available_stock?: number;
  actual_available_stock?: number;
  custom_fields?: ZohoCustomField[];
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoCustomField {
  customfield_id: string;
  label: string;
  value: string | number | boolean;
  data_type?: string;
  is_active?: boolean;
}

export interface ZohoItemListResponse {
  items: ZohoItem[];
}

// ==================== Zoho Sales Order Types ====================

export interface ZohoSalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  shipment_date?: string;
  status: 'draft' | 'open' | 'invoiced' | 'void';
  customer_id: string;
  customer_name: string;
  email?: string;
  currency_id?: string;
  currency_code?: string;
  exchange_rate?: number;
  discount?: number;
  is_discount_before_tax?: boolean;
  discount_type?: 'entity_level' | 'item_level';
  discount_amount?: number;
  line_items: ZohoLineItem[];
  sub_total: number;
  tax_total?: number;
  total: number;
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string;
  reference_number?: string;
  notes?: string;
  terms?: string;
  custom_fields?: ZohoCustomField[];
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoLineItem {
  line_item_id?: string;
  item_id: string;
  item_order?: number;
  name?: string;
  description?: string;
  rate: number;
  quantity: number;
  unit?: string;
  discount?: number | string;
  discount_amount?: number;
  tax_id?: string;
  tax_name?: string;
  tax_type?: string;
  tax_percentage?: number;
  item_total: number;
  item_custom_fields?: ZohoCustomField[];
}

export interface ZohoSalesOrderPayload {
  customer_id: string;
  date: string; // YYYY-MM-DD format
  shipment_date?: string; // YYYY-MM-DD format
  reference_number?: string;
  line_items: Array<{
    item_id: string;
    quantity: number;
    rate: number;
    description?: string;
    discount?: number | string;
    tax_id?: string;
  }>;
  notes?: string;
  terms?: string;
  discount?: number;
  is_discount_before_tax?: boolean;
  discount_type?: 'entity_level' | 'item_level';
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string;
  custom_fields?: Array<{
    customfield_id: string;
    value: string | number | boolean;
  }>;
}

export interface ZohoSalesOrderCreateResponse {
  salesorder: ZohoSalesOrder;
}

// ==================== Cache Types ====================

export interface CachedCustomer {
  zoho_customer_id: string;
  display_name: string;
  company_name: string;
  contact_type: string;
  status: string;
  email?: string;
  phone?: string;
  last_cached_at: string;
}

export interface CachedItem {
  zoho_item_id: string;
  name: string;
  sku: string | null;
  gtin: string | null; // From custom field
  rate: number;
  unit?: string;
  status: string;
  description?: string;
  last_cached_at: string;
}

export interface CacheRefreshResult {
  success: boolean;
  customers_updated: number;
  items_updated: number;
  errors: string[];
  last_refresh_at: string;
}

// ==================== Matching Types ====================

export interface CustomerMatchResult {
  status: 'resolved' | 'ambiguous' | 'not_found' | 'needs_user_input';
  customer?: {
    zoho_customer_id: string;
    display_name: string;
  };
  method?: 'exact' | 'fuzzy' | 'user_selected';
  confidence: number;
  candidates: Array<{
    zoho_customer_id: string;
    display_name: string;
    score: number;
    match_reason?: string;
  }>;
}

export interface ItemMatchResult {
  status: 'resolved' | 'ambiguous' | 'not_found' | 'needs_user_input';
  item?: {
    zoho_item_id: string;
    name: string;
    rate: number;
  };
  method?: 'sku' | 'gtin' | 'name_fuzzy' | 'user_selected';
  confidence: number;
  candidates: Array<{
    zoho_item_id: string;
    sku: string | null;
    gtin: string | null;
    name: string;
    rate: number;
    score: number;
    match_reason?: string;
  }>;
}

export interface FuzzyMatchOptions {
  threshold: number; // 0-1, minimum score to consider
  limit: number; // Max number of results
  keys: string[]; // Fields to search
  includeScore: boolean;
  shouldSort: boolean;
  findAllMatches: boolean;
  minMatchCharLength?: number;
  distance?: number;
}

// ==================== Queue & Retry Types ====================

export interface RetryQueueItem {
  id: string;
  case_id: string;
  payload: ZohoSalesOrderPayload;
  fingerprint: string;
  attempt_count: number;
  max_retries: number;
  next_retry_at: string; // ISO 8601
  created_at: string;
  last_attempted_at?: string;
  error_history: Array<{
    attempted_at: string;
    error_code?: string;
    error_message: string;
  }>;
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'abandoned';
}

export interface OutboxEntry {
  id: string;
  case_id: string;
  event_type: 'salesorder_created' | 'salesorder_failed' | 'retry_exhausted';
  payload: unknown;
  created_at: string;
  processed_at?: string;
  status: 'pending' | 'processed' | 'failed';
}

// ==================== Idempotency Types ====================

export interface OrderFingerprint {
  fingerprint: string;
  case_id: string;
  file_sha256: string;
  customer_id: string;
  line_items_hash: string;
  date_bucket: string; // YYYY-MM-DD
  created_at: string;
  zoho_salesorder_id?: string;
  zoho_salesorder_number?: string;
  status: 'in_flight' | 'created' | 'failed';
}

// ==================== Service Configuration ====================

export interface ZohoServiceConfig {
  keyVaultUrl: string;
  cosmosEndpoint: string;
  cosmosDatabase: string;
  blobStorageConnection: string;
  auditContainer: string;
  retryQueueContainer: string;
  cacheContainer: string;
  fingerprintContainer: string;
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  cacheRefreshIntervalMs: number;
  rateLimitRetryAfterMs: number;
  gtinCustomFieldId: string; // Zoho custom field ID for GTIN/EAN
}

// ==================== Rate Limiting ====================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// ==================== Audit Log ====================

export interface ZohoAuditLog {
  correlation_id: string;
  case_id: string;
  timestamp: string;
  operation: 'customer_lookup' | 'item_lookup' | 'salesorder_create' | 'token_refresh' | 'cache_refresh';
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
  duration_ms: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
