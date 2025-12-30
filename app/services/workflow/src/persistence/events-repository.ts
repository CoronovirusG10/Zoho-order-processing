/**
 * Events Repository
 *
 * Persists audit events to Cosmos DB for workflow tracking and debugging.
 * Events are append-only and provide a complete audit trail of case processing.
 */

import { Container, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import type { CaseStatus } from './cases-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Event types that can occur during order processing
 */
export type EventType =
  | 'case_created'
  | 'file_stored'
  | 'file_reuploaded'
  | 'parse_completed'
  | 'parse_blocked'
  | 'committee_validated'
  | 'corrections_submitted'
  | 'customer_resolved'
  | 'customer_selected'
  | 'items_resolved'
  | 'items_selected'
  | 'approval_received'
  | 'approval_rejected'
  | 'zoho_draft_created'
  | 'zoho_draft_queued'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Audit event document for tracking workflow progression
 */
export interface AuditEvent {
  /** Unique event identifier (document ID) */
  id: string;
  /** Case ID this event belongs to (partition key) */
  caseId: string;
  /** Type of event */
  type: EventType;
  /** ISO timestamp of when event occurred */
  timestamp: string;
  /** Case status after this event (if status changed) */
  status?: CaseStatus;
  /** Additional event-specific metadata */
  metadata?: Record<string, unknown>;
  /** User who triggered this event (if applicable) */
  userId?: string;
}

/**
 * Input for appending a new event
 */
export interface AppendEventInput {
  type: EventType;
  status?: CaseStatus;
  metadata?: Record<string, unknown>;
  userId?: string;
}

/**
 * Events repository interface
 */
export interface IEventsRepository {
  appendEvent(caseId: string, event: AppendEventInput): Promise<AuditEvent>;
  getEventsByCaseId(caseId: string): Promise<AuditEvent[]>;
  getEventsByType(eventType: EventType, limit?: number): Promise<AuditEvent[]>;
  getLatestEvent(caseId: string): Promise<AuditEvent | null>;
}

// ============================================================================
// Implementation
// ============================================================================

export interface EventsRepositoryConfig {
  container: Container;
}

export class EventsRepository implements IEventsRepository {
  private readonly container: Container;

  constructor(config: EventsRepositoryConfig) {
    this.container = config.container;
  }

  /**
   * Append a new event to the audit log
   */
  async appendEvent(caseId: string, event: AppendEventInput): Promise<AuditEvent> {
    const eventDoc: AuditEvent = {
      id: uuidv4(),
      caseId,
      type: event.type,
      timestamp: new Date().toISOString(),
      status: event.status,
      metadata: event.metadata,
      userId: event.userId,
    };

    console.log(`[WorkflowCosmos] Appending event ${event.type} for case ${caseId}`);

    const { resource } = await this.container.items.create(eventDoc);

    if (!resource) {
      throw new Error('Failed to create event document');
    }

    console.log(`[WorkflowCosmos] Event ${eventDoc.id} appended successfully`);
    return resource;
  }

  /**
   * Get all events for a case, ordered by timestamp ascending
   */
  async getEventsByCaseId(caseId: string): Promise<AuditEvent[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.caseId = @caseId
        ORDER BY c.timestamp ASC
      `,
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<AuditEvent>(query).fetchAll();
    return resources;
  }

  /**
   * Get the latest event for a case
   */
  async getLatestEvent(caseId: string): Promise<AuditEvent | null> {
    const query: SqlQuerySpec = {
      query: `
        SELECT TOP 1 * FROM c
        WHERE c.caseId = @caseId
        ORDER BY c.timestamp DESC
      `,
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<AuditEvent>(query).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  /**
   * Get events by type (cross-partition query)
   */
  async getEventsByType(eventType: EventType, limit: number = 100): Promise<AuditEvent[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.type = @eventType
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@eventType', value: eventType },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<AuditEvent>(query).fetchAll();
    return resources;
  }

  /**
   * Get events in a time range for a case
   */
  async getEventsInRange(
    caseId: string,
    startTime: string,
    endTime: string
  ): Promise<AuditEvent[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.caseId = @caseId
        AND c.timestamp >= @startTime
        AND c.timestamp <= @endTime
        ORDER BY c.timestamp ASC
      `,
      parameters: [
        { name: '@caseId', value: caseId },
        { name: '@startTime', value: startTime },
        { name: '@endTime', value: endTime },
      ],
    };

    const { resources } = await this.container.items.query<AuditEvent>(query).fetchAll();
    return resources;
  }

  /**
   * Get event counts by type for analytics
   */
  async getEventStats(): Promise<Record<string, number>> {
    const query: SqlQuerySpec = {
      query: `
        SELECT c.type, COUNT(1) as count
        FROM c
        GROUP BY c.type
      `,
    };

    const { resources } = await this.container.items
      .query<{ type: string; count: number }>(query)
      .fetchAll();

    const stats: Record<string, number> = {};
    for (const row of resources) {
      stats[row.type] = row.count;
    }

    return stats;
  }

  /**
   * Get recent events across all cases (for monitoring)
   */
  async getRecentEvents(limit: number = 50): Promise<AuditEvent[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [{ name: '@limit', value: limit }],
    };

    const { resources } = await this.container.items.query<AuditEvent>(query).fetchAll();
    return resources;
  }
}
