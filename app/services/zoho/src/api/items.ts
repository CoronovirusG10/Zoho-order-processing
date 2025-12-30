/**
 * Zoho Books Items API
 *
 * Provides methods to list and search items in Zoho Books.
 * Never creates items - all items must exist in Zoho.
 * Supports GTIN lookup via custom field.
 *
 * Audit Logging:
 * - All API requests/responses are logged to Azure Blob Storage
 * - 5-year retention for compliance
 * - Graceful degradation if audit logging fails
 */

import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  ZohoItem,
  ZohoPaginatedResponse,
  ZohoApiResponse,
  ZohoAuditLog,
} from '../types.js';
import { ZohoOAuthManager } from '../auth/oauth-manager.js';
import { BlobAuditStore } from '../storage/blob-audit-store.js';

export interface ListItemsOptions {
  status?: 'active' | 'inactive' | 'all';
  searchText?: string;
  sku?: string;
  page?: number;
  perPage?: number;
  /** Correlation ID for audit logging */
  correlationId?: string;
  /** Case ID for audit logging */
  caseId?: string;
  /** Tenant ID for audit logging */
  tenantId?: string;
}

export class ZohoItemsApi {
  private readonly auditStore?: BlobAuditStore;

  constructor(
    private readonly oauth: ZohoOAuthManager,
    private readonly gtinCustomFieldId?: string,
    auditStore?: BlobAuditStore
  ) {
    this.auditStore = auditStore;
  }

  /**
   * List all items with optional filtering
   */
  async listItems(options: ListItemsOptions = {}): Promise<ZohoItem[]> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const correlationId = options.correlationId || uuidv4();
    const caseId = options.caseId || '';
    const tenantId = options.tenantId || '';
    const url = `${baseUrl}/books/v3/items`;

    const params: Record<string, string> = {
      organization_id: orgId,
    };

    if (options.status && options.status !== 'all') {
      params.filter_by = `Status.${options.status === 'active' ? 'Active' : 'Inactive'}`;
    }

    if (options.searchText) {
      params.search_text = options.searchText;
    }

    if (options.sku) {
      params.sku = options.sku;
    }

    if (options.page) {
      params.page = String(options.page);
    }

    if (options.perPage) {
      params.per_page = String(options.perPage);
    }

    const startTime = Date.now();

    // Log request to blob storage before sending
    if (this.auditStore) {
      await this.auditStore.logApiRequest({
        operation: 'items/list',
        correlationId,
        caseId,
        tenantId,
        method: 'GET',
        url,
        requestBody: { params: { ...params, organization_id: '[REDACTED]' } },
      }).catch(err => console.warn('[ZohoItemsApi] Audit log request failed:', err));
    }

