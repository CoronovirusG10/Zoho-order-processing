/**
 * Cases Repository
 *
 * Repository for managing order processing cases in Cosmos DB.
 * Partition key: /tenantId
 */

import { Container } from '@azure/cosmos';
import { CaseStatus, CanonicalOrderData } from '../workflows/types.js';
import { getCosmosClient } from './cosmos-client.js';

/**
 * Case document structure in Cosmos DB
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
  canonicalData?: CanonicalOrderData;
  zohoOrderId?: string;
  zohoOrderNumber?: string;
  language?: 'en' | 'fa';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Input for creating a new case
 */
export interface CreateCaseInput {
  tenantId: string;
  userId: string;
  conversationId: string;
  activityId: string;
  fileName: string;
  correlationId: string;
  language?: 'en' | 'fa';
}

/**
 * Cases Repository class
 */
export class CasesRepository {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Create a new case
   */
  async createCase(caseId: string, input: CreateCaseInput): Promise<CaseDocument> {
    const now = new Date().toISOString();

    const caseDoc: CaseDocument = {
      id: caseId,
      tenantId: input.tenantId,
      userId: input.userId,
      conversationId: input.conversationId,
      activityId: input.activityId,
      fileName: input.fileName,
      correlationId: input.correlationId,
      status: 'storing_file',
      language: input.language || 'en',
      createdAt: now,
      updatedAt: now,
    };

    const { resource } = await this.container.items.create(caseDoc);

    if (!resource) {
      throw new Error('Failed to create case document');
    }

    return resource as CaseDocument;
  }

  /**
   * Get a case by ID
   */
  async getCase(caseId: string, tenantId: string): Promise<CaseDocument | null> {
    try {
      const { resource } = await this.container.item(caseId, tenantId).read<CaseDocument>();
      return resource || null;
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(
    caseId: string,
    tenantId: string,
    status: CaseStatus,
    updates?: Partial<CaseDocument>
  ): Promise<CaseDocument> {
    const existing = await this.getCase(caseId, tenantId);
    if (!existing) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const updatedDoc: CaseDocument = {
      ...existing,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    };

    // Set completedAt for terminal states
    if (['completed', 'cancelled', 'failed'].includes(status) && !updatedDoc.completedAt) {
      updatedDoc.completedAt = new Date().toISOString();
    }

    const { resource } = await this.container.item(caseId, tenantId).replace(updatedDoc);

    if (!resource) {
      throw new Error('Failed to update case document');
    }

    return resource as CaseDocument;
  }

  /**
   * Update case with blob info
   */
  async updateCaseBlobInfo(
    caseId: string,
    tenantId: string,
    blobUri: string,
    sha256: string
  ): Promise<CaseDocument> {
    return this.updateCaseStatus(caseId, tenantId, 'parsing', {
      blobUri,
      fileSha256: sha256,
    });
  }

  /**
   * Update case with canonical data
   */
  async updateCaseCanonicalData(
    caseId: string,
    tenantId: string,
    canonicalData: CanonicalOrderData
  ): Promise<CaseDocument> {
    const existing = await this.getCase(caseId, tenantId);
    if (!existing) {
      throw new Error(`Case not found: ${caseId}`);
    }

    return this.updateCaseStatus(caseId, tenantId, existing.status, {
      canonicalData,
    });
  }

  /**
   * Update case with Zoho order info
   */
  async updateCaseZohoInfo(
    caseId: string,
    tenantId: string,
    zohoOrderId: string,
    zohoOrderNumber: string
  ): Promise<CaseDocument> {
    return this.updateCaseStatus(caseId, tenantId, 'completed', {
      zohoOrderId,
      zohoOrderNumber,
    });
  }

  /**
   * Mark case as failed
   */
  async markCaseFailed(
    caseId: string,
    tenantId: string,
    error: string
  ): Promise<CaseDocument> {
    return this.updateCaseStatus(caseId, tenantId, 'failed', {
      error,
    });
  }

  /**
   * Get cases by tenant
   */
  async getCasesByTenant(
    tenantId: string,
    limit: number = 50
  ): Promise<CaseDocument[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<CaseDocument>(query).fetchAll();
    return resources;
  }

  /**
   * Get cases by user
   */
  async getCasesByUser(
    tenantId: string,
    userId: string,
    limit: number = 20
  ): Promise<CaseDocument[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.userId = @userId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@userId', value: userId },
        { name: '@limit', value: limit },
      ],
    };

    const { resources } = await this.container.items.query<CaseDocument>(query).fetchAll();
    return resources;
  }

  /**
   * Get active (non-terminal) cases for a user
   */
  async getActiveCases(
    tenantId: string,
    userId: string
  ): Promise<CaseDocument[]> {
    const query = {
      query: `SELECT * FROM c
              WHERE c.tenantId = @tenantId
              AND c.userId = @userId
              AND c.status NOT IN ('completed', 'cancelled', 'failed')
              ORDER BY c.createdAt DESC`,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@userId', value: userId },
      ],
    };

    const { resources } = await this.container.items.query<CaseDocument>(query).fetchAll();
    return resources;
  }
}

// Singleton instance
let casesRepository: CasesRepository | null = null;

/**
 * Get the singleton cases repository
 */
export function getCasesRepository(): CasesRepository {
  if (!casesRepository) {
    const client = getCosmosClient();
    if (!client.isInitialized()) {
      throw new Error('Cosmos client not initialized. Call initializeCosmosClient() first.');
    }
    casesRepository = new CasesRepository(client.cases);
  }
  return casesRepository;
}
