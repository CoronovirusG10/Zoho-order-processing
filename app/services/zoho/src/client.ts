/**
 * Zoho Client
 *
 * Main orchestrator for Zoho Books integration.
 * Coordinates OAuth, API calls, caching, matching, and retry logic.
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
import {
  ZohoServiceConfig,
  ZohoSalesOrder,
  CustomerMatchResult,
  ItemMatchResult,
  OrderFingerprint,
} from './types.js';

export interface ZohoClientConfig {
  keyVaultUrl: string;
  gtinCustomFieldId?: string;
  externalOrderKeyFieldId?: string;
  cacheRefreshIntervalMs?: number;
  maxRetries?: number;
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
  private readonly retryQueue: RetryQueue;
  private readonly outbox: Outbox;
  private readonly fingerprints: Map<string, OrderFingerprint>;

  constructor(config: ZohoClientConfig) {
    // Initialize OAuth
    this.oauth = new ZohoOAuthManager({
      keyVaultUrl: config.keyVaultUrl,
    });

    // Initialize API clients
    this.customersApi = new ZohoCustomersApi(this.oauth);
    this.itemsApi = new ZohoItemsApi(this.oauth, config.gtinCustomFieldId);
    this.salesOrdersApi = new ZohoSalesOrdersApi(this.oauth);

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

    // Initialize retry queue and outbox
    this.retryQueue = new RetryQueue({
      maxRetries: config.maxRetries || 5,
    });
    this.outbox = new Outbox();

    // Initialize fingerprint store (should be Cosmos DB in production)
    this.fingerprints = new Map();
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
      const existing = this.fingerprints.get(fingerprint);
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

      // Step 5: Store fingerprint
      const fingerprintEntry: OrderFingerprint = {
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
      };

      this.fingerprints.set(fingerprint, fingerprintEntry);

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
    const readyItems = this.retryQueue.getReadyItems();

    console.log(`[ZohoClient] Processing ${readyItems.length} retry queue items`);

    for (const item of readyItems) {
      this.retryQueue.markInProgress(item.id);

      try {
        const salesOrder = await this.salesOrdersApi.createDraftSalesOrder(
          item.payload,
          {
            caseId: item.case_id,
          }
        );

        await this.retryQueue.markSucceeded(
          item.id,
          salesOrder.salesorder_id,
          salesOrder.salesorder_number
        );

        // Update fingerprint
        const fingerprintEntry = this.fingerprints.get(item.fingerprint);
        if (fingerprintEntry) {
          fingerprintEntry.zoho_salesorder_id = salesOrder.salesorder_id;
          fingerprintEntry.zoho_salesorder_number = salesOrder.salesorder_number;
          fingerprintEntry.status = 'created';
        }

        // Create success event
        await this.outbox.createSalesOrderCreatedEvent(
          item.case_id,
          salesOrder.salesorder_id,
          salesOrder.salesorder_number
        );
      } catch (error) {
        await this.retryQueue.markFailed(item.id, error as Error);

        if (item.attempt_count >= item.max_retries) {
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
  getStats() {
    return {
      retry_queue: this.retryQueue.getStats(),
      customer_cache: this.customerCache.getStats(),
      item_cache: this.itemCache.getStats(),
      fingerprints_count: this.fingerprints.size,
      cache_refresh_running: this.cacheRefreshService.isRunning(),
    };
  }
}
