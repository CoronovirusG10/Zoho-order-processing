/**
 * Zoho Books Integration Service
 *
 * Entry point for the Zoho Books integration.
 * Exports all public APIs and types.
 */

// Main client
export {
  ZohoClient,
  type ZohoClientConfig,
  type IFingerprintStore,
  type IRetryQueue,
  type IOutbox,
} from './client.js';

// OAuth
export { ZohoOAuthManager, type OAuthManagerConfig } from './auth/oauth-manager.js';
export { ZohoTokenStore } from './auth/token-store.js';

// API clients
export { ZohoCustomersApi, type ListCustomersOptions } from './api/customers.js';
export { ZohoItemsApi, type ListItemsOptions } from './api/items.js';
export { ZohoSalesOrdersApi, type CreateSalesOrderOptions } from './api/sales-orders.js';

// Caches
export { CustomerCache, type CustomerCacheOptions } from './cache/customer-cache.js';
export { ItemCache, type ItemCacheOptions } from './cache/item-cache.js';
export { CacheRefreshService, type CacheRefreshConfig } from './cache/cache-refresh.js';

// Matchers
export { CustomerMatcher, type CustomerMatchOptions } from './matching/customer-matcher.js';
export { ItemMatcher, type ItemMatchOptions } from './matching/item-matcher.js';
export {
  FuzzyMatcher,
  normalizeString,
  calculateSimilarity,
  type FuzzyMatchResult,
} from './matching/fuzzy-matcher.js';

// Payload builder
export {
  SalesOrderBuilder,
  type SalesOrderBuilderOptions,
  type CanonicalSalesOrder,
  type PriceAuditRecord,
} from './payload/sales-order-builder.js';

// Queue (in-memory for dev)
export { RetryQueue, type RetryQueueConfig } from './queue/retry-queue.js';
export { Outbox, type OutboxConfig } from './queue/outbox.js';

// Persistence (Cosmos DB for production)
export {
  ZohoCosmosClient,
  type CosmosConfig,
  type CosmosContainers,
  FingerprintStore,
  type FingerprintStoreConfig,
  CosmosRetryQueue,
  type CosmosRetryQueueConfig,
  CosmosOutbox,
  type CosmosOutboxConfig,
  initializeZohoPersistence,
  tryInitializeZohoPersistence,
  type ZohoPersistenceConfig,
  type ZohoPersistenceStores,
} from './persistence/index.js';

// Storage (Blob Storage for audit)
export {
  BlobAuditStore,
  type BlobAuditStoreConfig,
  type SpreadsheetPriceAudit,
  // API audit logging types for 5-year compliance
  type ApiAuditLogEntry,
  type LogApiRequestOptions,
  type LogApiResponseOptions,
} from './storage/index.js';

// Types
export type {
  // OAuth
  ZohoOAuthCredentials,
  ZohoAccessToken,
  ZohoTokenRefreshResponse,

  // API
  ZohoApiResponse,
  ZohoErrorResponse,
  ZohoPaginatedResponse,

  // Customers
  ZohoCustomer,
  ZohoCustomerListResponse,

  // Items
  ZohoItem,
  ZohoCustomField,
  ZohoItemListResponse,

  // Sales Orders
  ZohoSalesOrder,
  ZohoLineItem,
  ZohoSalesOrderPayload,
  ZohoSalesOrderCreateResponse,

  // Cache
  CachedCustomer,
  CachedItem,
  CacheRefreshResult,

  // Matching
  CustomerMatchResult,
  ItemMatchResult,
  FuzzyMatchOptions,

  // Queue
  RetryQueueItem,
  OutboxEntry,

  // Idempotency
  OrderFingerprint,

  // Config
  ZohoServiceConfig,
  RateLimitInfo,
  ZohoAuditLog,
} from './types.js';
