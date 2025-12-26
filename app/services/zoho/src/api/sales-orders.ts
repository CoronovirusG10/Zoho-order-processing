/**
 * Zoho Books Sales Orders API
 *
 * Provides methods to create draft sales orders in Zoho Books.
 * Handles rate limiting (429), retries, and comprehensive audit logging.
 */

import axios, { AxiosError } from 'axios';
import {
  ZohoSalesOrder,
  ZohoSalesOrderPayload,
  ZohoApiResponse,
  ZohoSalesOrderCreateResponse,
  ZohoAuditLog,
  RateLimitInfo,
} from '../types.js';
import { ZohoOAuthManager } from '../auth/oauth-manager.js';

export interface CreateSalesOrderOptions {
  correlationId?: string;
  caseId?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  /** External order key for idempotency - stored in Zoho custom field */
  externalOrderKey?: string;
  /** Custom field ID for external order key */
  externalOrderKeyFieldId?: string;
}

export class ZohoSalesOrdersApi {
  private readonly defaultMaxRetries = 3;
  private readonly defaultRetryDelayMs = 1000;
  private readonly rateLimitRetryAfterMs = 60000; // 60 seconds default

  constructor(private readonly oauth: ZohoOAuthManager) {}

  /**
   * Create a draft sales order in Zoho Books
   * Status is automatically set to 'draft'
   */
  async createDraftSalesOrder(
    payload: ZohoSalesOrderPayload,
    options: CreateSalesOrderOptions = {}
  ): Promise<ZohoSalesOrder> {
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const baseRetryDelay = options.retryDelayMs ?? this.defaultRetryDelayMs;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performCreate(payload, options);
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if this is a rate limit error (429)
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = this.extractRetryAfter(error);
          const delay = retryAfter || this.rateLimitRetryAfterMs;

          console.warn(
            `[Zoho] Rate limited (429), retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );

          if (attempt < maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        // Check if this is a transient error worth retrying
        if (this.isTransientError(error) && attempt < maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(
            `[Zoho] Transient error, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error or max retries exceeded
        throw error;
      }
    }

