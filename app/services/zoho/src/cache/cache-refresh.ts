/**
 * Cache Refresh Service
 *
 * Background service that periodically refreshes customer and item caches.
 * Ensures cache is always reasonably fresh even when Zoho API is slow.
 */

import { CustomerCache } from './customer-cache.js';
import { ItemCache } from './item-cache.js';
import { CacheRefreshResult } from '../types.js';

export interface CacheRefreshConfig {
  refreshIntervalMs?: number; // Default: 3600000 (1 hour)
  autoStart?: boolean; // Default: false
}

export class CacheRefreshService {
  private readonly customerCache: CustomerCache;
  private readonly itemCache: ItemCache;
  private readonly config: Required<CacheRefreshConfig>;
  private intervalId: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor(
    customerCache: CustomerCache,
    itemCache: ItemCache,
    config: CacheRefreshConfig = {}
  ) {
    this.customerCache = customerCache;
    this.itemCache = itemCache;

    this.config = {
      refreshIntervalMs: config.refreshIntervalMs || 3600000,
      autoStart: config.autoStart ?? false,
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the background refresh service
   */
  start(): void {
    if (this.intervalId) {
      console.warn('[CacheRefresh] Service already running');
      return;
    }

    console.log(
      `[CacheRefresh] Starting with interval ${this.config.refreshIntervalMs}ms`
    );

    // Run immediately on start
    this.refresh().catch((error) => {
      console.error('[CacheRefresh] Initial refresh failed:', error);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.refresh().catch((error) => {
        console.error('[CacheRefresh] Periodic refresh failed:', error);
      });
    }, this.config.refreshIntervalMs);
  }

  /**
   * Stop the background refresh service
   */
  stop(): void {
    if (!this.intervalId) {
      console.warn('[CacheRefresh] Service not running');
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;

    console.log('[CacheRefresh] Stopped');
  }

  /**
   * Manually trigger a cache refresh
   */
  async refresh(): Promise<CacheRefreshResult> {
    if (this.isRefreshing) {
      console.warn('[CacheRefresh] Refresh already in progress, skipping');
      return {
        success: false,
        customers_updated: 0,
        items_updated: 0,
        errors: ['Refresh already in progress'],
        last_refresh_at: new Date().toISOString(),
      };
    }

    this.isRefreshing = true;

    const errors: string[] = [];
    let customersUpdated = 0;
    let itemsUpdated = 0;

    try {
      // Refresh customers
      try {
        const customers = await this.customerCache.refreshCache();
        customersUpdated = customers.length;
        console.log(`[CacheRefresh] Updated ${customersUpdated} customers`);
      } catch (error) {
        const message = `Failed to refresh customers: ${(error as Error).message}`;
        errors.push(message);
        console.error('[CacheRefresh]', message);
      }

      // Refresh items
      try {
        const items = await this.itemCache.refreshCache();
        itemsUpdated = items.length;
        console.log(`[CacheRefresh] Updated ${itemsUpdated} items`);
      } catch (error) {
        const message = `Failed to refresh items: ${(error as Error).message}`;
        errors.push(message);
        console.error('[CacheRefresh]', message);
      }

      return {
        success: errors.length === 0,
        customers_updated: customersUpdated,
        items_updated: itemsUpdated,
        errors,
        last_refresh_at: new Date().toISOString(),
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Check if refresh is currently running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the current refresh interval
   */
  getRefreshInterval(): number {
    return this.config.refreshIntervalMs;
  }
}
