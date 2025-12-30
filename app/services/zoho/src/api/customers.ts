/**
 * Zoho Books Customers API
 *
 * Provides methods to list and search customers in Zoho Books.
 * Never creates customers - all customers must exist in Zoho.
 *
 * Audit Logging:
 * - All API requests/responses are logged to Azure Blob Storage
 * - 5-year retention for compliance
 * - Graceful degradation if audit logging fails
 */

import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  ZohoCustomer,
  ZohoPaginatedResponse,
  ZohoApiResponse,
  ZohoAuditLog,
} from '../types.js';
import { ZohoOAuthManager } from '../auth/oauth-manager.js';
import { BlobAuditStore } from '../storage/blob-audit-store.js';

export interface ListCustomersOptions {
  status?: 'active' | 'inactive' | 'all';
  searchText?: string;
  page?: number;
  perPage?: number;
  /** Correlation ID for audit logging */
  correlationId?: string;
  /** Case ID for audit logging */
  caseId?: string;
  /** Tenant ID for audit logging */
  tenantId?: string;
}

export class ZohoCustomersApi {
  private readonly auditStore?: BlobAuditStore;

  constructor(
    private readonly oauth: ZohoOAuthManager,
    auditStore?: BlobAuditStore
  ) {
    this.auditStore = auditStore;
  }

  /**
   * List all customers with optional filtering
   */
  async listCustomers(options: ListCustomersOptions = {}): Promise<ZohoCustomer[]> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const correlationId = options.correlationId || uuidv4();
    const caseId = options.caseId || '';
    const tenantId = options.tenantId || '';
    const url = `${baseUrl}/books/v3/contacts`;

    const params: Record<string, string> = {
      organization_id: orgId,
    };

    if (options.status && options.status !== 'all') {
      params.filter_by = `Status.${options.status === 'active' ? 'Active' : 'Inactive'}`;
    }

    if (options.searchText) {
      params.search_text = options.searchText;
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
        operation: 'customers/list',
        correlationId,
        caseId,
        tenantId,
        method: 'GET',
        url,
        requestBody: { params: { ...params, organization_id: '[REDACTED]' } },
      }).catch(err => console.warn('[ZohoCustomersApi] Audit log request failed:', err));
    }

    try {
      const response = await axios.get<ZohoPaginatedResponse<ZohoCustomer>>(
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

      // Filter to only customers (not vendors)
      const customers = (response.data.data || []).filter(
        (contact) => contact.contact_type === 'customer'
      );

      // Log successful response to blob storage
      if (this.auditStore) {
        await this.auditStore.logApiResponse({
          operation: 'customers/list',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: response.status,
          responseBody: { count: customers.length },
          durationMs: duration,
        }).catch(err => console.warn('[ZohoCustomersApi] Audit log response failed:', err));
      }

      // Also log to console for backward compatibility
      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'customer_lookup',
        request: {
          method: 'GET',
          url,
        },
        response: {
          status: response.status,
          body: { count: customers.length },
        },
        duration_ms: duration,
      });

      return customers;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error response to blob storage
      if (this.auditStore) {
        const axiosError = axios.isAxiosError(error) ? error as AxiosError : null;
        await this.auditStore.logApiResponse({
          operation: 'customers/list',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: axiosError?.response?.status || 0,
          responseBody: axiosError?.response?.data as object | undefined,
          errorMessage: (error as Error).message,
          durationMs: duration,
        }).catch(err => console.warn('[ZohoCustomersApi] Audit log error failed:', err));
      }

      this.handleApiError(error, 'customer_lookup', duration);
      throw error;
    }
  }

  /**
   * Get a specific customer by ID
   */
  async getCustomer(
    customerId: string,
    options: { correlationId?: string; caseId?: string; tenantId?: string } = {}
  ): Promise<ZohoCustomer | null> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const correlationId = options.correlationId || uuidv4();
    const caseId = options.caseId || '';
    const tenantId = options.tenantId || '';
    const url = `${baseUrl}/books/v3/contacts/${customerId}`;

    const startTime = Date.now();

    // Log request to blob storage before sending
    if (this.auditStore) {
      await this.auditStore.logApiRequest({
        operation: 'customers/get',
        correlationId,
        caseId,
        tenantId,
        method: 'GET',
        url,
        requestBody: { customerId },
      }).catch(err => console.warn('[ZohoCustomersApi] Audit log request failed:', err));
    }

    try {
      const response = await axios.get<ZohoApiResponse<{ contact: ZohoCustomer }>>(
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
          operation: 'customers/get',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: response.status,
          responseBody: { found: !!response.data.data?.contact },
          durationMs: duration,
        }).catch(err => console.warn('[ZohoCustomersApi] Audit log response failed:', err));
      }

      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'customer_lookup',
        request: {
          method: 'GET',
          url,
        },
        response: {
          status: response.status,
        },
        duration_ms: duration,
      });

      return response.data.data?.contact || null;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Log 404 as a valid response (not found)
        if (this.auditStore) {
          await this.auditStore.logApiResponse({
            operation: 'customers/get',
            correlationId,
            caseId,
            tenantId,
            method: 'GET',
            url,
            statusCode: 404,
            responseBody: { found: false },
            durationMs: duration,
          }).catch(err => console.warn('[ZohoCustomersApi] Audit log response failed:', err));
        }
        return null;
      }

      // Log error response to blob storage
      if (this.auditStore) {
        const axiosError = axios.isAxiosError(error) ? error as AxiosError : null;
        await this.auditStore.logApiResponse({
          operation: 'customers/get',
          correlationId,
          caseId,
          tenantId,
          method: 'GET',
          url,
          statusCode: axiosError?.response?.status || 0,
          responseBody: axiosError?.response?.data as object | undefined,
          errorMessage: (error as Error).message,
          durationMs: duration,
        }).catch(err => console.warn('[ZohoCustomersApi] Audit log error failed:', err));
      }

      this.handleApiError(error, 'customer_lookup', duration);
      throw error;
    }
  }

  /**
   * Search customers by name (for fuzzy matching)
   */
  async searchCustomers(searchText: string): Promise<ZohoCustomer[]> {
    return this.listCustomers({
      searchText,
      status: 'active',
      perPage: 50,
    });
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
   * Log audit entry (in production, this would write to Blob Storage)
   */
  private logAudit(log: ZohoAuditLog): void {
    // TODO: In production, write to Azure Blob Storage for 5-year retention
    console.log('[ZOHO_AUDIT]', JSON.stringify(log));
  }
}
