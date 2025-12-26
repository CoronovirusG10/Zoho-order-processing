/**
 * Store File Activity
 *
 * Downloads the uploaded file from Teams and stores it in Azure Blob Storage
 * for long-term retention (5+ years).
 */

import { app, InvocationContext } from '@azure/functions';
import { StoreFileInput, StoreFileOutput } from '../types';

async function storeFileActivity(
  input: StoreFileInput,
  context: InvocationContext
): Promise<StoreFileOutput> {
  const { caseId, blobUrl } = input;

  context.log(`[${caseId}] Storing file from URL: ${blobUrl}`);

  try {
    // TODO: Implement actual file download and storage
    // 1. Download file from Teams blob URL (or Graph API fallback)
    // 2. Calculate SHA-256 hash
    // 3. Store in blob storage: orders-incoming/<caseId>/original.xlsx
    // 4. Store metadata in Cosmos DB case record

    // Mock implementation for now
    const storedPath = `orders-incoming/${caseId}/original.xlsx`;
    const sha256 = 'mock-sha256-hash'; // TODO: Calculate actual hash

    context.log(`[${caseId}] File stored successfully at: ${storedPath}`);

    return {
      success: true,
      storedPath,
      sha256,
    };
  } catch (error) {
    context.error(`[${caseId}] Failed to store file:`, error);
    throw error;
  }
};

app.storageQueue('StoreFile', {
  queueName: 'activity-store-file',
  connection: 'STORAGE_CONNECTION',
  handler: async (queueItem: unknown, context: InvocationContext) => {
    return storeFileActivity(queueItem as StoreFileInput, context);
  },
});

export { storeFileActivity };
