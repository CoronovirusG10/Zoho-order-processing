/**
 * Cosmos DB Retry Queue
 *
 * Persistent retry queue using Cosmos DB for failed Zoho API requests.
 * Survives service restarts and provides reliable retry with exponential backoff.
 */

import { Container, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { RetryQueueItem, ZohoSalesOrderPayload } from '../types.js';

export interface CosmosRetryQueueConfig {
  container: Container;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
}

export class CosmosRetryQueue {
  private readonly container: Container;
  private readonly config: Required<Omit<CosmosRetryQueueConfig, 'container'>>;

  constructor(config: CosmosRetryQueueConfig) {
    this.container = config.container;
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      initialRetryDelayMs: config.initialRetryDelayMs ?? 60000,
      maxRetryDelayMs: config.maxRetryDelayMs ?? 3600000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };
  }

  /**
   * Add a failed request to the retry queue
   */
  async enqueue(
    caseId: string,
    payload: ZohoSalesOrderPayload,
    fingerprint: string,
    error: Error
  ): Promise<string> {
    const queueItemId = uuidv4();
    const nextRetryAt = new Date(Date.now() + this.config.initialRetryDelayMs).toISOString();

    const queueItem: RetryQueueItem & { id: string } = {
      id: queueItemId,
      case_id: caseId,
      payload,
      fingerprint,
      attempt_count: 0,
      max_retries: this.config.maxRetries,
      next_retry_at: nextRetryAt,
      created_at: new Date().toISOString(),
      error_history: [
        {
          attempted_at: new Date().toISOString(),
          error_code: 'INITIAL_FAILURE',
          error_message: error.message,
        },
      ],
      status: 'pending',
    };

    await this.container.items.create(queueItem);

    console.log(`[CosmosRetryQueue] Enqueued ${queueItemId} for case ${caseId}, next retry at ${nextRetryAt}`);

    return queueItemId;
  }

  /**
   * Get items ready for retry
   */
  async getReadyItems(limit: number = 10): Promise<RetryQueueItem[]> {
    const now = new Date().toISOString();

    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.status = 'pending'
        AND c.next_retry_at <= @now
        ORDER BY c.next_retry_at ASC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@now', value: now },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<RetryQueueItem>(query).fetchAll();
    return resources;
  }

  /**
   * Get an item by ID
   */
  async get(itemId: string, caseId: string): Promise<RetryQueueItem | null> {
    try {
      const { resource } = await this.container.item(itemId, caseId).read<RetryQueueItem>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Mark an item as in progress
   */
  async markInProgress(itemId: string, caseId: string): Promise<void> {
    const item = await this.get(itemId, caseId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    const updated: RetryQueueItem = {
      ...item,
      status: 'in_progress',
      attempt_count: item.attempt_count + 1,
      last_attempted_at: new Date().toISOString(),
    };

    await this.container.item(itemId, caseId).replace(updated);

    console.log(`[CosmosRetryQueue] Attempting ${itemId} (attempt ${updated.attempt_count}/${updated.max_retries})`);
  }

  /**
   * Mark an item as succeeded
   */
  async markSucceeded(
    itemId: string,
    caseId: string,
    salesOrderId: string,
    salesOrderNumber: string
  ): Promise<void> {
    const item = await this.get(itemId, caseId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    const updated: RetryQueueItem = {
      ...item,
      status: 'succeeded',
      // Add TTL to auto-delete after 7 days
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    } as RetryQueueItem & { ttl: number };

    await this.container.item(itemId, caseId).replace(updated);

    console.log(`[CosmosRetryQueue] Succeeded ${itemId} -> Zoho SO ${salesOrderNumber}`);
  }

  /**
   * Mark an item as failed and schedule next retry
   */
  async markFailed(itemId: string, caseId: string, error: Error): Promise<boolean> {
    const item = await this.get(itemId, caseId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    const errorEntry = {
      attempted_at: new Date().toISOString(),
      error_code: this.extractErrorCode(error),
      error_message: error.message,
    };

    if (item.attempt_count >= item.max_retries) {
      // Max retries exceeded - abandon
      const updated: RetryQueueItem = {
        ...item,
        status: 'abandoned',
        error_history: [...item.error_history, errorEntry],
        // Keep abandoned items for 30 days for analysis
        ttl: 30 * 24 * 60 * 60,
      } as RetryQueueItem & { ttl: number };

      await this.container.item(itemId, caseId).replace(updated);

      console.error(`[CosmosRetryQueue] Abandoned ${itemId} after ${item.attempt_count} attempts`);
      return true; // Indicates abandoned
    }

    // Schedule next retry with exponential backoff
    const delay = this.calculateBackoffDelay(item.attempt_count);
    const nextRetryAt = new Date(Date.now() + delay).toISOString();

    const updated: RetryQueueItem = {
      ...item,
      status: 'pending',
      next_retry_at: nextRetryAt,
      error_history: [...item.error_history, errorEntry],
    };

    await this.container.item(itemId, caseId).replace(updated);

    console.warn(
      `[CosmosRetryQueue] Failed ${itemId}, will retry at ${nextRetryAt} (attempt ${item.attempt_count}/${item.max_retries})`
    );
    return false; // Not abandoned, will retry
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptCount: number): number {
    const delay = this.config.initialRetryDelayMs * Math.pow(this.config.backoffMultiplier, attemptCount);
    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: Error): string {
    if ('response' in error && typeof error.response === 'object') {
      const response = error.response as any;
      if (response?.status) {
        return `HTTP_${response.status}`;
      }
    }
    return error.name || 'UNKNOWN_ERROR';
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    ready_for_retry: number;
  }> {
    const statusQuery: SqlQuerySpec = {
      query: `
        SELECT c.status, COUNT(1) as count
        FROM c
        GROUP BY c.status
      `,
    };

    const readyQuery: SqlQuerySpec = {
      query: `
        SELECT VALUE COUNT(1)
        FROM c
        WHERE c.status = 'pending'
        AND c.next_retry_at <= @now
      `,
      parameters: [{ name: '@now', value: new Date().toISOString() }],
    };

    const [statusResult, readyResult] = await Promise.all([
      this.container.items.query<{ status: string; count: number }>(statusQuery).fetchAll(),
      this.container.items.query<number>(readyQuery).fetchAll(),
    ]);

    const stats = {
      total: 0,
      by_status: {} as Record<string, number>,
      ready_for_retry: readyResult.resources[0] || 0,
    };

    for (const row of statusResult.resources) {
      stats.by_status[row.status] = row.count;
      stats.total += row.count;
    }

    return stats;
  }

  /**
   * Get all items for a case
   */
  async getByCase(caseId: string): Promise<RetryQueueItem[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.case_id = @caseId ORDER BY c.created_at DESC',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<RetryQueueItem>(query).fetchAll();
    return resources;
  }
}
