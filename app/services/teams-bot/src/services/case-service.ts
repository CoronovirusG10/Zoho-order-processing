/**
 * Service for managing case records and triggering workflows
 *
 * Provides Cosmos DB persistence for cases with:
 * - createCase(): Creates a new case document
 * - getCaseStatus(): Retrieves current case status
 * - updateCase(): Updates case with OCC (ETag-based optimistic concurrency)
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosClient, Container, ErrorResponse } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { CaseMetadata, ProcessingStatus } from '../types/teams-types.js';

/**
 * Case status values - aligned with workflow service
 */
export type CaseStatus =
  | 'storing_file'
  | 'parsing'
  | 'running_committee'
  | 'awaiting_corrections'
  | 'resolving_customer'
  | 'awaiting_customer_selection'
  | 'resolving_items'
  | 'awaiting_item_selection'
  | 'awaiting_approval'
  | 'creating_zoho_draft'
  | 'queued_for_zoho'
  | 'completed'
  | 'cancelled'
  | 'failed';

/**
 * Case document structure from Cosmos DB
 * Aligned with workflow service CaseDocument
 */
export interface CaseDocument {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  activityId: string;
  fileName: string;
  correlationId: string;
  status: CaseStatus;
  blobUri?: string;
  fileSha256?: string;
  zohoOrderId?: string;
  zohoOrderNumber?: string;
  zohoCustomerName?: string;
  language?: 'en' | 'fa';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  _etag?: string;
}

/**
 * Case summary for status display
 */
export interface CaseSummary {
  caseId: string;
  fileName: string;
  status: string;
  statusDisplay: string;
  createdAt: Date;
  updatedAt: Date;
  zohoOrderNumber?: string;
  customerName?: string;
}

/**
 * Error thrown when OCC conflict occurs
 */
export class ConcurrencyConflictError extends Error {
  constructor(caseId: string) {
    super(`Case ${caseId} was modified by another process. Please retry.`);
    this.name = 'ConcurrencyConflictError';
  }
}

export class CaseService {
  private parserEndpoint: string;
  private workflowEndpoint: string;
  private casesContainer: Container | null = null;
  private cosmosInitialized = false;
  private cosmosInitError: Error | null = null;

  constructor() {
    this.parserEndpoint = process.env.PARSER_ENDPOINT || 'http://localhost:3001';
    this.workflowEndpoint = process.env.WORKFLOW_ENDPOINT || 'http://localhost:3002';
  }

  /**
   * Initialize Cosmos DB client lazily
   */
  private async initCosmos(): Promise<Container | null> {
    if (this.cosmosInitialized) {
      if (this.cosmosInitError) {
        throw this.cosmosInitError;
      }
      return this.casesContainer;
    }

    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || 'order-processing';
    const containerId = 'cases';

    if (!endpoint) {
      console.warn('[CaseService] COSMOS_ENDPOINT not configured, case persistence disabled');
      this.cosmosInitialized = true;
      return null;
    }

    try {
      // Use managed identity if no key provided, otherwise use key-based auth
      const clientOptions = key
        ? { endpoint, key }
        : { endpoint, aadCredentials: new DefaultAzureCredential() };

      const client = new CosmosClient(clientOptions);

      // Get or create database and container
      const { database } = await client.databases.createIfNotExists({
        id: databaseId,
      });

      const { container } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/tenantId'] },
      });

