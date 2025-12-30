/**
 * Zoho Client
 *
 * Main orchestrator for Zoho Books integration.
 * Coordinates OAuth, API calls, caching, matching, and retry logic.
 *
 * Supports optional Cosmos DB persistence for:
 * - Retry queue: Failed API calls that should be retried
 * - Fingerprint store: Order deduplication across restarts
 * - Outbox: Event publishing for notifications
 */

import { ZohoOAuthManager } from './auth/oauth-manager.js';
import { ZohoCustomersApi } from './api/customers.js';
import { ZohoItemsApi } from './api/items.js';
import { ZohoSalesOrdersApi } from './api/sales-orders.js';
import { CustomerCache } from './cache/customer-cache.js';
import { ItemCache } from './cache/item-cache.js';
import { CacheRefreshService } from './cache/cache-refresh.js';
import { CustomerMatcher } from './matching/customer-matcher.js';
import { ItemMatcher } from './matching/item-matcher.js';
import { SalesOrderBuilder, CanonicalSalesOrder } from './payload/sales-order-builder.js';
import { RetryQueue } from './queue/retry-queue.js';
import { Outbox } from './queue/outbox.js';
import { BlobAuditStore } from './storage/blob-audit-store.js';
import {
  ZohoServiceConfig,
  ZohoSalesOrder,
  ZohoSalesOrderPayload,
  CustomerMatchResult,
  ItemMatchResult,
  OrderFingerprint,
  RetryQueueItem,
} from './types.js';

/**
 * Interface for fingerprint store (implemented by in-memory Map or Cosmos FingerprintStore)
 */
export interface IFingerprintStore {
  get(fingerprint: string): Promise<OrderFingerprint | null>;
  create(entry: Omit<OrderFingerprint, 'id'>): Promise<OrderFingerprint>;
  markCreated(fingerprint: string, salesOrderId: string, salesOrderNumber: string): Promise<void>;
  markFailed(fingerprint: string): Promise<void>;
}

/**
 * Interface for retry queue (implemented by in-memory RetryQueue or CosmosRetryQueue)
 */
export interface IRetryQueue {
  enqueue(caseId: string, payload: ZohoSalesOrderPayload, fingerprint: string, error: Error): Promise<string>;
  getReadyItems(limit?: number): Promise<RetryQueueItem[]> | RetryQueueItem[];
  markInProgress(itemId: string, caseId?: string): Promise<void> | void;
  markSucceeded(itemId: string, caseId: string, salesOrderId: string, salesOrderNumber: string): Promise<void>;
  markFailed(itemId: string, caseId: string, error: Error): Promise<boolean | void>;
  getStats(): Promise<{ total: number; by_status: Record<string, number>; ready_for_retry?: number }> | { total: number; by_status: Record<string, number>; ready_for_retry?: number };
}

/**
 * Interface for outbox (implemented by in-memory Outbox or CosmosOutbox)
 */
export interface IOutbox {
  createSalesOrderCreatedEvent(caseId: string, salesOrderId: string, salesOrderNumber: string): Promise<string>;
  createSalesOrderFailedEvent(caseId: string, error: string, attemptCount: number): Promise<string>;
  createRetryExhaustedEvent(caseId: string, attemptCount: number, lastError: string): Promise<string>;
}

/**
 * In-memory adapter for fingerprint store (wraps a Map to match the interface)
 */
class InMemoryFingerprintStore implements IFingerprintStore {
  private readonly store = new Map<string, OrderFingerprint>();

  async get(fingerprint: string): Promise<OrderFingerprint | null> {
    return this.store.get(fingerprint) || null;
  }

  async create(entry: Omit<OrderFingerprint, 'id'>): Promise<OrderFingerprint> {
    const doc = { ...entry } as OrderFingerprint;
    this.store.set(entry.fingerprint, doc);
    return doc;
  }

