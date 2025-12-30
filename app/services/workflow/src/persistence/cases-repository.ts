/**
 * Cases Repository
 *
 * Persists order processing cases to Cosmos DB.
 * Each case represents a single order file processing workflow instance.
 */

import { Container, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Valid case statuses tracking workflow progression
 */
export type CaseStatus =
  | 'created'
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
  | 'failed'
  | 'cancelled';

/**
 * Case document representing an order processing workflow instance
 */
export interface Case {
  /** Unique case identifier (document ID) */
  id: string;
  /** Tenant ID for multi-tenant isolation (partition key) */
  tenantId: string;
  /** User who initiated the order */
  userId: string;
  /** Microsoft Teams conversation ID */
  conversationId: string;
  /** Original file name */
  fileName: string;
  /** Azure Blob Storage URI for stored file */
  blobUri?: string;
  /** SHA256 hash of the file */
  fileSha256?: string;
  /** Current workflow status */
  status: CaseStatus;
  /** Parsed and normalized order data */
  canonicalData?: unknown;
  /** Zoho Sales Order ID if created */
  zohoOrderId?: string;
  /** Zoho Sales Order number if created */
  zohoOrderNumber?: string;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Input for creating a new case
 */
export interface CreateCaseInput {
  tenantId: string;
  userId: string;
  conversationId: string;
  fileName: string;
  correlationId: string;
  blobUri?: string;
}

/**
 * Cases repository interface
 */
export interface ICasesRepository {
  createCase(data: CreateCaseInput): Promise<Case>;
  getCase(caseId: string): Promise<Case | null>;
  getCaseWithPartition(caseId: string, tenantId: string): Promise<Case | null>;
  updateCaseStatus(caseId: string, status: CaseStatus, updates?: Partial<Case>): Promise<Case>;
  getCasesByTenant(tenantId: string, limit?: number): Promise<Case[]>;
}

// ============================================================================
// Implementation
// ============================================================================

export interface CasesRepositoryConfig {
  container: Container;
}

export class CasesRepository implements ICasesRepository {
  private readonly container: Container;

  constructor(config: CasesRepositoryConfig) {
    this.container = config.container;
  }

  /**
   * Create a new case
   */
  async createCase(data: CreateCaseInput): Promise<Case> {
    const now = new Date().toISOString();
    const caseId = uuidv4();

    const caseDoc: Case = {
      id: caseId,
      tenantId: data.tenantId,
      userId: data.userId,
      conversationId: data.conversationId,
      fileName: data.fileName,
      blobUri: data.blobUri,
      status: 'created',
      correlationId: data.correlationId,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[WorkflowCosmos] Creating case ${caseId} for tenant ${data.tenantId}`);

    const { resource } = await this.container.items.create(caseDoc);

    if (!resource) {
      throw new Error('Failed to create case document');
    }

    console.log(`[WorkflowCosmos] Case ${caseId} created successfully`);
    return resource;
  }

  /**
   * Get a case by ID (cross-partition query)
   * Use getCaseWithPartition when tenantId is known for better performance
   */
  async getCase(caseId: string): Promise<Case | null> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.id = @caseId',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    try {
      const { resources } = await this.container.items.query<Case>(query).fetchAll();
      return resources.length > 0 ? resources[0] : null;
    } catch (error: unknown) {
      const cosmosError = error as { code?: number };
      if (cosmosError.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a case by ID with known partition key (more efficient)
   */
  async getCaseWithPartition(caseId: string, tenantId: string): Promise<Case | null> {
    try {
      const { resource } = await this.container.item(caseId, tenantId).read<Case>();
      return resource || null;
    } catch (error: unknown) {
      const cosmosError = error as { code?: number };
      if (cosmosError.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update case status and optional additional fields
   */
  async updateCaseStatus(
    caseId: string,
    status: CaseStatus,
    updates?: Partial<Case>
  ): Promise<Case> {
    // First, get the existing case to find its partition key
    const existing = await this.getCase(caseId);
    if (!existing) {
      throw new Error(`Case ${caseId} not found`);
    }

    const now = new Date().toISOString();
    const updated: Case = {
      ...existing,
      ...updates,
      status,
      updatedAt: now,
    };

    console.log(`[WorkflowCosmos] Updating case ${caseId} status to ${status}`);

    const { resource } = await this.container
      .item(caseId, existing.tenantId)
      .replace(updated);

    if (!resource) {
      throw new Error(`Failed to update case ${caseId}`);
    }

    console.log(`[WorkflowCosmos] Case ${caseId} updated successfully`);
    return resource;
  }

  /**
   * Get cases by tenant ID, ordered by creation date descending
   */
  async getCasesByTenant(tenantId: string, limit: number = 100): Promise<Case[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.tenantId = @tenantId
        ORDER BY c.createdAt DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<Case>(query).fetchAll();
    return resources;
  }

  /**
   * Get cases by status
   */
  async getCasesByStatus(status: CaseStatus, limit: number = 100): Promise<Case[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.status = @status
        ORDER BY c.createdAt DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@status', value: status },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<Case>(query).fetchAll();
    return resources;
  }

  /**
   * Get active cases (not completed, failed, or cancelled)
   */
  async getActiveCases(tenantId: string, limit: number = 50): Promise<Case[]> {
    const query: SqlQuerySpec = {
      query: `
        SELECT * FROM c
        WHERE c.tenantId = @tenantId
        AND c.status NOT IN ('completed', 'failed', 'cancelled')
        ORDER BY c.createdAt DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<Case>(query).fetchAll();
    return resources;
  }
}
