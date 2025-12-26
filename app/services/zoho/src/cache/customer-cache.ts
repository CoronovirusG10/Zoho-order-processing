/**
 * Customer Cache
 *
 * In-memory and Cosmos DB cache for Zoho customers.
 * Provides fast lookups when Zoho API is slow or unavailable.
 */

import NodeCache from 'node-cache';
import { CachedCustomer } from '../types.js';
import { ZohoCustomersApi } from '../api/customers.js';

export interface CustomerCacheOptions {
  ttlSeconds?: number; // Default: 3600 (1 hour)
  checkPeriodSeconds?: number; // Default: 600 (10 minutes)
}

export class CustomerCache {
  private readonly memoryCache: NodeCache;
  private readonly customersApi: ZohoCustomersApi;
  private readonly cacheKey = 'all_customers';

  constructor(
    customersApi: ZohoCustomersApi,
    options: CustomerCacheOptions = {}
  ) {
    this.customersApi = customersApi;

    this.memoryCache = new NodeCache({
      stdTTL: options.ttlSeconds || 3600,
      checkperiod: options.checkPeriodSeconds || 600,
      useClones: false, // Better performance, but be careful with mutations
    });
  }

  /**
   * Get all customers from cache, refreshing if necessary
   */
  async getCustomers(forceRefresh: boolean = false): Promise<CachedCustomer[]> {
    if (!forceRefresh) {
      const cached = this.memoryCache.get<CachedCustomer[]>(this.cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Cache miss or forced refresh - fetch from Zoho
    const customers = await this.refreshCache();
    return customers;
  }

  /**
   * Refresh the cache from Zoho API
   */
  async refreshCache(): Promise<CachedCustomer[]> {
    try {
      const zohoCustomers = await this.customersApi.listCustomers({
        status: 'active',
        perPage: 200,
      });

      const cached: CachedCustomer[] = zohoCustomers.map((customer) => ({
        zoho_customer_id: customer.contact_id,
        display_name: customer.contact_name,
        company_name: customer.company_name,
        contact_type: customer.contact_type,
        status: customer.status,
        email: customer.email,
        phone: customer.phone,
        last_cached_at: new Date().toISOString(),
      }));

      this.memoryCache.set(this.cacheKey, cached);

      console.log(`[CustomerCache] Refreshed ${cached.length} customers`);

      return cached;
    } catch (error) {
      console.error('[CustomerCache] Failed to refresh:', error);

      // Try to return stale cache if available
      const stale = this.memoryCache.get<CachedCustomer[]>(this.cacheKey);
      if (stale) {
        console.warn('[CustomerCache] Returning stale cache due to refresh failure');
        return stale;
      }

      throw error;
    }
  }

  /**
   * Find a customer by ID in the cache
   */
  async findById(customerId: string): Promise<CachedCustomer | null> {
    const customers = await this.getCustomers();
    return customers.find((c) => c.zoho_customer_id === customerId) || null;
  }

  /**
   * Search customers by name
   */
  async searchByName(name: string): Promise<CachedCustomer[]> {
    const customers = await this.getCustomers();
    const lowerName = name.toLowerCase();

    return customers.filter(
      (c) =>
        c.display_name.toLowerCase().includes(lowerName) ||
        c.company_name.toLowerCase().includes(lowerName)
    );
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