    throw lastError || new Error('Failed to create sales order after retries');
  }

  /**
   * Perform the actual API call to create the sales order
   */
  private async performCreate(
    payload: ZohoSalesOrderPayload,
    options: CreateSalesOrderOptions
  ): Promise<ZohoSalesOrder> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const startTime = Date.now();
    const correlationId = options.correlationId || '';
    const caseId = options.caseId || '';

    try {
      const response = await axios.post<ZohoSalesOrderCreateResponse>(
        `${baseUrl}/books/v3/salesorders`,
        payload,
        {
          params: { organization_id: orgId },
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
            ...(correlationId && { 'X-Correlation-Id': correlationId }),
          },
          timeout: 30000,
        }
      );

      const duration = Date.now() - startTime;

      // Log successful request
      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'salesorder_create',
        request: {
          method: 'POST',
          url: `${baseUrl}/books/v3/salesorders`,
          body: this.sanitizePayloadForLog(payload),
        },
        response: {
          status: response.status,
          body: {
            salesorder_id: response.data.salesorder?.salesorder_id,
            salesorder_number: response.data.salesorder?.salesorder_number,
            status: response.data.salesorder?.status,
          },
        },
        duration_ms: duration,
      });

      if (!response.data.salesorder) {
        throw new Error('No salesorder in response');
      }

      return response.data.salesorder;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleApiError(error, correlationId, caseId, duration, payload);
      throw error;
    }
  }

  /**
   * Get an existing sales order by ID
   */
  async getSalesOrder(salesOrderId: string): Promise<ZohoSalesOrder | null> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    try {
      const response = await axios.get<ZohoApiResponse<{ salesorder: ZohoSalesOrder }>>(
        `${baseUrl}/books/v3/salesorders/${salesOrderId}`,
        {
          params: { organization_id: orgId },
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.data?.salesorder || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check for existing sales order by external order key (for idempotency)
   * Uses reference_number field which Zoho allows searching
   */
  async findByExternalOrderKey(externalOrderKey: string): Promise<ZohoSalesOrder | null> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    try {
      const response = await axios.get<{ salesorders: ZohoSalesOrder[] }>(
        `${baseUrl}/books/v3/salesorders`,
        {
          params: {
            organization_id: orgId,
            reference_number: externalOrderKey,
          },
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const salesorders = response.data.salesorders || [];
      return salesorders.length > 0 ? salesorders[0] : null;
    } catch (error) {
      console.error('[ZohoSalesOrdersApi] Failed to search by external order key:', error);
      return null;
    }
  }

  /**
   * Create a draft sales order with idempotency check
   * First checks if order with external_order_key already exists
   */
  async createDraftSalesOrderIdempotent(
    payload: ZohoSalesOrderPayload,
    externalOrderKey: string,
    options: Omit<CreateSalesOrderOptions, 'externalOrderKey'> = {}
  ): Promise<{
    salesorder: ZohoSalesOrder;
    is_duplicate: boolean;
  }> {
    // Check for existing order first
    const existing = await this.findByExternalOrderKey(externalOrderKey);
    if (existing) {
      console.log(`[ZohoSalesOrdersApi] Found existing order with key ${externalOrderKey}: ${existing.salesorder_number}`);
      return {
        salesorder: existing,
        is_duplicate: true,
      };
    }

    // Ensure payload has reference_number set to external order key
    const payloadWithKey: ZohoSalesOrderPayload = {
      ...payload,
      reference_number: externalOrderKey,
    };

    // Create new order
    const salesorder = await this.createDraftSalesOrder(payloadWithKey, {
      ...options,
      externalOrderKey,
    });

    return {
      salesorder,
      is_duplicate: false,
    };
  }

  /**
   * Check if an error is transient and worth retrying
   */
  private isTransientError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;

    // Retry on network errors, timeouts, and 5xx server errors
    if (!status) {
      return true; // Network error
    }

    if (status >= 500 && status < 600) {
      return true; // Server error
    }

    if (status === 408 || status === 429) {
      return true; // Timeout or rate limit
    }

    return false;
  }

  /**
   * Extract Retry-After header value in milliseconds
   */
  private extractRetryAfter(error: AxiosError): number | null {
    const retryAfter = error.response?.headers['retry-after'];

    if (!retryAfter) {
      return null;
    }

    // Can be either seconds or HTTP date
    const seconds = parseInt(retryAfter, 10);

    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try to parse as HTTP date
    try {
      const date = new Date(retryAfter);
      const diff = date.getTime() - Date.now();
      return Math.max(0, diff);
    } catch {
      return null;
    }
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize payload for logging (remove sensitive data if any)
   */
  private sanitizePayloadForLog(payload: ZohoSalesOrderPayload): Partial<ZohoSalesOrderPayload> {
    return {
      customer_id: payload.customer_id,
      date: payload.date,
      line_items: payload.line_items.map((item) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        rate: item.rate,
      })),
      custom_fields: payload.custom_fields,
    };
  }

  /**
   * Handle API errors with proper logging
   */
  private handleApiError(
    error: unknown,
    correlationId: string,
    caseId: string,
    duration: number,
    payload?: ZohoSalesOrderPayload
  ): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'salesorder_create',
        request: {
          method: axiosError.config?.method?.toUpperCase() || 'POST',
          url: axiosError.config?.url || '',
          body: payload ? this.sanitizePayloadForLog(payload) : undefined,
        },
        response: {
          status: axiosError.response?.status || 0,
          body: axiosError.response?.data,
        },
        duration_ms: duration,
        error: {
          code: String(axiosError.response?.status || 'NETWORK_ERROR'),
          message: axiosError.message,
          stack: axiosError.stack,
        },
      });
    } else {
      this.logAudit({
        correlation_id: correlationId,
        case_id: caseId,
        timestamp: new Date().toISOString(),
        operation: 'salesorder_create',
        duration_ms: duration,
        error: {
          code: 'UNKNOWN_ERROR',
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      });
    }
  }

  /**
   * Log audit entry (writes to Blob Storage in production)
   */
  private logAudit(log: ZohoAuditLog): void {
    // TODO: In production, write to Azure Blob Storage for 5-year retention
    console.log('[ZOHO_AUDIT]', JSON.stringify(log));
  }
}