    try {
      const response = await axios.get<ZohoPaginatedResponse<ZohoItem>>(
        url,
        {
          params,
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const duration = Date.now() - startTime;
      const items = response.data.data || [];

      // Log successful response to blob storage
      if (this.auditStore) {
        await this.auditStore.logApiResponse({
          operation: 'items/list',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: response.status,
          responseBody: { count: items.length },
          durationMs: duration,
        }).catch(err => console.warn('[ZohoItemsApi] Audit log response failed:', err));
      }

      // Also log to console for backward compatibility
      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'item_lookup',
        request: {
          method: 'GET',
          url,
        },
        response: {
          status: response.status,
          body: { count: items.length },
        },
        duration_ms: duration,
      });

      return items;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error response to blob storage
      if (this.auditStore) {
        const axiosError = axios.isAxiosError(error) ? error as AxiosError : null;
        await this.auditStore.logApiResponse({
          operation: 'items/list',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: axiosError?.response?.status || 0,
          responseBody: axiosError?.response?.data as object | undefined,
          errorMessage: (error as Error).message,
          durationMs: duration,
        }).catch(err => console.warn('[ZohoItemsApi] Audit log error failed:', err));
      }

      this.handleApiError(error, 'item_lookup', duration);
      throw error;
    }
  }

  /**
   * Get a specific item by ID
   */
  async getItem(
    itemId: string,
    options: { correlationId?: string; caseId?: string; tenantId?: string } = {}
  ): Promise<ZohoItem | null> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const correlationId = options.correlationId || uuidv4();
    const caseId = options.caseId || '';
    const tenantId = options.tenantId || '';
    const url = `${baseUrl}/books/v3/items/${itemId}`;

    const startTime = Date.now();

    // Log request to blob storage before sending
    if (this.auditStore) {
      await this.auditStore.logApiRequest({
        operation: 'items/get',
        correlationId,
        caseId,
        tenantId,
        method: 'GET',
        url,
        requestBody: { itemId },
      }).catch(err => console.warn('[ZohoItemsApi] Audit log request failed:', err));
    }

    try {
      const response = await axios.get<ZohoApiResponse<{ item: ZohoItem }>>(
        url,
        {
          params: { organization_id: orgId },
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const duration = Date.now() - startTime;

      // Log successful response to blob storage
      if (this.auditStore) {
        await this.auditStore.logApiResponse({
          operation: 'items/get',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: response.status,
          responseBody: { found: !!response.data.data?.item },
          durationMs: duration,
        }).catch(err => console.warn('[ZohoItemsApi] Audit log response failed:', err));
      }

      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'item_lookup',
        request: {
          method: 'GET',
          url,
        },
        response: {
          status: response.status,
        },
        duration_ms: duration,
      });

      return response.data.data?.item || null;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Log 404 as a valid response (not found)
        if (this.auditStore) {
          await this.auditStore.logApiResponse({
            operation: 'items/get',
            correlationId,
            caseId,
            tenantId,
            method: 'GET',
            url,
            statusCode: 404,
            responseBody: { found: false },
            durationMs: duration,
          }).catch(err => console.warn('[ZohoItemsApi] Audit log response failed:', err));
        }
        return null;
      }

      // Log error response to blob storage
      if (this.auditStore) {
        const axiosError = axios.isAxiosError(error) ? error as AxiosError : null;
        await this.auditStore.logApiResponse({
          operation: 'items/get',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: axiosError?.response?.status || 0,
          responseBody: axiosError?.response?.data as object | undefined,
          errorMessage: (error as Error).message,
          durationMs: duration,
        }).catch(err => console.warn('[ZohoItemsApi] Audit log error failed:', err));
      }

      this.handleApiError(error, 'item_lookup', duration);
      throw error;
    }
  }

  /**
   * Search items by SKU (exact match preferred)
   */
  async searchBySku(sku: string): Promise<ZohoItem[]> {
    return this.listItems({
      sku,
      status: 'active',
      perPage: 10,
    });
  }

  /**
   * Search items by name (for fuzzy matching)
   */
  async searchByName(name: string): Promise<ZohoItem[]> {
    return this.listItems({
      searchText: name,
      status: 'active',
      perPage: 20,
    });
  }

  /**
   * Extract GTIN from item's custom fields
   */
  getGtinFromItem(item: ZohoItem): string | null {
    if (!this.gtinCustomFieldId || !item.custom_fields) {
      return null;
    }

    const gtinField = item.custom_fields.find(
      (field) => field.customfield_id === this.gtinCustomFieldId
    );

    return gtinField?.value ? String(gtinField.value) : null;
  }

  /**
   * Search items by GTIN (requires loading all items and filtering)
   * Note: This is less efficient than SKU search due to Zoho API limitations
   */
  async searchByGtin(gtin: string): Promise<ZohoItem[]> {
    if (!this.gtinCustomFieldId) {
      console.warn('GTIN custom field ID not configured, cannot search by GTIN');
      return [];
    }

    // Unfortunately, Zoho doesn't support filtering by custom fields in the API
    // We need to fetch items and filter in-memory
    // For production, this should be cached
    const allItems = await this.listItems({
      status: 'active',
      perPage: 200,
    });

    const normalizedGtin = this.normalizeGtin(gtin);

    return allItems.filter((item) => {
      const itemGtin = this.getGtinFromItem(item);
      if (!itemGtin) return false;

      const normalizedItemGtin = this.normalizeGtin(itemGtin);
      return normalizedItemGtin === normalizedGtin;
    });
  }

  /**
   * Normalize GTIN for comparison (remove spaces, leading zeros if needed)
   */
  private normalizeGtin(gtin: string): string {
    return gtin.replace(/\s+/g, '').trim();
  }

  /**
   * Handle API errors with proper logging
   */
  private handleApiError(error: unknown, operation: string, duration: number): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logAudit({
        correlation_id: '',
        case_id: '',
        timestamp: new Date().toISOString(),
        operation: operation as any,
        request: {
          method: axiosError.config?.method?.toUpperCase() || 'UNKNOWN',
          url: axiosError.config?.url || '',
        },
        response: {
          status: axiosError.response?.status || 0,
          body: axiosError.response?.data,
        },
        duration_ms: duration,
        error: {
          code: String(axiosError.response?.status || 'UNKNOWN'),
          message: axiosError.message,
        },
      });
    }
  }

  /**
   * Log audit entry
   */
  private logAudit(log: ZohoAuditLog): void {
    // TODO: In production, write to Azure Blob Storage
    console.log('[ZOHO_AUDIT]', JSON.stringify(log));
  }
}
