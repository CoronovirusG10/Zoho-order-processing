/**
 * Zoho Books Customers API
 *
 * Provides methods to list and search customers in Zoho Books.
 * Never creates customers - all customers must exist in Zoho.
 */

import axios, { AxiosError } from 'axios';
import {
  ZohoCustomer,
  ZohoPaginatedResponse,
  ZohoApiResponse,
  ZohoAuditLog,
} from '../types.js';
import { ZohoOAuthManager } from '../auth/oauth-manager.js';

export interface ListCustomersOptions {
  status?: 'active' | 'inactive' | 'all';
  searchText?: string;
  page?: number;
  perPage?: number;
}

export class ZohoCustomersApi {
  constructor(private readonly oauth: ZohoOAuthManager) {}

  /**
   * List all customers with optional filtering
   */
  async listCustomers(options: ListCustomersOptions = {}): Promise<ZohoCustomer[]> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

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

    try {
      const response = await axios.get<ZohoPaginatedResponse<ZohoCustomer>>(
        `${baseUrl}/books/v3/contacts`,
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

      // Log successful request
      this.logAudit({
        correlation_id: '',
        case_id: '',
        timestamp: new Date().toISOString(),
        operation: 'customer_lookup',
        request: {
          method: 'GET',
          url: `${baseUrl}/books/v3/contacts`,
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
      this.handleApiError(error, 'customer_lookup', duration);
      throw error;
    }
  }

  /**
   * Get a specific customer by ID
   */
  async getCustomer(customerId: string): Promise<ZohoCustomer | null> {
    const baseUrl = await this.oauth.getApiBaseUrl();
    const orgId = await this.oauth.getOrganizationId();
    const token = await this.oauth.getAccessToken();

    const startTime = Date.now();

    try {
      const response = await axios.get<ZohoApiResponse<{ contact: ZohoCustomer }>>(
        `${baseUrl}/books/v3/contacts/${customerId}`,
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

      this.logAudit({
        correlation_id: '',
        case_id: '',
        timestamp: new Date().toISOString(),
        operation: 'customer_lookup',
        request: {
          method: 'GET',
          url: `${baseUrl}/books/v3/contacts/${customerId}`,
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
        return null;
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