  async markCreated(fingerprint: string, salesOrderId: string, salesOrderNumber: string): Promise<void> {
    const existing = this.store.get(fingerprint);
    if (existing) {
      existing.zoho_salesorder_id = salesOrderId;
      existing.zoho_salesorder_number = salesOrderNumber;
      existing.status = 'created';
    }
  }

  async markFailed(fingerprint: string): Promise<void> {
    const existing = this.store.get(fingerprint);
    if (existing) {
      existing.status = 'failed';
    }
  }

  getSize(): number {
    return this.store.size;
  }
}

export interface ZohoClientConfig {
  keyVaultUrl: string;
  gtinCustomFieldId?: string;
  externalOrderKeyFieldId?: string;
  cacheRefreshIntervalMs?: number;
  maxRetries?: number;
  // Optional persistence dependencies - falls back to in-memory if not provided
  fingerprintStore?: IFingerprintStore;
  retryQueue?: IRetryQueue;
  outbox?: IOutbox;
  // Optional BlobAuditStore for 5-year compliance logging
  // If provided, all Zoho API calls will be logged to Azure Blob Storage
  auditStore?: BlobAuditStore;
}

export class ZohoClient {
  private readonly oauth: ZohoOAuthManager;
  private readonly customersApi: ZohoCustomersApi;
  private readonly itemsApi: ZohoItemsApi;
  private readonly salesOrdersApi: ZohoSalesOrdersApi;
  private readonly customerCache: CustomerCache;
  private readonly itemCache: ItemCache;
  private readonly cacheRefreshService: CacheRefreshService;
  private readonly customerMatcher: CustomerMatcher;
  private readonly itemMatcher: ItemMatcher;
  private readonly payloadBuilder: SalesOrderBuilder;
  private readonly retryQueue: IRetryQueue;
  private readonly outbox: IOutbox;
  private readonly fingerprintStore: IFingerprintStore;
  private readonly auditStore?: BlobAuditStore;
  // Track if using persistent storage for stats reporting
  private readonly usingPersistentStorage: boolean;
  private readonly usingBlobAuditLogging: boolean;

  constructor(config: ZohoClientConfig) {
    // Initialize OAuth
    this.oauth = new ZohoOAuthManager({
      keyVaultUrl: config.keyVaultUrl,
    });

    // Store audit store reference
    this.auditStore = config.auditStore;
    this.usingBlobAuditLogging = !!config.auditStore;

    if (this.usingBlobAuditLogging) {
      console.log('[ZohoClient] Blob audit logging enabled - all API calls will be persisted');
    } else {
      console.warn('[ZohoClient] Blob audit logging disabled - API calls logged to console only');
    }

    // Initialize API clients with optional audit store
    this.customersApi = new ZohoCustomersApi(this.oauth, config.auditStore);
    this.itemsApi = new ZohoItemsApi(this.oauth, config.gtinCustomFieldId, config.auditStore);
    this.salesOrdersApi = new ZohoSalesOrdersApi(this.oauth, config.auditStore);

    // Initialize caches
    this.customerCache = new CustomerCache(this.customersApi);
    this.itemCache = new ItemCache(this.itemsApi);

    // Initialize cache refresh service
    this.cacheRefreshService = new CacheRefreshService(
      this.customerCache,
      this.itemCache,
      {
        refreshIntervalMs: config.cacheRefreshIntervalMs || 3600000,
        autoStart: false, // Start manually after initialization
      }
    );

    // Initialize matchers
    this.customerMatcher = new CustomerMatcher();
    this.itemMatcher = new ItemMatcher({
      fuzzyNameMatchEnabled: false, // SKU/GTIN only by default
    });

    // Initialize payload builder
    this.payloadBuilder = new SalesOrderBuilder({
      externalOrderKeyFieldId: config.externalOrderKeyFieldId,
    });

    // Initialize retry queue, outbox, and fingerprint store
    // Use injected dependencies if provided, otherwise fall back to in-memory implementations
    if (config.retryQueue && config.outbox && config.fingerprintStore) {
      this.retryQueue = config.retryQueue;
      this.outbox = config.outbox;
      this.fingerprintStore = config.fingerprintStore;
      this.usingPersistentStorage = true;
      console.log('[ZohoClient] Using persistent Cosmos storage for retry queue, outbox, and fingerprints');
    } else {
      // Fall back to in-memory implementations
      this.retryQueue = new RetryQueue({ maxRetries: config.maxRetries || 5 });
      this.outbox = new Outbox();
      this.fingerprintStore = new InMemoryFingerprintStore();
      this.usingPersistentStorage = false;
      console.warn('[ZohoClient] Using in-memory storage - data will be lost on restart');
    }
  }

