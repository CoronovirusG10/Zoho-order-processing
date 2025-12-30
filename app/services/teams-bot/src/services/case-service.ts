/**
 * Service for managing case records and triggering workflows
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosClient, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { CaseMetadata, ProcessingStatus } from '../types/teams-types.js';

/**
 * Case document structure from Cosmos DB
 */
export interface CaseDocument {
  id: string;
  caseId: string;
  tenantId: string;
  userId: string;
  status: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  zohoOrderId?: string;
  zohoOrderNumber?: string;
  zohoCustomerName?: string;
  errorMessage?: string;
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

export class CaseService {
  private parserEndpoint: string;
  private workflowEndpoint: string;
  private casesContainer: Container | null = null;
  private cosmosInitialized = false;

  constructor() {
    this.parserEndpoint = process.env.PARSER_ENDPOINT || 'http://localhost:3001';
    this.workflowEndpoint = process.env.WORKFLOW_ENDPOINT || 'http://localhost:3002';
  }

  /**
   * Initialize Cosmos DB client lazily
   */
  private async initCosmos(): Promise<Container | null> {
    if (this.cosmosInitialized) {
      return this.casesContainer;
    }

    const endpoint = process.env.COSMOS_ENDPOINT;
    const databaseId = process.env.COSMOS_DATABASE_ID || 'order-processing';
    const containerId = 'cases';

    if (!endpoint) {
      console.warn('COSMOS_ENDPOINT not configured, case queries disabled');
      this.cosmosInitialized = true;
      return null;
    }

    try {
      const credential = new DefaultAzureCredential();
      const client = new CosmosClient({
        endpoint,
        aadCredentials: credential,
      });

      const database = client.database(databaseId);
      this.casesContainer = database.container(containerId);
      this.cosmosInitialized = true;
      return this.casesContainer;
    } catch (error) {
      console.error('Failed to initialize Cosmos client:', error);
      this.cosmosInitialized = true;
      return null;
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
      // Query cases by userId within the tenant partition
      const querySpec = {
        query: `
          SELECT c.id, c.caseId, c.status, c.fileName, c.createdAt, c.updatedAt,
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
        caseId: doc.caseId,
        fileName: doc.fileName || 'Unknown file',
        status: doc.status,
        statusDisplay: this.getStatusDisplay(doc.status),
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
        zohoOrderNumber: doc.zohoOrderNumber,
        customerName: doc.zohoCustomerName,
      }));
    } catch (error) {
      console.error('Failed to query cases:', error);
      return [];
    }
  }

  /**
   * Get human-readable status display
   */
  private getStatusDisplay(status: string): string {
    const statusMap: Record<string, string> = {
      storing_file: '📥 Uploading',
      parsing: '🔍 Analyzing',
      running_committee: '🤖 AI Review',
      awaiting_corrections: '✏️ Needs Corrections',
      resolving_customer: '👤 Matching Customer',
      awaiting_customer_selection: '👤 Select Customer',
      resolving_items: '📦 Matching Items',
      awaiting_item_selection: '📦 Select Items',
      awaiting_approval: '⏳ Ready for Approval',
      creating_zoho_draft: '📝 Creating Order',
      queued_for_zoho: '⏳ Queued',
      completed: '✅ Completed',
      cancelled: '❌ Cancelled',
      failed: '⚠️ Failed',
    };
    return statusMap[status] || status;
  }

  /**
   * Create a new case record
   */
  async createCase(metadata: Omit<CaseMetadata, 'caseId'>): Promise<CaseMetadata> {
    const caseId = uuidv4();

    const caseData: CaseMetadata = {
      ...metadata,
      caseId,
    };

    // In a real implementation, this would store to Cosmos DB
    // For now, we just return the metadata
    return caseData;
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
   * Get case status
   */
  async getCaseStatus(caseId: string): Promise<ProcessingStatus | null> {
    // In a real implementation, this would query Cosmos DB
    // For now, return null to indicate not found
    return null;
  }

  /**
   * Update case with user corrections
   */
  async submitCorrections(
    caseId: string,
    corrections: any,
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
}
