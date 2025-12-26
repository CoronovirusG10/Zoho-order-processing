/**
 * API client for backend communication
 */

import { authService } from './auth-service';
import type {
  Case,
  CaseListItem,
  CaseFilters,
  AuditEvent,
  ApiError,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  /**
   * Generic fetch wrapper with auth
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await authService.getApiToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response
        .json()
        .catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: response.statusText,
        }));
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  /**
   * List cases with optional filters
   */
  async listCases(filters?: CaseFilters): Promise<CaseListItem[]> {
    const params = new URLSearchParams();

    if (filters?.status?.length) {
      params.append('status', filters.status.join(','));
    }
    if (filters?.salespersonId) {
      params.append('salespersonId', filters.salespersonId);
    }
    if (filters?.customerName) {
      params.append('customerName', filters.customerName);
    }
    if (filters?.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.append('dateTo', filters.dateTo);
    }

    const query = params.toString();
    const endpoint = `/cases${query ? `?${query}` : ''}`;

    return this.fetch<CaseListItem[]>(endpoint);
  }

  /**
   * Get case detail
   */
  async getCase(caseId: string): Promise<Case> {
    return this.fetch<Case>(`/cases/${caseId}`);
  }

  /**
   * Get audit events for a case
   */
  async getAuditEvents(caseId: string): Promise<AuditEvent[]> {
    return this.fetch<AuditEvent[]>(`/cases/${caseId}/audit`);
  }

  /**
   * Get SAS URL for downloading audit bundle
   */
  async getDownloadSasUrl(caseId: string): Promise<{ sasUrl: string }> {
    return this.fetch<{ sasUrl: string }>(`/cases/${caseId}/download-sas`);
  }

  /**
   * Submit user corrections
   */
  async submitCorrections(
    caseId: string,
    corrections: Record<string, unknown>
  ): Promise<Case> {
    return this.fetch<Case>(`/cases/${caseId}/corrections`, {
      method: 'POST',
      body: JSON.stringify(corrections),
    });
  }

  /**
   * Create draft sales order
   */
  async createDraft(caseId: string): Promise<Case> {
    return this.fetch<Case>(`/cases/${caseId}/create-draft`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();