  /**
   * Initialize the client (load caches, start refresh service)
   */
  async initialize(): Promise<void> {
    console.log('[ZohoClient] Initializing...');

    // Pre-load caches
    await this.customerCache.refreshCache();
    await this.itemCache.refreshCache();

    // Start background cache refresh
    this.cacheRefreshService.start();

    console.log('[ZohoClient] Initialized successfully');
  }

  /**
   * Shutdown the client (stop background services)
   */
  shutdown(): void {
    this.cacheRefreshService.stop();
    console.log('[ZohoClient] Shutdown complete');
  }

  /**
   * Match a customer name to Zoho customer
   */
  async matchCustomer(customerName: string): Promise<CustomerMatchResult> {
    const customers = await this.customerCache.getCustomers();
    return this.customerMatcher.matchCustomer(customerName, customers);
  }

  /**
   * Match an item to Zoho item
   */
  async matchItem(
    sku: string | null,
    gtin: string | null,
    name: string | null
  ): Promise<ItemMatchResult> {
    const items = await this.itemCache.getItems();
    return this.itemMatcher.matchItem(sku, gtin, name, items);
  }

  /**
   * Create a draft sales order with idempotency
   */
  async createDraftSalesOrder(
    order: CanonicalSalesOrder,
    options: {
      correlationId?: string;
      skipFingerprintCheck?: boolean;
    } = {}
  ): Promise<{
    salesorder?: ZohoSalesOrder;
    is_duplicate?: boolean;
    existing_salesorder_id?: string;
    queued?: boolean;
    queue_id?: string;
  }> {
    // Step 1: Check idempotency fingerprint
    const fingerprint = this.payloadBuilder.computeFingerprint(order);

    if (!options.skipFingerprintCheck) {
      const existing = await this.fingerprintStore.get(fingerprint);
      if (existing && existing.zoho_salesorder_id) {
        console.log(
          `[ZohoClient] Duplicate detected, fingerprint ${fingerprint} already exists`
        );
        return {
          is_duplicate: true,
          existing_salesorder_id: existing.zoho_salesorder_id,
        };
      }
    }

    // Step 2: Get item rates from cache
    const itemRates = new Map<string, number>();
    for (const line of order.line_items) {
      if (line.zoho_item_id) {
        const item = await this.itemCache.findById(line.zoho_item_id);
        if (item) {
          itemRates.set(line.zoho_item_id, item.rate);
        }
      }
    }

    // Step 3: Build payload
    const payload = this.payloadBuilder.buildSalesOrderPayload(order, itemRates);

    // Step 4: Try to create sales order
    try {
      const salesOrder = await this.salesOrdersApi.createDraftSalesOrder(payload, {
        correlationId: options.correlationId,
        caseId: order.meta.case_id,
      });

      // Step 5: Store fingerprint (create if doesn't exist, or update if in_flight)
      try {
        const existingFingerprint = await this.fingerprintStore.get(fingerprint);
        if (existingFingerprint) {
          // Update existing fingerprint entry
          await this.fingerprintStore.markCreated(
            fingerprint,
            salesOrder.salesorder_id,
            salesOrder.salesorder_number
          );
        } else {
          // Create new fingerprint entry
          await this.fingerprintStore.create({
            fingerprint,
            case_id: order.meta.case_id,
            file_sha256: order.meta.file_sha256,
            customer_id: order.customer.zoho_customer_id!,
            line_items_hash: this.payloadBuilder.computeFingerprint(order),
            date_bucket: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            zoho_salesorder_id: salesOrder.salesorder_id,
            zoho_salesorder_number: salesOrder.salesorder_number,
            status: 'created',
          });
        }
      } catch (fpError) {
        // Log but don't fail the order creation
        console.error('[ZohoClient] Failed to persist fingerprint:', fpError);
      }

      // Step 6: Create outbox entry for notification
      await this.outbox.createSalesOrderCreatedEvent(
        order.meta.case_id,
        salesOrder.salesorder_id,
        salesOrder.salesorder_number
      );

      return { salesorder: salesOrder };
    } catch (error) {
      console.error('[ZohoClient] Failed to create sales order:', error);

      // Step 7: Queue for retry if it's a transient error
      const queueId = await this.retryQueue.enqueue(
        order.meta.case_id,
        payload,
        fingerprint,
        error as Error
      );

      // Create outbox entry for failure
      await this.outbox.createSalesOrderFailedEvent(
        order.meta.case_id,
        (error as Error).message,
        1
      );

      return {
        queued: true,
        queue_id: queueId,
      };
    }
  }

