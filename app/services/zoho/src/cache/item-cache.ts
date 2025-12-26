/**
 * Item Cache
 *
 * In-memory and Cosmos DB cache for Zoho items.
 * Includes GTIN extraction from custom fields.
 */

import NodeCache from 'node-cache';
import { CachedItem } from '../types.js';
import { ZohoItemsApi } from '../api/items.js';

export interface ItemCacheOptions {
  ttlSeconds?: number; // Default: 3600 (1 hour)
  checkPeriodSeconds?: number; // Default: 600 (10 minutes)
}

export class ItemCache {
  private readonly memoryCache: NodeCache;
  private readonly itemsApi: ZohoItemsApi;
  private readonly cacheKey = 'all_items';

  constructor(itemsApi: ZohoItemsApi, options: ItemCacheOptions = {}) {
    this.itemsApi = itemsApi;

    this.memoryCache = new NodeCache({
      stdTTL: options.ttlSeconds || 3600,
      checkperiod: options.checkPeriodSeconds || 600,
      useClones: false,
    });
  }

  /**
   * Get all items from cache, refreshing if necessary
   */
  async getItems(forceRefresh: boolean = false): Promise<CachedItem[]> {
    if (!forceRefresh) {
      const cached = this.memoryCache.get<CachedItem[]>(this.cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Cache miss or forced refresh - fetch from Zoho
    const items = await this.refreshCache();
    return items;
  }

  /**
   * Refresh the cache from Zoho API
   */
  async refreshCache(): Promise<CachedItem[]> {
    try {
      const zohoItems = await this.itemsApi.listItems({
        status: 'active',
        perPage: 200,
      });

      const cached: CachedItem[] = zohoItems.map((item) => ({
        zoho_item_id: item.item_id,
        name: item.name,
        sku: item.sku || null,
        gtin: this.itemsApi.getGtinFromItem(item),
        rate: item.rate,
        unit: item.unit,
        status: item.status,
        description: item.description,
        last_cached_at: new Date().toISOString(),
      }));

      this.memoryCache.set(this.cacheKey, cached);

      console.log(`[ItemCache] Refreshed ${cached.length} items`);

      return cached;
    } catch (error) {
      console.error('[ItemCache] Failed to refresh:', error);

      // Try to return stale cache if available
      const stale = this.memoryCache.get<CachedItem[]>(this.cacheKey);
      if (stale) {
        console.warn('[ItemCache] Returning stale cache due to refresh failure');
        return stale;
      }

      throw error;
    }
  }

  /**
   * Find an item by ID in the cache
   */
  async findById(itemId: string): Promise<CachedItem | null> {
    const items = await this.getItems();
    return items.find((i) => i.zoho_item_id === itemId) || null;
  }

  /**
   * Find items by SKU
   */
  async findBySku(sku: string): Promise<CachedItem[]> {
    const items = await this.getItems();
    const normalizedSku = sku.trim().toUpperCase();

    return items.filter(
      (i) => i.sku && i.sku.trim().toUpperCase() === normalizedSku
    );
  }

  /**
   * Find items by GTIN
   */
  async findByGtin(gtin: string): Promise<CachedItem[]> {
    const items = await this.getItems();
    const normalizedGtin = gtin.replace(/[\s\-]/g, '');

    return items.filter(
      (i) => i.gtin && i.gtin.replace(/[\s\-]/g, '') === normalizedGtin
    );
  }

  /**
   * Search items by name
   */
  async searchByName(name: string): Promise<CachedItem[]> {
    const items = await this.getItems();
    const lowerName = name.toLowerCase();

    return items.filter((i) => i.name.toLowerCase().includes(lowerName));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      keys: this.memoryCache.keys(),
      stats: this.memoryCache.getStats(),
    };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.memoryCache.flushAll();
  }
}
