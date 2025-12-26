/**
 * Cosmos DB Outbox
 *
 * Persistent outbox pattern implementation for reliable event publishing.
 * Ensures events are delivered even if service crashes mid-operation.
 */

import { Container, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { OutboxEntry } from '../types.js';

export interface CosmosOutboxConfig {
  container: Container;
}

export class CosmosOutbox {
  private readonly container: Container;

  constructor(config: CosmosOutboxConfig) {
    this.container = config.container;
  }

  /**
   * Create an outbox entry for a sales order creation event
   */
  async createSalesOrderCreatedEvent(
    caseId: string,
    salesOrderId: string,
    salesOrderNumber: string
  ): Promise<string> {
    const entryId = uuidv4();

    const entry: OutboxEntry & { id: string } = {
      id: entryId,
      case_id: caseId,
      event_type: 'salesorder_created',
      payload: {
        salesorder_id: salesOrderId,
        salesorder_number: salesOrderNumber,
      },
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    await this.container.items.create(entry);

    console.log(`[CosmosOutbox] Created event ${entryId}: salesorder_created for case ${caseId}`);

    return entryId;
  }

  /**
   * Create an outbox entry for a sales order failure event
   */
  async createSalesOrderFailedEvent(
    caseId: string,
    error: string,
    attemptCount: number
  ): Promise<string> {
    const entryId = uuidv4();

    const entry: OutboxEntry & { id: string } = {
      id: entryId,
      case_id: caseId,
      event_type: 'salesorder_failed',
      payload: {
        error_message: error,
        attempt_count: attemptCount,
      },
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    await this.container.items.create(entry);

    console.log(`[CosmosOutbox] Created event ${entryId}: salesorder_failed for case ${caseId}`);

    return entryId;
  }

  /**
   * Create an outbox entry for retry exhausted event
   */
  async createRetryExhaustedEvent(
    caseId: string,
    attemptCount: number,
    lastError: string
  ): Promise<string> {
    const entryId = uuidv4();

    const entry: OutboxEntry & { id: string } = {
      id: entryId,
      case_id: caseId,
      event_type: 'retry_exhausted',
      payload: {
        attempt_count: attemptCount,
        last_error: lastError,
      },
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    await this.container.items.create(entry);

    console.log(`[CosmosOutbox] Created event ${entryId}: retry_exhausted for case ${caseId}`);

    return entryId;
  }

  /**
   * Get pending outbox entries for processing
   */
  async getPendingEntries(limit: number = 100): Promise<OutboxEntry[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.status = 'pending'
        ORDER BY c.created_at ASC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [{ name: '@limit', value: limit }],
    };

    const { resources } = await this.container.items.query<OutboxEntry>(query).fetchAll();
    return resources;
  }

  /**
   * Mark an outbox entry as processed
   */
  async markProcessed(entryId: string, caseId: string): Promise<void> {
    const { resource } = await this.container.item(entryId, caseId).read<OutboxEntry>();

    if (!resource) {
      throw new Error(`Outbox entry ${entryId} not found`);
    }

    const updated: OutboxEntry & { id: string; ttl: number } = {
      ...resource,
      id: entryId,
      status: 'processed',
      processed_at: new Date().toISOString(),
      // Auto-delete after 30 days
      ttl: 30 * 24 * 60 * 60,
    };

    await this.container.item(entryId, caseId).replace(updated);

    console.log(`[CosmosOutbox] Marked ${entryId} as processed`);
  }

  /**
   * Mark an outbox entry as failed
   */
  async markFailed(entryId: string, caseId: string, error: string): Promise<void> {
    const { resource } = await this.container.item(entryId, caseId).read<OutboxEntry & { id: string; retry_count?: number }>();

    if (!resource) {
      throw new Error(`Outbox entry ${entryId} not found`);
    }

    const updated = {
      ...resource,
      status: 'failed' as const,
      last_error: error,
      retry_count: (resource.retry_count || 0) + 1,
    };

    await this.container.item(entryId, caseId).replace(updated);

    console.log(`[CosmosOutbox] Marked ${entryId} as failed: ${error}`);
  }

  /**
   * Get all entries for a case
   */
  async getEntriesForCase(caseId: string): Promise<OutboxEntry[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.case_id = @caseId ORDER BY c.created_at DESC',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<OutboxEntry>(query).fetchAll();
    return resources;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_event_type: Record<string, number>;
  }> {
    const statusQuery: SqlQuerySpec = {
      query: `
        SELECT c.status, COUNT(1) as count
        FROM c
        GROUP BY c.status
      `,
    };

    const eventTypeQuery: SqlQuerySpec = {
      query: `
        SELECT c.event_type, COUNT(1) as count
        FROM c
        GROUP BY c.event_type
      `,
    };

    const [statusResult, eventTypeResult] = await Promise.all([
      this.container.items.query<{ status: string; count: number }>(statusQuery).fetchAll(),
      this.container.items.query<{ event_type: string; count: number }>(eventTypeQuery).fetchAll(),
    ]);

    const stats = {
      total: 0,
      by_status: {} as Record<string, number>,
      by_event_type: {} as Record<string, number>,
    };

    for (const row of statusResult.resources) {
      stats.by_status[row.status] = row.count;
      stats.total += row.count;
    }

    for (const row of eventTypeResult.resources) {
      stats.by_event_type[row.event_type] = row.count;
    }

    return stats;
  }
}