  /**
   * Process retry queue (background job)
   */
  async processRetryQueue(): Promise<void> {
    const readyItemsResult = this.retryQueue.getReadyItems();
    const readyItems = Array.isArray(readyItemsResult)
      ? readyItemsResult
      : await readyItemsResult;

    console.log(`[ZohoClient] Processing ${readyItems.length} retry queue items`);

    for (const item of readyItems) {
      await this.retryQueue.markInProgress(item.id, item.case_id);

      try {
        const salesOrder = await this.salesOrdersApi.createDraftSalesOrder(
          item.payload,
          {
            caseId: item.case_id,
          }
        );

        await this.retryQueue.markSucceeded(
          item.id,
          item.case_id,
          salesOrder.salesorder_id,
          salesOrder.salesorder_number
        );

        // Update fingerprint in persistent store
        try {
          await this.fingerprintStore.markCreated(
            item.fingerprint,
            salesOrder.salesorder_id,
            salesOrder.salesorder_number
          );
        } catch (fpError) {
          console.error('[ZohoClient] Failed to update fingerprint after retry success:', fpError);
        }

        // Create success event
        await this.outbox.createSalesOrderCreatedEvent(
          item.case_id,
          salesOrder.salesorder_id,
          salesOrder.salesorder_number
        );
      } catch (error) {
        const abandoned = await this.retryQueue.markFailed(item.id, item.case_id, error as Error);

        // Check if this was the final retry (abandoned)
        if (abandoned === true || item.attempt_count >= item.max_retries) {
          await this.outbox.createRetryExhaustedEvent(
            item.case_id,
            item.attempt_count,
            (error as Error).message
          );
        }
      }
    }
  }

  /**
   * Get queue and cache statistics
   */
  async getStats() {
    const retryQueueStatsResult = this.retryQueue.getStats();
    const retryQueueStats =
      retryQueueStatsResult instanceof Promise
        ? await retryQueueStatsResult
        : retryQueueStatsResult;

    // For fingerprint count, we can only get it from in-memory store
    const fingerprintCount =
      this.fingerprintStore instanceof InMemoryFingerprintStore
        ? this.fingerprintStore.getSize()
        : 'persisted'; // Can't easily get count from Cosmos without a query

    return {
      retry_queue: retryQueueStats,
      customer_cache: this.customerCache.getStats(),
      item_cache: this.itemCache.getStats(),
      fingerprints_count: fingerprintCount,
      cache_refresh_running: this.cacheRefreshService.isRunning(),
      using_persistent_storage: this.usingPersistentStorage,
      using_blob_audit_logging: this.usingBlobAuditLogging,
    };
  }

  /**
   * Get the audit store instance (for direct access if needed)
   */
  getAuditStore(): BlobAuditStore | undefined {
    return this.auditStore;
  }
}
