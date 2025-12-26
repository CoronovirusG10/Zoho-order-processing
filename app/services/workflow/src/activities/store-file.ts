/**
 * Store File Activity (Temporal)
 *
 * Downloads the uploaded file from Teams and stores it in Azure Blob Storage
 * for long-term retention (5+ years).
 */

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
}

/**
 * Stores a file from the given URL to Azure Blob Storage
 * @param input - The input containing caseId and blobUrl
 * @returns The stored file path and SHA-256 hash
 */
export async function storeFile(input: StoreFileInput): Promise<StoreFileOutput> {
  const { caseId, blobUrl } = input;

  log.info(`[${caseId}] Storing file from URL: ${blobUrl}`);

  try {
    // TODO: Implement actual file download and storage
    // 1. Download file from Teams blob URL (or Graph API fallback)
    // 2. Calculate SHA-256 hash
    // 3. Store in blob storage: orders-incoming/<caseId>/original.xlsx
    // 4. Store metadata in Cosmos DB case record

    // Mock implementation for now
    const storedPath = `orders-incoming/${caseId}/original.xlsx`;
    const sha256 = 'mock-sha256-hash'; // TODO: Calculate actual hash

    log.info(`[${caseId}] File stored successfully at: ${storedPath}`);

    return {
      success: true,
      storedPath,
      sha256,
    };
  } catch (error) {
    log.error(`[${caseId}] Failed to store file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
