/**
 * Fingerprint Store
 *
 * Persists order fingerprints to Cosmos DB for idempotency checking.
 * Ensures duplicate orders are detected even across service restarts.
 */

import { Container, SqlQuerySpec } from '@azure/cosmos';
import { OrderFingerprint } from '../types.js';

export interface FingerprintStoreConfig {
  container: Container;
}

export class FingerprintStore {
  private readonly container: Container;
  private readonly localCache: Map<string, OrderFingerprint>;

  constructor(config: FingerprintStoreConfig) {
    this.container = config.container;
    this.localCache = new Map();
  }

  /**
   * Check if a fingerprint exists
   */
  async exists(fingerprint: string): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(fingerprint)) {
      return true;
    }

    // Query Cosmos DB
    const query: SqlQuerySpec = {
      query: 'SELECT c.fingerprint FROM c WHERE c.fingerprint = @fingerprint',
      parameters: [{ name: '@fingerprint', value: fingerprint }],
    };

    const { resources } = await this.container.items.query(query).fetchAll();
    return resources.length > 0;
  }

  /**
   * Get a fingerprint entry by fingerprint hash
   */
  async get(fingerprint: string): Promise<OrderFingerprint | null> {
    // Check local cache first
    const cached = this.localCache.get(fingerprint);
    if (cached) {
      return cached;
    }

    // Query Cosmos DB
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.fingerprint = @fingerprint',
      parameters: [{ name: '@fingerprint', value: fingerprint }],
    };

    const { resources } = await this.container.items.query<OrderFingerprint>(query).fetchAll();

    if (resources.length > 0) {
      const entry = resources[0];
      this.localCache.set(fingerprint, entry);
      return entry;
    }

    return null;
  }

  /**
   * Get a fingerprint entry by case ID
   */
  async getByCase(caseId: string): Promise<OrderFingerprint | null> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.case_id = @caseId',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<OrderFingerprint>(query).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  /**
   * Create a new fingerprint entry (in_flight status)
   */
  async create(entry: Omit<OrderFingerprint, 'id'>): Promise<OrderFingerprint> {
    const document: OrderFingerprint & { id: string } = {
      ...entry,
      id: entry.fingerprint, // Use fingerprint as document ID for uniqueness
    };

    const { resource } = await this.container.items.create(document);

    if (!resource) {
      throw new Error('Failed to create fingerprint entry');
    }

    this.localCache.set(entry.fingerprint, resource);
    return resource;
  }

  /**
   * Update fingerprint status after sales order creation
   */
  async markCreated(
    fingerprint: string,
    salesOrderId: string,
    salesOrderNumber: string
  ): Promise<void> {
    const existing = await this.get(fingerprint);
    if (!existing) {
      throw new Error(`Fingerprint ${fingerprint} not found`);
    }

    const updated: OrderFingerprint = {
      ...existing,
      zoho_salesorder_id: salesOrderId,
      zoho_salesorder_number: salesOrderNumber,
      status: 'created',
    };

    await this.container.item(fingerprint, existing.case_id).replace(updated);
    this.localCache.set(fingerprint, updated);
  }

  /**
   * Update fingerprint status to failed
   */
  async markFailed(fingerprint: string): Promise<void> {
    const existing = await this.get(fingerprint);
    if (!existing) {
      throw new Error(`Fingerprint ${fingerprint} not found`);
    }

    const updated: OrderFingerprint = {
      ...existing,
      status: 'failed',
    };

    await this.container.item(fingerprint, existing.case_id).replace(updated);
    this.localCache.set(fingerprint, updated);
  }

  /**
   * Delete a fingerprint (used for failed orders that should be retried)
   */
  async delete(fingerprint: string, caseId: string): Promise<void> {
    await this.container.item(fingerprint, caseId).delete();
    this.localCache.delete(fingerprint);
  }

  /**
   * Get all fingerprints for a date range (for reporting)
   */
  async getByDateRange(startDate: string, endDate: string): Promise<OrderFingerprint[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.created_at >= @startDate
        AND c.created_at <= @endDate
        ORDER BY c.created_at DESC
      `,
      parameters: [
        { name: '@startDate', value: startDate },
        { name: '@endDate', value: endDate },
      ],
    };

    const { resources } = await this.container.items.query<OrderFingerprint>(query).fetchAll();
    return resources;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
  }> {
    const query: SqlQuerySpec = {
      query: `
        SELECT c.status, COUNT(1) as count
        FROM c
        GROUP BY c.status
      `,
    };

    const { resources } = await this.container.items.query<{ status: string; count: number }>(query).fetchAll();

    const stats = {
      total: 0,
      by_status: {} as Record<string, number>,
    };

    for (const row of resources) {
      stats.by_status[row.status] = row.count;
      stats.total += row.count;
    }

    return stats;
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCache.clear();
  }
}
