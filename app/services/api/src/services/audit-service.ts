import { CosmosClient, Container } from '@azure/cosmos';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { OrderProcessingEvent } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for audit trail operations
 */
export class AuditService {
  private container: Container;
  private blobServiceClient: BlobServiceClient;

  constructor(
    private cosmosEndpoint: string,
    private databaseId: string,
    private containerId: string,
    private storageAccountUrl: string,
    private auditContainerName: string
  ) {
    const credential = new DefaultAzureCredential();
    const cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      aadCredentials: credential,
    });
    this.container = cosmosClient
      .database(databaseId)
      .container(containerId);

    this.blobServiceClient = new BlobServiceClient(
      storageAccountUrl,
      credential
    );
  }

  /**
   * Log an audit event
   */
  async logEvent(
    event: Omit<OrderProcessingEvent, 'id' | 'sequence' | '_partitionKey'>
  ): Promise<void> {
    // Get next sequence number for this case
    const sequence = await this.getNextSequence(event.caseId, event.tenantId);

    const auditEvent: OrderProcessingEvent = {
      ...event,
      id: uuidv4(),
      sequence,
      _partitionKey: event.caseId,
    };

    await this.container.items.create(auditEvent);

    // Also write to blob storage for long-term retention
    await this.writeEventToBlob(auditEvent);
  }

  /**
   * Get all events for a case
   */
  async getEvents(caseId: string): Promise<OrderProcessingEvent[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId ORDER BY c.sequence ASC',
      parameters: [{ name: '@caseId', value: caseId }],
    };

    const { resources } = await this.container.items
      .query(querySpec)
      .fetchAll();

    return resources as OrderProcessingEvent[];
  }

  /**
   * Generate SAS URL for audit bundle download
   */
  async getAuditBundleSas(
    caseId: string,
    tenantId: string
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(
      this.auditContainerName
    );
    const blobName = `${tenantId}/${caseId}/audit-bundle.zip`;
    const blobClient = containerClient.getBlobClient(blobName);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error('Audit bundle not found');
    }

    // Generate SAS token (1 hour expiry)
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1);

    // In production, use generateSasUrl with proper permissions
    // For now, return the blob URL (assuming RBAC or public access)
    return blobClient.url;
  }

  /**
   * Get next sequence number for case events
   */
  private async getNextSequence(
    caseId: string,
    tenantId: string
  ): Promise<number> {
    const querySpec = {
      query:
        'SELECT VALUE MAX(c.sequence) FROM c WHERE c.caseId = @caseId AND c.tenantId = @tenantId',
      parameters: [
        { name: '@caseId', value: caseId },
        { name: '@tenantId', value: tenantId },
      ],
    };

    const { resources } = await this.container.items
      .query(querySpec)
      .fetchAll();

    const maxSequence = resources[0] || 0;
    return maxSequence + 1;
  }

  /**
   * Write event to blob storage for long-term retention
   */
  private async writeEventToBlob(event: OrderProcessingEvent): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(
        this.auditContainerName
      );
      const blobName = `${event.tenantId}/${event.caseId}/events/${event.timestamp}-${event.eventType}.json`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const content = JSON.stringify(event, null, 2);
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });
    } catch (error) {
      console.error('Failed to write event to blob storage:', error);
      // Don't fail the request if blob write fails
    }
  }
}
