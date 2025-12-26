/**
 * Blob Layout Manager
 *
 * Manages the blob storage layout for 5+ year audit retention:
 * - orders-incoming/{caseId}/original.xlsx
 * - orders-audit/{caseId}/bundle.json
 * - logs-archive/{date}/events.jsonl
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlobHTTPHeaders,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, BlobContainer, BlobPath, StorageTier } from './types.js';

/**
 * Content type mappings for common file extensions
 */
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.json': 'application/json',
  '.jsonl': 'application/x-ndjson',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/**
 * Blob layout manager for structured storage paths
 */
export class BlobLayoutManager {
  private blobServiceClient: BlobServiceClient;
  private containerClients: Map<BlobContainer, ContainerClient> = new Map();

  constructor(private storageAccountUrl: string) {
    const credential = new DefaultAzureCredential();
    this.blobServiceClient = new BlobServiceClient(
      storageAccountUrl,
      credential
    );
  }

  /**
   * Get or create a container client
   */
  private async getContainerClient(
    container: BlobContainer
  ): Promise<ContainerClient> {
    let client = this.containerClients.get(container);

    if (!client) {
      client = this.blobServiceClient.getContainerClient(container);

      // Ensure container exists
      await client.createIfNotExists();
      this.containerClients.set(container, client);
    }

    return client;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
    return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
  }

  // ==========================================
  // ORDERS-INCOMING CONTAINER
  // ==========================================

  /**
   * Get path for original uploaded file
   * Layout: orders-incoming/{caseId}/original.xlsx
   */
  getOriginalFilePath(caseId: string, filename: string): BlobPath {
    const ext = filename.match(/\.[^.]*$/)?.[0] || '.xlsx';
    return {
      container: BlobContainer.OrdersIncoming,
      path: `${caseId}/original${ext}`,
    };
  }

