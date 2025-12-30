/**
 * Events Repository
 *
 * Repository for managing audit events in Cosmos DB.
 * Partition key: /caseId
 */

import { Container } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { CaseStatus } from '../workflows/types.js';
import { getCosmosClient } from './cosmos-client.js';

/**
 * Event types for audit trail
 */
export type EventType =
  | 'case_created'
  | 'file_stored'
  | 'file_parsed'
  | 'committee_run'
  | 'corrections_applied'
  | 'customer_resolved'
  | 'customer_selected'
  | 'items_resolved'
  | 'items_selected'
  | 'approval_received'
  | 'zoho_draft_created'
  | 'case_completed'
  | 'case_failed'
  | 'case_cancelled'
  | 'status_changed'
  | 'error';

/**
 * Event document structure in Cosmos DB
 */
export interface EventDocument {
  id: string;
  caseId: string;
  type: EventType;
  timestamp: string;
  sequenceNumber: number;
  status?: CaseStatus;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Input for creating an event
 */
export interface CreateEventInput {
  caseId: string;
  type: EventType;
  status?: CaseStatus;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Events Repository class
 */
export class EventsRepository {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Append an event to the audit trail
   */
  async appendEvent(input: CreateEventInput): Promise<EventDocument> {
    // Get the next sequence number for this case
    const sequenceNumber = await this.getNextSequenceNumber(input.caseId);

    const eventDoc: EventDocument = {
      id: uuidv4(),
      caseId: input.caseId,
      type: input.type,
      timestamp: new Date().toISOString(),
      sequenceNumber,
      status: input.status,
      userId: input.userId,
      correlationId: input.correlationId,
      metadata: input.metadata,
      error: input.error,
    };

    const { resource } = await this.container.items.create(eventDoc);

    if (!resource) {
      throw new Error('Failed to create event document');
    }

    return resource as EventDocument;
  }

  /**
   * Get the next sequence number for a case
   */
  private async getNextSequenceNumber(caseId: string): Promise<number> {
    const query = {
      query: 'SELECT MAX(c.sequenceNumber) as maxSeq FROM c WHERE c.caseId = @caseId',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<{ maxSeq: number | null }>(query).fetchAll();
    const maxSeq = resources[0]?.maxSeq ?? 0;
    return maxSeq + 1;
  }

  /**
   * Get all events for a case
   */
  async getEventsByCaseId(caseId: string): Promise<EventDocument[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId ORDER BY c.sequenceNumber ASC',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<EventDocument>(query).fetchAll();
    return resources;
  }

  /**
   * Get events by type for a case
   */
  async getEventsByType(caseId: string, type: EventType): Promise<EventDocument[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId AND c.type = @type ORDER BY c.sequenceNumber ASC',
      parameters: [
        { name: '@caseId', value: caseId },
        { name: '@type', value: type },
      ],
    };

    const { resources } = await this.container.items.query<EventDocument>(query).fetchAll();
    return resources;
  }

  /**
   * Get the latest event for a case
   */
  async getLatestEvent(caseId: string): Promise<EventDocument | null> {
    const query = {
      query: 'SELECT TOP 1 * FROM c WHERE c.caseId = @caseId ORDER BY c.sequenceNumber DESC',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<EventDocument>(query).fetchAll();
    return resources[0] || null;
  }

  /**
   * Get event count for a case
   */
  async getEventCount(caseId: string): Promise<number> {
    const query = {
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.caseId = @caseId',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items.query<number>(query).fetchAll();
    return resources[0] || 0;
  }

  /**
   * Helper: Log a status change event
   */
  async logStatusChange(
    caseId: string,
    status: CaseStatus,
    correlationId?: string,
    metadata?: Record<string, unknown>
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'status_changed',
      status,
      correlationId,
      metadata,
    });
  }

  /**
   * Helper: Log an error event
   */
  async logError(
    caseId: string,
    error: string,
    correlationId?: string,
    metadata?: Record<string, unknown>
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'error',
      error,
      correlationId,
      metadata,
    });
  }

  /**
   * Helper: Log case creation
   */
  async logCaseCreated(
    caseId: string,
    userId: string,
    correlationId: string,
    metadata?: Record<string, unknown>
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'case_created',
      status: 'storing_file',
      userId,
      correlationId,
      metadata,
    });
  }

  /**
   * Helper: Log file stored
   */
  async logFileStored(
    caseId: string,
    blobUri: string,
    sha256: string,
    correlationId?: string
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'file_stored',
      correlationId,
      metadata: { blobUri, sha256 },
    });
  }

  /**
   * Helper: Log Zoho draft created
   */
  async logZohoDraftCreated(
    caseId: string,
    zohoOrderId: string,
    zohoOrderNumber: string,
    correlationId?: string
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'zoho_draft_created',
      status: 'completed',
      correlationId,
      metadata: { zohoOrderId, zohoOrderNumber },
    });
  }

  /**
   * Helper: Log case completed
   */
  async logCaseCompleted(
    caseId: string,
    correlationId?: string,
    metadata?: Record<string, unknown>
  ): Promise<EventDocument> {
    return this.appendEvent({
      caseId,
      type: 'case_completed',
      status: 'completed',
      correlationId,
      metadata,
    });
  }
}

// Singleton instance
let eventsRepository: EventsRepository | null = null;

/**
 * Get the singleton events repository
 */
export function getEventsRepository(): EventsRepository {
  if (!eventsRepository) {
    const client = getCosmosClient();
    if (!client.isInitialized()) {
      throw new Error('Cosmos client not initialized. Call initializeCosmosClient() first.');
    }
    eventsRepository = new EventsRepository(client.events);
  }
  return eventsRepository;
}
