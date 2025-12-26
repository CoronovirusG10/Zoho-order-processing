/**
 * Cosmos DB Client Factory
 *
 * Provides a centralized Cosmos DB client for Zoho integration persistence.
 * Manages containers for fingerprints, retry queue, outbox, and cache.
 */

import { CosmosClient, Database, Container, PartitionKeyDefinition } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

export interface CosmosConfig {
  endpoint: string;
  databaseName: string;
  // Container names with defaults
  fingerprintContainer?: string;
  retryQueueContainer?: string;
  outboxContainer?: string;
  customerCacheContainer?: string;
  itemCacheContainer?: string;
}

export interface CosmosContainers {
  fingerprints: Container;
  retryQueue: Container;
  outbox: Container;
  customerCache: Container;
  itemCache: Container;
}

const DEFAULT_CONTAINERS = {
  fingerprints: 'zoho-fingerprints',
  retryQueue: 'zoho-retry-queue',
  outbox: 'zoho-outbox',
  customerCache: 'zoho-customer-cache',
  itemCache: 'zoho-item-cache',
};

const CONTAINER_CONFIGS: Record<string, { partitionKey: PartitionKeyDefinition; ttlEnabled: boolean }> = {
  fingerprints: {
    partitionKey: { paths: ['/case_id'] },
    ttlEnabled: false, // Keep forever for audit
  },
  retryQueue: {
    partitionKey: { paths: ['/case_id'] },
    ttlEnabled: true, // Auto-delete after processing
  },
  outbox: {
    partitionKey: { paths: ['/case_id'] },
    ttlEnabled: true,
  },
  customerCache: {
    partitionKey: { paths: ['/zoho_customer_id'] },
    ttlEnabled: true, // Cache with TTL
  },
  itemCache: {
    partitionKey: { paths: ['/zoho_item_id'] },
    ttlEnabled: true,
  },
};

export class ZohoCosmosClient {
  private readonly client: CosmosClient;
  private readonly config: Required<CosmosConfig>;
  private database: Database | null = null;
  private containers: CosmosContainers | null = null;

  constructor(config: CosmosConfig) {
    this.config = {
      endpoint: config.endpoint,
      databaseName: config.databaseName,
      fingerprintContainer: config.fingerprintContainer || DEFAULT_CONTAINERS.fingerprints,
      retryQueueContainer: config.retryQueueContainer || DEFAULT_CONTAINERS.retryQueue,
      outboxContainer: config.outboxContainer || DEFAULT_CONTAINERS.outbox,
      customerCacheContainer: config.customerCacheContainer || DEFAULT_CONTAINERS.customerCache,
      itemCacheContainer: config.itemCacheContainer || DEFAULT_CONTAINERS.itemCache,
    };

    // Use Managed Identity for authentication
    const credential = new DefaultAzureCredential();
    this.client = new CosmosClient({
      endpoint: this.config.endpoint,
      aadCredentials: credential,
    });
  }

  /**
   * Initialize database and containers
   * Creates if they don't exist
   */
  async initialize(): Promise<void> {
    console.log('[ZohoCosmos] Initializing database and containers...');

    // Get or create database
    const { database } = await this.client.databases.createIfNotExists({
      id: this.config.databaseName,
    });
    this.database = database;

    // Get or create containers
    const [fingerprints, retryQueue, outbox, customerCache, itemCache] = await Promise.all([
      this.getOrCreateContainer(this.config.fingerprintContainer, 'fingerprints'),
      this.getOrCreateContainer(this.config.retryQueueContainer, 'retryQueue'),
      this.getOrCreateContainer(this.config.outboxContainer, 'outbox'),
      this.getOrCreateContainer(this.config.customerCacheContainer, 'customerCache'),
      this.getOrCreateContainer(this.config.itemCacheContainer, 'itemCache'),
    ]);

    this.containers = {
      fingerprints,
      retryQueue,
      outbox,
      customerCache,
      itemCache,
    };

    console.log('[ZohoCosmos] Initialized successfully');
  }

  /**
   * Get or create a container with appropriate configuration
   */
  private async getOrCreateContainer(
    containerId: string,
    configKey: keyof typeof CONTAINER_CONFIGS
  ): Promise<Container> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const containerConfig = CONTAINER_CONFIGS[configKey];

    const { container } = await this.database.containers.createIfNotExists({
      id: containerId,
      partitionKey: containerConfig.partitionKey,
      defaultTtl: containerConfig.ttlEnabled ? -1 : undefined, // -1 means TTL can be set per item
    });

    return container;
  }

  /**
   * Get all containers
   */
  getContainers(): CosmosContainers {
    if (!this.containers) {
      throw new Error('Cosmos client not initialized. Call initialize() first.');
    }
    return this.containers;
  }

  /**
   * Get fingerprints container
   */
  get fingerprints(): Container {
    return this.getContainers().fingerprints;
  }

  /**
   * Get retry queue container
   */
  get retryQueue(): Container {
    return this.getContainers().retryQueue;
  }

  /**
   * Get outbox container
   */
  get outbox(): Container {
    return this.getContainers().outbox;
  }

  /**
   * Get customer cache container
   */
  get customerCache(): Container {
    return this.getContainers().customerCache;
  }

  /**
   * Get item cache container
   */
  get itemCache(): Container {
    return this.getContainers().itemCache;
  }
}