  /**
   * Store the original uploaded file
   */
  async storeOriginalFile(
    caseId: string,
    filename: string,
    content: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ blobPath: BlobPath; sha256: string; sizeBytes: number }> {
    const blobPath = this.getOriginalFilePath(caseId, filename);
    const containerClient = await this.getContainerClient(blobPath.container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath.path);

    // Calculate SHA-256 hash
    const sha256 = createHash('sha256').update(content).digest('hex');

    // Set headers and metadata
    const headers: BlobHTTPHeaders = {
      blobContentType: this.getContentType(filename),
    };

    const fullMetadata = {
      ...metadata,
      caseId,
      originalFilename: filename,
      sha256,
      uploadedAt: new Date().toISOString(),
    };

    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: headers,
      metadata: fullMetadata,
    });

    return {
      blobPath,
      sha256,
      sizeBytes: content.length,
    };
  }

  /**
   * Download the original file
   */
  async downloadOriginalFile(
    caseId: string,
    filename: string
  ): Promise<Buffer> {
    const blobPath = this.getOriginalFilePath(caseId, filename);
    const containerClient = await this.getContainerClient(blobPath.container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath.path);

    const downloadResponse = await blockBlobClient.download(0);
    const chunks: Buffer[] = [];

    for await (const chunk of downloadResponse.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  // ==========================================
  // ORDERS-AUDIT CONTAINER
  // ==========================================

  /**
   * Get path for audit bundle
   * Layout: orders-audit/{caseId}/bundle.json
   */
  getAuditBundlePath(caseId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/bundle.json`,
    };
  }

  /**
   * Get path for canonical JSON
   * Layout: orders-audit/{caseId}/canonical.json
   */
  getCanonicalJsonPath(caseId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/canonical.json`,
    };
  }

  /**
   * Get path for committee model output
   * Layout: orders-audit/{caseId}/committee/{modelId}/output.json
   */
  getCommitteeOutputPath(caseId: string, modelId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/committee/${modelId}/output.json`,
    };
  }

  /**
   * Get path for committee prompt
   * Layout: orders-audit/{caseId}/committee/{modelId}/prompt.json
   */
  getCommitteePromptPath(caseId: string, modelId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/committee/${modelId}/prompt.json`,
    };
  }

  /**
   * Get path for user correction patch
   * Layout: orders-audit/{caseId}/corrections/{timestamp}-{uuid}.json
   */
  getCorrectionPatchPath(caseId: string): BlobPath {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = uuidv4().slice(0, 8);
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/corrections/${timestamp}-${uuid}.json`,
    };
  }

  /**
   * Get path for Zoho request payload
   * Layout: orders-audit/{caseId}/zoho/request.json
   */
  getZohoRequestPath(caseId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/zoho/request.json`,
    };
  }

  /**
   * Get path for Zoho response payload
   * Layout: orders-audit/{caseId}/zoho/response.json
   */
  getZohoResponsePath(caseId: string): BlobPath {
    return {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/zoho/response.json`,
    };
  }

  /**
   * Store JSON artifact in audit container
   */
  async storeAuditArtifact(
    blobPath: BlobPath,
    content: unknown,
    metadata?: Record<string, string>
  ): Promise<{ sha256: string }> {
    const containerClient = await this.getContainerClient(blobPath.container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath.path);

    const jsonContent = JSON.stringify(content, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const headers: BlobHTTPHeaders = {
      blobContentType: 'application/json',
    };

    const fullMetadata = {
      ...metadata,
      sha256,
      storedAt: new Date().toISOString(),
    };

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: headers,
      metadata: fullMetadata,
    });

    return { sha256 };
  }

  /**
   * Read JSON artifact from audit container
   */
  async readAuditArtifact<T>(blobPath: BlobPath): Promise<T> {
    const containerClient = await this.getContainerClient(blobPath.container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath.path);

    const downloadResponse = await blockBlobClient.download(0);
    const chunks: Buffer[] = [];

    for await (const chunk of downloadResponse.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    return JSON.parse(buffer.toString('utf-8'));
  }

  // ==========================================
  // LOGS-ARCHIVE CONTAINER
  // ==========================================

  /**
   * Get path for daily event log
   * Layout: logs-archive/{date}/events.jsonl
   */
  getEventLogPath(date?: Date): BlobPath {
    const d = date || new Date();
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    return {
      container: BlobContainer.LogsArchive,
      path: `${dateStr}/events.jsonl`,
    };
  }

  /**
   * Get path for hourly event log (for high-volume scenarios)
   * Layout: logs-archive/{date}/{hour}/events.jsonl
   */
  getHourlyEventLogPath(date?: Date): BlobPath {
    const d = date || new Date();
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const hour = d.getUTCHours().toString().padStart(2, '0');
    return {
      container: BlobContainer.LogsArchive,
      path: `${dateStr}/${hour}/events.jsonl`,
    };
  }

  /**
   * Append event to JSONL log (uses append blob for true append-only)
   */
  async appendToEventLog(
    event: AuditEvent | Record<string, unknown>,
    useHourly: boolean = false
  ): Promise<void> {
    const blobPath = useHourly
      ? this.getHourlyEventLogPath()
      : this.getEventLogPath();
    const containerClient = await this.getContainerClient(blobPath.container);
    const appendBlobClient = containerClient.getAppendBlobClient(blobPath.path);

    // Create append blob if it doesn't exist
    try {
      await appendBlobClient.createIfNotExists({
        blobHTTPHeaders: {
          blobContentType: 'application/x-ndjson',
        },
      });
    } catch {
      // Blob may already exist, continue
    }

    // Append the event as a JSONL line
    const line = JSON.stringify(event) + '\n';
    const buffer = Buffer.from(line, 'utf-8');

    await appendBlobClient.appendBlock(buffer, buffer.length);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check if a blob exists
   */
  async blobExists(blobPath: BlobPath): Promise<boolean> {
    const containerClient = await this.getContainerClient(blobPath.container);
    const blobClient = containerClient.getBlobClient(blobPath.path);
    return await blobClient.exists();
  }

  /**
   * Get blob metadata
   */
  async getBlobMetadata(
    blobPath: BlobPath
  ): Promise<Record<string, string | undefined>> {
    const containerClient = await this.getContainerClient(blobPath.container);
    const blobClient = containerClient.getBlobClient(blobPath.path);
    const properties = await blobClient.getProperties();
    return properties.metadata || {};
  }

  /**
   * Set blob tier (for lifecycle management)
   */
  async setBlobTier(blobPath: BlobPath, tier: StorageTier): Promise<void> {
    const containerClient = await this.getContainerClient(blobPath.container);
    const blobClient = containerClient.getBlobClient(blobPath.path);
    await blobClient.setAccessTier(tier);
  }

  /**
   * List all blobs for a case
   */
  async listCaseBlobs(
    container: BlobContainer,
    caseId: string
  ): Promise<string[]> {
    const containerClient = await this.getContainerClient(container);
    const blobs: string[] = [];

    for await (const blob of containerClient.listBlobsFlat({
      prefix: `${caseId}/`,
    })) {
      blobs.push(blob.name);
    }

    return blobs;
  }

  /**
   * Copy blob to archive tier
   */
  async archiveBlob(blobPath: BlobPath): Promise<void> {
    await this.setBlobTier(blobPath, StorageTier.Archive);
  }

  /**
   * Get full blob URL (without SAS)
   */
  getBlobUrl(blobPath: BlobPath): string {
    return `${this.storageAccountUrl}/${blobPath.container}/${blobPath.path}`;
  }
}
