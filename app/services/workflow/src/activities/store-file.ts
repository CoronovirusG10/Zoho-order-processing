/**
 * Store File Activity (Temporal)
 *
 * Verifies that the uploaded file exists in Azure Blob Storage and calculates
 * its SHA-256 hash for integrity verification.
 *
 * Note: The file is ALREADY stored by the Teams bot FileDownloadService before
 * the workflow starts. This activity verifies the file and calculates hash.
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'crypto';
import { log } from '@temporalio/activity';

// Input/Output interfaces
export interface StoreFileInput {
  caseId: string;
  blobUrl: string;
}

export interface StoreFileOutput {
  success: boolean;
  storedPath: string;
  sha256: string;
  sizeBytes?: number;
}

/**
 * Verifies a file exists in blob storage and calculates its SHA-256 hash
 * @param input - The input containing caseId and blobUrl (already stored by Teams bot)
 * @returns The stored file path, SHA-256 hash, and size
 */
export async function storeFile(input: StoreFileInput): Promise<StoreFileOutput> {
  const { caseId, blobUrl } = input;

  log.info('Verifying stored file', { caseId, blobUrl });

  try {
    // Parse blob URL to get container and blob name
    // URL format: https://<account>.blob.core.windows.net/<container>/<path>
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      throw new Error(`Invalid blob URL format: ${blobUrl}`);
    }

    const containerName = pathParts[0];
    const blobName = pathParts.slice(1).join('/');

    // Initialize blob client
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!accountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME not configured');
    }

    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob not found: ${blobUrl}`);
    }

    // Get blob properties for size
    const properties = await blobClient.getProperties();
    const sizeBytes = properties.contentLength || 0;

    log.info('Blob exists, downloading for hash calculation', {
      caseId,
      blobName,
      sizeBytes,
    });

    // Download and calculate SHA-256
    const downloadResponse = await blobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to get readable stream from blob');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    log.info('File verified successfully', {
      caseId,
      storedPath: blobName,
      sha256,
      sizeBytes,
    });

    return {
      success: true,
      storedPath: blobName,
      sha256,
      sizeBytes,
    };
  } catch (error) {
    log.error('Failed to verify stored file', {
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
