/**
 * Retry Queue
 *
 * Manages failed Zoho API requests for retry with exponential backoff.
 * Stores payloads in Cosmos DB when Zoho is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import { RetryQueueItem, ZohoSalesOrderPayload } from '../types.js';

export interface RetryQueueConfig {
  maxRetries?: number; // Default: 5
  initialRetryDelayMs?: number; // Default: 60000 (1 minute)
  maxRetryDelayMs?: number; // Default: 3600000 (1 hour)
  backoffMultiplier?: number; // Default: 2
}

export class RetryQueue {
  private readonly config: Required<RetryQueueConfig>;
  private queue: Map<string, RetryQueueItem>;

  constructor(config: RetryQueueConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      initialRetryDelayMs: config.initialRetryDelayMs ?? 60000,
      maxRetryDelayMs: config.maxRetryDelayMs ?? 3600000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };

    this.queue = new Map();
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

    const nextRetryAt = new Date(
      Date.now() + this.config.initialRetryDelayMs
    ).toISOString();

    const queueItem: RetryQueueItem = {
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

    this.queue.set(queueItemId, queueItem);

    console.log(
      `[RetryQueue] Enqueued ${queueItemId} for case ${caseId}, next retry at ${nextRetryAt}`
    );

    // TODO: In production, persist to Cosmos DB
    // await this.persistToCosmosDb(queueItem);

    return queueItemId;
  }

  /**
   * Get items ready for retry
   */
  getReadyItems(): RetryQueueItem[] {
    const now = new Date().toISOString();
    const ready: RetryQueueItem[] = [];

    for (const item of this.queue.values()) {
      if (item.status === 'pending' && item.next_retry_at <= now) {
        ready.push(item);
      }
    }

    return ready;
  }

  /**
   * Mark an item as in progress
   * @param itemId - The queue item ID
   * @param _caseId - Optional caseId (for interface compatibility with CosmosRetryQueue)
   */
  markInProgress(itemId: string, _caseId?: string): void {
    const item = this.queue.get(itemId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    item.status = 'in_progress';
    item.attempt_count += 1;
    item.last_attempted_at = new Date().toISOString();

    console.log(
      `[RetryQueue] Attempting ${itemId} (attempt ${item.attempt_count}/${item.max_retries})`
    );
  }

  /**
   * Mark an item as succeeded (remove from queue)
   * @param itemId - The queue item ID
   * @param caseIdOrSalesOrderId - Either caseId (for interface compatibility) or salesOrderId
   * @param salesOrderIdOrNumber - Either salesOrderId (when caseId provided) or salesOrderNumber
   * @param salesOrderNumber - Optional salesOrderNumber (when all 4 params provided)
   */
  async markSucceeded(
    itemId: string,
    caseIdOrSalesOrderId: string,
    salesOrderIdOrNumber: string,
    salesOrderNumber?: string
  ): Promise<void> {
    const item = this.queue.get(itemId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    // Determine the actual salesOrderNumber based on how the method was called
    const actualSalesOrderNumber = salesOrderNumber ?? salesOrderIdOrNumber;

    item.status = 'succeeded';

    console.log(
      `[RetryQueue] Succeeded ${itemId} -> Zoho SO ${actualSalesOrderNumber}`
    );

    // Remove from in-memory queue
    this.queue.delete(itemId);

    // TODO: Update status in Cosmos DB and create outbox entry
    // await this.updateCosmosDb(itemId, 'succeeded', { salesOrderId, salesOrderNumber });
    // await this.createOutboxEntry(item, 'salesorder_created', { salesOrderId, salesOrderNumber });
  }

  /**
   * Mark an item as failed and schedule next retry
   * @param itemId - The queue item ID
   * @param caseIdOrError - Either caseId (for interface compatibility) or Error object
   * @param errorObj - Optional Error object (when caseId is provided)
   * @returns true if abandoned, false if will retry
   */
  async markFailed(
    itemId: string,
    caseIdOrError: string | Error,
    errorObj?: Error
  ): Promise<boolean> {
    const item = this.queue.get(itemId);
    if (!item) {
      throw new Error(`Queue item ${itemId} not found`);
    }

    // Determine the actual error based on how the method was called
    const error = errorObj ?? (caseIdOrError instanceof Error ? caseIdOrError : new Error('Unknown error'));

    item.error_history.push({
      attempted_at: new Date().toISOString(),
      error_code: this.extractErrorCode(error),
      error_message: error.message,
    });

    if (item.attempt_count >= item.max_retries) {
      // Max retries exceeded - abandon
      item.status = 'abandoned';

      console.error(
        `[RetryQueue] Abandoned ${itemId} after ${item.attempt_count} attempts`
      );

      // TODO: Create outbox entry to notify user
      // await this.createOutboxEntry(item, 'retry_exhausted', { error: error.message });

      this.queue.delete(itemId);
      return true; // Indicates abandoned
    } else {
      // Schedule next retry with exponential backoff
      const delay = this.calculateBackoffDelay(item.attempt_count);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      item.status = 'pending';
      item.next_retry_at = nextRetryAt;

      console.warn(
        `[RetryQueue] Failed ${itemId}, will retry at ${nextRetryAt} (attempt ${item.attempt_count}/${item.max_retries})`
      );

      // TODO: Update in Cosmos DB
      // await this.updateCosmosDb(itemId, 'pending', { next_retry_at: nextRetryAt });
      return false; // Not abandoned, will retry
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptCount: number): number {
    const delay =
      this.config.initialRetryDelayMs *
      Math.pow(this.config.backoffMultiplier, attemptCount);

    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: Error): string {
    // Check if it's an axios error with status
    if ('response' in error && typeof error.response === 'object') {
      const response = error.response as any;
      if (response?.status) {
        return `HTTP_${response.status}`;
      }
    }

    if (error.name) {
      return error.name;
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const stats = {
      total: this.queue.size,
      by_status: {
        pending: 0,
        in_progress: 0,
        succeeded: 0,
        failed: 0,
        abandoned: 0,
      },
      ready_for_retry: 0,
    };

    const now = new Date().toISOString();

    for (const item of this.queue.values()) {
      stats.by_status[item.status]++;

      if (item.status === 'pending' && item.next_retry_at <= now) {
        stats.ready_for_retry++;
      }
    }

    return stats;
  }

  /**
   * Clear the queue (for testing)
   */
  clear(): void {
    this.queue.clear();
  }
}
