/**
 * Persistence Layer Exports
 *
 * Provides Cosmos DB persistence for Zoho integration components.
 */

export { ZohoCosmosClient, type CosmosConfig, type CosmosContainers } from './cosmos-client.js';
export { FingerprintStore, type FingerprintStoreConfig } from './fingerprint-store.js';
export { CosmosRetryQueue, type CosmosRetryQueueConfig } from './cosmos-retry-queue.js';
export { CosmosOutbox, type CosmosOutboxConfig } from './cosmos-outbox.js';
export {
  initializeZohoPersistence,
  tryInitializeZohoPersistence,
  type ZohoPersistenceConfig,
  type ZohoPersistenceStores,
} from './factory.js';
