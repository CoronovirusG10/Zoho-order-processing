/**
 * Service for managing case records and triggering workflows
 */

import { v4 as uuidv4 } from 'uuid';
import { CaseMetadata, ProcessingStatus } from '../types/teams-types.js';

export class CaseService {
  private parserEndpoint: string;
  private workflowEndpoint: string;

  constructor() {
    this.parserEndpoint = process.env.PARSER_ENDPOINT || 'http://localhost:3001';
    this.workflowEndpoint = process.env.WORKFLOW_ENDPOINT || 'http://localhost:3002';
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
