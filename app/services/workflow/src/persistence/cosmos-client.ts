/**
 * Workflow Cosmos DB Client
 *
 * Provides a centralized Cosmos DB client for workflow persistence.
 * Manages containers for cases and audit events.
 */

import { CosmosClient, Database, Container, PartitionKeyDefinition } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

export interface WorkflowCosmosConfig {
  endpoint: string;
  databaseName: string;
  casesContainer?: string;
  eventsContainer?: string;
}

export interface WorkflowCosmosContainers {
  cases: Container;
  events: Container;
}

const DEFAULT_CONTAINERS = {
  cases: 'cases',
  events: 'events',
};

const CONTAINER_CONFIGS: Record<string, { partitionKey: PartitionKeyDefinition; ttlEnabled: boolean }> = {
  cases: {
    partitionKey: { paths: ['/tenantId'] },
    ttlEnabled: false, // Keep cases forever for audit trail
  },
  events: {
    partitionKey: { paths: ['/caseId'] },
    ttlEnabled: false, // Keep events forever for audit trail
  },
};

export class WorkflowCosmosClient {
  private readonly client: CosmosClient;
  private readonly config: Required<WorkflowCosmosConfig>;
  private database: Database | null = null;
  private containers: WorkflowCosmosContainers | null = null;

  constructor(config: WorkflowCosmosConfig) {
    this.config = {
      endpoint: config.endpoint,
      databaseName: config.databaseName,
      casesContainer: config.casesContainer || DEFAULT_CONTAINERS.cases,
      eventsContainer: config.eventsContainer || DEFAULT_CONTAINERS.events,
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
    console.log('[WorkflowCosmos] Initializing database and containers...');

    // Get or create database
    const { database } = await this.client.databases.createIfNotExists({
      id: this.config.databaseName,
    });
    this.database = database;

    // Get or create containers
    const [cases, events] = await Promise.all([
      this.getOrCreateContainer(this.config.casesContainer, 'cases'),
      this.getOrCreateContainer(this.config.eventsContainer, 'events'),
    ]);

    this.containers = {
      cases,
      events,
    };

    console.log('[WorkflowCosmos] Initialized successfully');
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
      defaultTtl: containerConfig.ttlEnabled ? -1 : undefined,
    });

    return container;
  }

  /**
   * Get all containers
   */
  getContainers(): WorkflowCosmosContainers {
    if (!this.containers) {
      throw new Error('Cosmos client not initialized. Call initialize() first.');
    }
    return this.containers;
  }

  /**
   * Get cases container
   */
  get cases(): Container {
    return this.getContainers().cases;
  }

  /**
   * Get events container
   */
  get events(): Container {
    return this.getContainers().events;
  }
}

/**
 * Create a WorkflowCosmosClient from environment variables
 */
export function createWorkflowCosmosClientFromEnv(): WorkflowCosmosClient {
  const endpoint = process.env.COSMOS_ENDPOINT;
  if (!endpoint) {
    throw new Error('COSMOS_ENDPOINT environment variable is required');
  }

  const databaseName = process.env.COSMOS_DATABASE || 'order-processing';

  return new WorkflowCosmosClient({
    endpoint,
    databaseName,
    casesContainer: process.env.COSMOS_CASES_CONTAINER,
    eventsContainer: process.env.COSMOS_EVENTS_CONTAINER,
  });
}
