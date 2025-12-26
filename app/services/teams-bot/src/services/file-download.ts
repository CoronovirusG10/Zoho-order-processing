/**
 * Service for downloading files from Teams attachments
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TeamsAttachment, BlobUploadResult } from '../types/teams-types.js';

export class FileDownloadService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!accountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME environment variable is required');
    }

    this.containerName = process.env.AZURE_STORAGE_CONTAINER_INCOMING || 'orders-incoming';

    const credential = new DefaultAzureCredential();
    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
  }

  /**
   * Download file from Teams attachment and upload to Azure Blob Storage
   */
  async downloadAndStore(
    attachment: TeamsAttachment,
    caseId: string,
    correlationId: string
  ): Promise<BlobUploadResult> {
    // Get download URL from attachment
    const downloadUrl = this.getDownloadUrl(attachment);
    if (!downloadUrl) {
      throw new Error('No download URL found in attachment');
    }

    // Download file content
    const fileBuffer = await this.downloadFile(downloadUrl);

    // Calculate SHA256 hash
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    // Upload to blob storage
    const blobUri = await this.uploadToBlob(caseId, fileBuffer, attachment.name || 'file.xlsx');

    return {
      blobUri,
      sha256,
      contentType: attachment.contentType,
      size: fileBuffer.length,
    };
  }

  /**
   * Extract download URL from Teams attachment
   */
  private getDownloadUrl(attachment: TeamsAttachment): string | null {
    // Primary path: content.downloadUrl
    if (attachment.content?.downloadUrl) {
      return attachment.content.downloadUrl;
    }

    // Fallback: contentUrl
    if (attachment.contentUrl) {
      return attachment.contentUrl;
    }

    return null;
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'OrderProcessingBot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload file to Azure Blob Storage
   */
  private async uploadToBlob(
    caseId: string,
    fileBuffer: Buffer,
    originalFileName: string
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

    // Ensure container exists
    await containerClient.createIfNotExists();

    // Create blob path: orders-incoming/{caseId}/original.xlsx
    const extension = originalFileName.split('.').pop() || 'xlsx';
    const blobName = `${caseId}/original.${extension}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload with metadata
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      metadata: {
        originalFileName,
        caseId,
        uploadedAt: new Date().toISOString(),
      },
    });

    return blockBlobClient.url;
  }

  /**
   * Download file using Graph API with OBO token (fallback)
   * This is a placeholder for the Graph API fallback mentioned in the design
   */
  async downloadViaGraphApi(
    driveItemId: string,
    accessToken: string,
    caseId: string
  ): Promise<BlobUploadResult> {
    // TODO: Implement Graph API fallback if needed
    // This would use the Microsoft Graph SDK to download the file
    // using an OBO (On-Behalf-Of) token from the user
    throw new Error('Graph API fallback not yet implemented');
  }
}
