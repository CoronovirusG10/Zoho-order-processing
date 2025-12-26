/**
 * Outbox Pattern
 *
 * Ensures reliable event publishing when sales orders are created or fail.
 * Events are stored in Cosmos DB and processed asynchronously.
 */

import { v4 as uuidv4 } from 'uuid';
import { OutboxEntry } from '../types.js';

export interface OutboxConfig {
  // Configuration for outbox processing
}

export class Outbox {
  private entries: Map<string, OutboxEntry>;

  constructor(config: OutboxConfig = {}) {
    this.entries = new Map();
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

    const entry: OutboxEntry = {
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

    this.entries.set(entryId, entry);

    console.log(
      `[Outbox] Created event ${entryId}: salesorder_created for case ${caseId}`
    );

    // TODO: Persist to Cosmos DB
    // await this.persistToCosmosDb(entry);

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

    const entry: OutboxEntry = {
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

    this.entries.set(entryId, entry);

    console.log(
      `[Outbox] Created event ${entryId}: salesorder_failed for case ${caseId}`
    );

    // TODO: Persist to Cosmos DB
    // await this.persistToCosmosDb(entry);

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

    const entry: OutboxEntry = {
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

    this.entries.set(entryId, entry);

    console.log(
      `[Outbox] Created event ${entryId}: retry_exhausted for case ${caseId}`
    );

    // TODO: Persist to Cosmos DB and trigger Teams notification
    // await this.persistToCosmosDb(entry);
    // await this.triggerTeamsNotification(caseId, entry);

    return entryId;
  }

  /**
   * Mark an outbox entry as processed
   */
  async markProcessed(entryId: string): Promise<void> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      throw new Error(`Outbox entry ${entryId} not found`);
    }

    entry.status = 'processed';
    entry.processed_at = new Date().toISOString();

    console.log(`[Outbox] Marked ${entryId} as processed`);

    // TODO: Update in Cosmos DB
    // await this.updateCosmosDb(entryId, 'processed');
  }

  /**
   * Get pending outbox entries
   */
  getPendingEntries(): OutboxEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.status === 'pending'
    );
  }

  /**
   * Get all entries for a case
   */
  getEntriesForCase(caseId: string): OutboxEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.case_id === caseId
    );
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
  }
}
