/**
 * Zoho Persistence Factory
 *
 * Factory function to create Cosmos-backed persistence stores for the Zoho client.
 * Provides graceful fallback to in-memory storage if Cosmos is unavailable.
 */

import { ZohoCosmosClient, CosmosConfig } from './cosmos-client.js';
import { FingerprintStore } from './fingerprint-store.js';
import { CosmosRetryQueue } from './cosmos-retry-queue.js';
import { CosmosOutbox } from './cosmos-outbox.js';
import { IFingerprintStore, IRetryQueue, IOutbox } from '../client.js';

export interface ZohoPersistenceConfig {
  cosmosEndpoint: string;
  cosmosDatabase?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
}

export interface ZohoPersistenceStores {
  fingerprintStore: IFingerprintStore;
  retryQueue: IRetryQueue;
  outbox: IOutbox;
  cosmosClient: ZohoCosmosClient;
}

/**
 * Initialize Cosmos-backed persistence stores for the Zoho client.
 *
 * @param config - Configuration for Cosmos connection and retry behavior
 * @returns Object containing all persistence stores and the underlying Cosmos client
 * @throws Error if initialization fails
 */
export async function initializeZohoPersistence(
  config: ZohoPersistenceConfig
): Promise<ZohoPersistenceStores> {
  console.log('[ZohoPersistence] Initializing Cosmos-backed persistence stores...');

  // Create the Cosmos client
  const cosmosClient = new ZohoCosmosClient({
    endpoint: config.cosmosEndpoint,
    databaseName: config.cosmosDatabase || 'order-processing',
  });

  // Initialize the database and containers
  await cosmosClient.initialize();

  // Get containers
  const containers = cosmosClient.getContainers();

  // Create the persistence stores
  const fingerprintStore = new FingerprintStore({
    container: containers.fingerprints,
  });

  const retryQueue = new CosmosRetryQueue({
    container: containers.retryQueue,
    maxRetries: config.maxRetries,
    initialRetryDelayMs: config.initialRetryDelayMs,
    maxRetryDelayMs: config.maxRetryDelayMs,
    backoffMultiplier: config.backoffMultiplier,
  });

  const outbox = new CosmosOutbox({
    container: containers.outbox,
  });

  console.log('[ZohoPersistence] Cosmos-backed persistence stores initialized successfully');

  return {
    fingerprintStore,
    retryQueue,
    outbox,
    cosmosClient,
  };
}

/**
 * Try to initialize Cosmos persistence, returning null if it fails.
 * This allows for graceful fallback to in-memory storage.
 *
 * @param config - Configuration for Cosmos connection
 * @returns Persistence stores or null if initialization failed
 */
export async function tryInitializeZohoPersistence(
  config: ZohoPersistenceConfig
): Promise<ZohoPersistenceStores | null> {
  try {
    return await initializeZohoPersistence(config);
  } catch (error) {
    console.warn('[ZohoPersistence] Failed to initialize Cosmos persistence:', error);
    console.warn('[ZohoPersistence] Zoho client will use in-memory storage (data lost on restart)');
    return null;
  }
}
