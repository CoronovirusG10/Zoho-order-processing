/**
 * Blob Audit Store
 *
 * Stores Zoho API audit logs and failed payloads in Azure Blob Storage.
 * Provides 5+ year retention for compliance and debugging.
 */

import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { ZohoAuditLog, ZohoSalesOrderPayload } from '../types.js';

export interface BlobAuditStoreConfig {
  storageAccountUrl: string;
  auditContainer?: string;
  payloadContainer?: string;
}

export interface SpreadsheetPriceAudit {
  case_id: string;
  correlation_id?: string;
  timestamp: string;
  customer: {
    spreadsheet_name: string;
    zoho_customer_id: string;
    zoho_customer_name: string;
  };
  line_items: Array<{
    row: number;
    sku: string | null;
    gtin: string | null;
    product_name: string | null;
    quantity: number;
    spreadsheet_price: number | null;
    zoho_item_id: string;
    zoho_item_name: string;
    zoho_rate: number;
    price_difference: number | null;
  }>;
  totals: {
    spreadsheet_total: number | null;
    zoho_total: number;
    difference: number | null;
  };
}

export class BlobAuditStore {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly auditContainer: ContainerClient;
  private readonly payloadContainer: ContainerClient;
  private initialized = false;

  constructor(config: BlobAuditStoreConfig) {
    const credential = new DefaultAzureCredential();
    this.blobServiceClient = new BlobServiceClient(config.storageAccountUrl, credential);

    this.auditContainer = this.blobServiceClient.getContainerClient(
      config.auditContainer || 'zoho-audit-logs'
    );
    this.payloadContainer = this.blobServiceClient.getContainerClient(
      config.payloadContainer || 'zoho-payloads'
    );
  }

  /**
   * Initialize containers (create if not exist)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.auditContainer.createIfNotExists(),
      this.payloadContainer.createIfNotExists(),
    ]);

    this.initialized = true;
    console.log('[BlobAuditStore] Initialized containers');
  }

  /**
   * Store an audit log entry
   * Path: {year}/{month}/{day}/{correlation_id}/{timestamp}_{operation}.json
   */
  async storeAuditLog(log: ZohoAuditLog): Promise<string> {
    await this.initialize();

    const date = new Date(log.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = date.toISOString().replace(/[:.]/g, '-');

    const blobPath = `${year}/${month}/${day}/${log.correlation_id || 'no-correlation'}/${timestamp}_${log.operation}.json`;

    const blockBlob = this.auditContainer.getBlockBlobClient(blobPath);

    // CRITICAL: Never log sensitive data in audit logs
    const sanitizedLog = this.sanitizeAuditLog(log);

    await blockBlob.upload(
      JSON.stringify(sanitizedLog, null, 2),
      Buffer.byteLength(JSON.stringify(sanitizedLog, null, 2)),
      {
        blobHTTPHeaders: {
          blobContentType: 'application/json',
        },
        metadata: {
          correlation_id: log.correlation_id || '',
          case_id: log.case_id || '',
          operation: log.operation,
        },
      }
    );

    console.log(`[BlobAuditStore] Stored audit log: ${blobPath}`);
    return blobPath;
  }

  /**
   * Store spreadsheet price audit (for compliance)
   * Preserves original spreadsheet prices even though Zoho rates are used
   */
  async storeSpreadsheetPriceAudit(audit: SpreadsheetPriceAudit): Promise<string> {
    await this.initialize();

    const date = new Date(audit.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const blobPath = `price-audit/${year}/${month}/${day}/${audit.case_id}.json`;

    const blockBlob = this.payloadContainer.getBlockBlobClient(blobPath);

    await blockBlob.upload(
      JSON.stringify(audit, null, 2),
      Buffer.byteLength(JSON.stringify(audit, null, 2)),
      {
        blobHTTPHeaders: {
          blobContentType: 'application/json',
        },
        metadata: {
          case_id: audit.case_id,
          correlation_id: audit.correlation_id || '',
        },
      }
    );

    console.log(`[BlobAuditStore] Stored price audit: ${blobPath}`);
    return blobPath;
  }

  /**
   * Store a failed payload for later retry
   * Path: failed-payloads/{year}/{month}/{day}/{case_id}_{timestamp}.json
   */
  async storeFailedPayload(
    caseId: string,
    payload: ZohoSalesOrderPayload,
    error: Error,
    correlationId?: string
  ): Promise<string> {
    await this.initialize();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const blobPath = `failed-payloads/${year}/${month}/${day}/${caseId}_${timestamp}.json`;

    const document = {
      case_id: caseId,
      correlation_id: correlationId,
      timestamp: now.toISOString(),
      payload,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };

    const blockBlob = this.payloadContainer.getBlockBlobClient(blobPath);

    await blockBlob.upload(
      JSON.stringify(document, null, 2),
      Buffer.byteLength(JSON.stringify(document, null, 2)),
      {
        blobHTTPHeaders: {
          blobContentType: 'application/json',
        },
        metadata: {
          case_id: caseId,
          correlation_id: correlationId || '',
          error_type: error.name,
        },
      }
    );

    console.log(`[BlobAuditStore] Stored failed payload: ${blobPath}`);
    return blobPath;
  }

  /**
   * Retrieve an audit log by path
   */
  async getAuditLog(blobPath: string): Promise<ZohoAuditLog | null> {
    try {
      const blockBlob = this.auditContainer.getBlockBlobClient(blobPath);
      const downloadResponse = await blockBlob.download();

      const content = await this.streamToString(downloadResponse.readableStreamBody!);
      return JSON.parse(content) as ZohoAuditLog;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List audit logs for a correlation ID
   */
  async listAuditLogsForCorrelation(correlationId: string, date: Date): Promise<string[]> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const prefix = `${year}/${month}/${day}/${correlationId}/`;
    const paths: string[] = [];

    for await (const blob of this.auditContainer.listBlobsFlat({ prefix })) {
      paths.push(blob.name);
    }

    return paths;
  }

  /**
   * List audit logs for a case
   */
  async listAuditLogsForCase(caseId: string, startDate: Date, endDate: Date): Promise<string[]> {
    const paths: string[] = [];

    // Iterate through each day in the range
    const current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const prefix = `${year}/${month}/${day}/`;

      for await (const blob of this.auditContainer.listBlobsFlat({ prefix })) {
        // Check metadata for case_id
        const blockBlob = this.auditContainer.getBlockBlobClient(blob.name);
        const props = await blockBlob.getProperties();

        if (props.metadata?.case_id === caseId) {
          paths.push(blob.name);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return paths;
  }

  /**
   * Sanitize audit log to remove sensitive data
   */
  private sanitizeAuditLog(log: ZohoAuditLog): ZohoAuditLog {
    const sanitized = { ...log };

    // Remove Authorization header if present
    if (sanitized.request?.headers) {
      const headers = { ...sanitized.request.headers };
      delete headers['Authorization'];
      delete headers['authorization'];
      sanitized.request = { ...sanitized.request, headers };
    }

    return sanitized;
  }

  /**
   * Convert readable stream to string
   */
  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf-8');
  }
}