      this.casesContainer = container;
      this.cosmosInitialized = true;
      console.log('[CaseService] Cosmos DB initialized successfully');
      return this.casesContainer;
    } catch (error) {
      console.error('[CaseService] Failed to initialize Cosmos client:', error);
      this.cosmosInitError = error instanceof Error ? error : new Error(String(error));
      this.cosmosInitialized = true;
      throw this.cosmosInitError;
    }
  }

  /**
   * Get recent cases for a user
   */
  async getRecentCasesForUser(userId: string, tenantId: string, limit = 10): Promise<CaseSummary[]> {
    const container = await this.initCosmos();
    if (!container) {
      return [];
    }

    try {
      const querySpec = {
        query: `
          SELECT c.id, c.status, c.fileName, c.createdAt, c.updatedAt,
                 c.zohoOrderNumber, c.zohoCustomerName
          FROM c
          WHERE c.userId = @userId
          ORDER BY c.createdAt DESC
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@limit', value: limit },
        ],
      };

      const { resources } = await container.items
        .query<CaseDocument>(querySpec, {
          partitionKey: tenantId,
        })
        .fetchAll();

      return resources.map(doc => ({
        caseId: doc.id,
        fileName: doc.fileName || 'Unknown file',
        status: doc.status,
        statusDisplay: this.getStatusDisplay(doc.status),
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
        zohoOrderNumber: doc.zohoOrderNumber,
        customerName: doc.zohoCustomerName,
      }));
    } catch (error) {
      console.error('[CaseService] Failed to query cases:', error);
      return [];
    }
  }

  /**
   * Get human-readable status display
   */
  private getStatusDisplay(status: string): string {
    const statusMap: Record<string, string> = {
      storing_file: 'Uploading',
      parsing: 'Analyzing',
      running_committee: 'AI Review',
      awaiting_corrections: 'Needs Corrections',
      resolving_customer: 'Matching Customer',
      awaiting_customer_selection: 'Select Customer',
      resolving_items: 'Matching Items',
      awaiting_item_selection: 'Select Items',
      awaiting_approval: 'Ready for Approval',
      creating_zoho_draft: 'Creating Order',
      queued_for_zoho: 'Queued',
      completed: 'Completed',
      cancelled: 'Cancelled',
      failed: 'Failed',
    };
    return statusMap[status] || status;
  }

  /**
   * Create a new case record in Cosmos DB
   */
  async createCase(metadata: Omit<CaseMetadata, 'caseId'>): Promise<CaseMetadata> {
    const caseId = uuidv4();
    const now = new Date().toISOString();

    const caseData: CaseMetadata = {
      ...metadata,
      caseId,
    };

    const container = await this.initCosmos();
    if (!container) {
      console.warn('[CaseService] Cosmos not available, returning metadata without persistence');
      return caseData;
    }

    try {
      const caseDoc: CaseDocument = {
        id: caseId,
        tenantId: metadata.tenantId,
        userId: metadata.userId,
        conversationId: metadata.conversationId,
        activityId: metadata.activityId,
        fileName: metadata.fileName,
        correlationId: metadata.correlationId,
        status: 'storing_file',
        blobUri: metadata.blobUri,
        fileSha256: metadata.fileSha256,
        createdAt: now,
        updatedAt: now,
      };

      const { resource } = await container.items.create(caseDoc);

      if (!resource) {
        throw new Error('Failed to create case document - no resource returned');
      }

      console.log('[CaseService] Case created successfully', {
        caseId,
        tenantId: metadata.tenantId,
        userId: metadata.userId,
      });

      return caseData;
    } catch (error) {
      console.error('[CaseService] Failed to create case:', error);
      throw error;
    }
  }

  /**
   * Get a case by ID
   */
  async getCase(caseId: string, tenantId: string): Promise<CaseDocument | null> {
    const container = await this.initCosmos();
    if (!container) {
      return null;
    }

    try {
      const { resource } = await container.item(caseId, tenantId).read<CaseDocument>();
      return resource || null;
    } catch (error: unknown) {
      const cosmosError = error as ErrorResponse;
      if (cosmosError.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get case status
   */
  async getCaseStatus(caseId: string, tenantId?: string): Promise<ProcessingStatus | null> {
    const container = await this.initCosmos();
    if (!container) {
      return null;
    }

    try {
      // If tenantId is provided, use point read (most efficient)
      if (tenantId) {
        const caseDoc = await this.getCase(caseId, tenantId);
        if (!caseDoc) {
          return null;
        }
        return this.mapCaseToStatus(caseDoc);
      }

      // Otherwise, query across partitions (less efficient but works without tenantId)
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @caseId',
        parameters: [{ name: '@caseId', value: caseId }],
      };

      // Cross-partition queries are enabled by default in Cosmos SDK v4+
      const { resources } = await container.items
        .query<CaseDocument>(querySpec)
        .fetchAll();

      if (resources.length === 0) {
        return null;
      }

      return this.mapCaseToStatus(resources[0]);
    } catch (error) {
      console.error('[CaseService] Failed to get case status:', error);
      return null;
    }
  }

  /**
   * Map case document to ProcessingStatus
   */
  private mapCaseToStatus(caseDoc: CaseDocument): ProcessingStatus {
    // Map internal status to simplified external status
    const statusMapping: Record<CaseStatus, ProcessingStatus['status']> = {
      storing_file: 'uploading',
      parsing: 'processing',
      running_committee: 'processing',
      awaiting_corrections: 'needs_input',
      resolving_customer: 'processing',
      awaiting_customer_selection: 'needs_input',
      resolving_items: 'processing',
      awaiting_item_selection: 'needs_input',
      awaiting_approval: 'ready',
      creating_zoho_draft: 'creating',
      queued_for_zoho: 'creating',
      completed: 'completed',
      cancelled: 'failed',
      failed: 'failed',
    };

    return {
      caseId: caseDoc.id,
      status: statusMapping[caseDoc.status] || 'processing',
      message: caseDoc.error || this.getStatusDisplay(caseDoc.status),
      correlationId: caseDoc.correlationId,
      timestamp: new Date(caseDoc.updatedAt),
    };
  }

  /**
   * Update case with optimistic concurrency control (OCC)
   *
   * Uses ETag-based concurrency to prevent lost updates when multiple
   * processes try to update the same case simultaneously.
   *
   * @throws ConcurrencyConflictError if the case was modified by another process
   */
  async updateCase(
    caseId: string,
    tenantId: string,
    updates: Partial<CaseDocument>,
    etag?: string
  ): Promise<CaseDocument> {
    const container = await this.initCosmos();
    if (!container) {
      throw new Error('Cosmos DB not initialized');
    }

    try {
      // First, get the existing document
      const existing = await this.getCase(caseId, tenantId);
      if (!existing) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Use provided ETag or the one from the fetched document
      const currentEtag = etag || existing._etag;

      // Merge updates
      const updatedDoc: CaseDocument = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Set completedAt for terminal states
      if (['completed', 'cancelled', 'failed'].includes(updatedDoc.status) && !updatedDoc.completedAt) {
        updatedDoc.completedAt = new Date().toISOString();
      }

      // Perform conditional replace with ETag
      const { resource } = await container.item(caseId, tenantId).replace(updatedDoc, {
        accessCondition: currentEtag
          ? { type: 'IfMatch', condition: currentEtag }
          : undefined,
      });

      if (!resource) {
        throw new Error('Failed to update case document - no resource returned');
      }

      console.log('[CaseService] Case updated successfully', {
        caseId,
        status: updatedDoc.status,
      });

      return resource as CaseDocument;
    } catch (error: unknown) {
      const cosmosError = error as ErrorResponse;

      // Handle 412 Precondition Failed (OCC conflict)
      if (cosmosError.code === 412) {
        throw new ConcurrencyConflictError(caseId);
      }

      throw error;
    }
  }

  /**
   * Update case status with optional additional updates
   */
  async updateCaseStatus(
    caseId: string,
    tenantId: string,
    status: CaseStatus,
    additionalUpdates?: Partial<CaseDocument>,
    etag?: string
  ): Promise<CaseDocument> {
    return this.updateCase(
      caseId,
      tenantId,
      {
        status,
        ...additionalUpdates,
      },
      etag
    );
  }

  /**
   * Trigger parser workflow
   */
  async triggerParser(caseMetadata: CaseMetadata): Promise<void> {
    const payload = {
      caseId: caseMetadata.caseId,
      blobUri: caseMetadata.blobUri,
      tenantId: caseMetadata.tenantId,
      userId: caseMetadata.userId,
      correlationId: caseMetadata.correlationId,
      metadata: {
        fileName: caseMetadata.fileName,
        fileSha256: caseMetadata.fileSha256,
      },
    };

    try {
      const response = await fetch(`${this.parserEndpoint}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': caseMetadata.correlationId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Parser endpoint returned ${response.status}: ${await response.text()}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to trigger parser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update case with user corrections
   */
  async submitCorrections(
    caseId: string,
    corrections: unknown,
    correlationId: string
  ): Promise<void> {
    const payload = {
      caseId,
      corrections,
      correlationId,
    };

    try {
      const response = await fetch(`${this.workflowEndpoint}/corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Workflow endpoint returned ${response.status}: ${await response.text()}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to submit corrections: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Approve and create draft in Zoho
   */
  async approveAndCreate(caseId: string, correlationId: string): Promise<void> {
    const payload = {
      caseId,
      action: 'approve_create',
      correlationId,
    };

    try {
      const response = await fetch(`${this.workflowEndpoint}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Workflow endpoint returned ${response.status}: ${await response.text()}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to approve and create: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Request changes to the order
   */
  async requestChanges(
    caseId: string,
    reason: string,
    correlationId: string
  ): Promise<void> {
    const payload = {
      caseId,
      action: 'request_changes',
      reason,
      correlationId,
    };

    try {
      const response = await fetch(`${this.workflowEndpoint}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Workflow endpoint returned ${response.status}: ${await response.text()}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to request changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the most recent pending case for a user
   * Returns the case ID if found, null otherwise
   */
  async getMostRecentPendingCase(userId: string, tenantId: string): Promise<string | null> {
    const container = await this.initCosmos();
    if (!container) {
      return null;
    }

    try {
      // Query for the most recent non-terminal case
      const terminalStatuses = ['completed', 'cancelled', 'failed'];
      const querySpec = {
        query: `
          SELECT TOP 1 c.id
          FROM c
          WHERE c.userId = @userId
            AND NOT ARRAY_CONTAINS(@terminalStatuses, c.status)
          ORDER BY c.createdAt DESC
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@terminalStatuses', value: terminalStatuses },
        ],
      };

      const { resources } = await container.items
        .query<{ id: string }>(querySpec, {
          partitionKey: tenantId,
        })
        .fetchAll();

      return resources.length > 0 ? resources[0].id : null;
    } catch (error) {
      console.error('[CaseService] Failed to get most recent pending case:', error);
      return null;
    }
  }

  /**
   * Check if a status is cancellable (not in terminal state)
   */
  isCancellableStatus(status: CaseStatus): boolean {
    const terminalStatuses: CaseStatus[] = ['completed', 'cancelled', 'failed'];
    return !terminalStatuses.includes(status);
  }
}
