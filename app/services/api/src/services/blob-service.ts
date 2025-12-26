import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Service for Azure Blob Storage operations
 */
export class BlobService {
  private blobServiceClient: BlobServiceClient;

  constructor(private storageAccountUrl: string) {
    const credential = new DefaultAzureCredential();
    this.blobServiceClient = new BlobServiceClient(
      storageAccountUrl,
      credential
    );
  }

  /**
   * Generate a SAS URL for blob download
   */
  async generateDownloadSasUrl(
    containerName: string,
    blobName: string,
    expiryMinutes: number = 60
  ): Promise<{ sasUrl: string; expiresAt: string }> {
    const containerClient =
      this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error('Blob not found');
    }

    // Calculate expiry time
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

    // In production, use generateSasUrl with BlobSASPermissions.Read
    // For now, return the blob URL
    const sasUrl = blobClient.url;

    return {
      sasUrl,
      expiresAt: expiresOn.toISOString(),
    };
  }

  /**
   * Check if blob exists
   */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient =
      this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    return await blobClient.exists();
  }

  /**
   * Get blob metadata
   */
  async getBlobMetadata(
    containerName: string,
    blobName: string
  ): Promise<Record<string, string>> {
    const containerClient =
      this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const properties = await blobClient.getProperties();
    return properties.metadata || {};
  }
}
