/**
 * Agent State Manager
 *
 * Manages persistent state for agent threads and case context in Cosmos DB.
 * Handles:
 * - Thread state storage and retrieval
 * - Case context caching
 * - State transitions
 * - Cleanup of expired threads
 */

import { CosmosClient, Container, PartitionKey } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import {
  AgentThreadState,
  AgentThreadStatus,
  CaseContext,
  ConversationTurn,
} from '../types.js';
import { Logger } from '@order-processing/shared';

/**
 * State manager configuration
 */
export interface AgentStateManagerConfig {
  /** Cosmos DB endpoint */
  cosmosEndpoint: string;
  /** Database ID */
  databaseId: string;
  /** Container for thread state */
  threadContainerId: string;
  /** Container for case context cache */
  contextContainerId: string;
  /** Thread TTL in seconds (default: 24 hours) */
  threadTtlSeconds: number;
}

/**
 * Thread state document in Cosmos
 */
interface ThreadStateDocument extends AgentThreadState {
  id: string;
  ttl?: number;
}

/**
 * Case context document in Cosmos
 */
interface CaseContextDocument {
  id: string;
  caseId: string;
  tenantId: string;
  context: CaseContext;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
  _partitionKey: string;
  ttl?: number;
}

/**
 * Agent State Manager class
 */
export class AgentStateManager {
  private readonly config: AgentStateManagerConfig;
  private readonly logger: Logger;
  private threadContainer: Container | null = null;
  private contextContainer: Container | null = null;
  private client: CosmosClient | null = null;

  constructor(config: AgentStateManagerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'AgentStateManager' });
  }

  /**
   * Initialize Cosmos DB connections
   */
  async initialize(): Promise<void> {
    const credential = new DefaultAzureCredential();
    this.client = new CosmosClient({
      endpoint: this.config.cosmosEndpoint,
      aadCredentials: credential,
    });

    const database = this.client.database(this.config.databaseId);
    this.threadContainer = database.container(this.config.threadContainerId);
    this.contextContainer = database.container(this.config.contextContainerId);

    this.logger.info('State manager initialized', {
      databaseId: this.config.databaseId,
    });
  }

  /**
   * Save a new thread state
   */
  async saveThreadState(
    state: Omit<AgentThreadState, '_partitionKey'>
  ): Promise<AgentThreadState> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    const document: ThreadStateDocument = {
      ...state,
      id: state.threadId,
      _partitionKey: state.tenantId,
      ttl: this.config.threadTtlSeconds,
    };

    const { resource } = await this.threadContainer.items.create(document);

    this.logger.info('Thread state saved', {
      threadId: state.threadId,
      caseId: state.caseId,
    });

    return resource as AgentThreadState;
  }

  /**
   * Get thread state by ID
   */
  async getThreadState(
    threadId: string,
    tenantId: string
  ): Promise<AgentThreadState | null> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    try {
      const { resource } = await this.threadContainer
        .item(threadId, tenantId)
        .read<ThreadStateDocument>();

      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update thread state
   */
  async updateThreadState(
    threadId: string,
    tenantId: string,
    updates: Partial<AgentThreadState>
  ): Promise<AgentThreadState> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    const existing = await this.getThreadState(threadId, tenantId);
    if (!existing) {
      throw new Error('Thread not found');
    }

    const updated: ThreadStateDocument = {
      ...existing,
      ...updates,
      id: threadId,
      lastActivityAt: new Date().toISOString(),
      _partitionKey: tenantId,
      ttl: this.config.threadTtlSeconds,
    };

    const { resource } = await this.threadContainer
      .item(threadId, tenantId)
      .replace(updated);

    this.logger.info('Thread state updated', {
      threadId,
      status: updated.status,
    });

    return resource as AgentThreadState;
  }

  /**
   * Delete thread state
   */
  async deleteThreadState(threadId: string, tenantId: string): Promise<void> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    await this.threadContainer.item(threadId, tenantId).delete();

    this.logger.info('Thread state deleted', { threadId });
  }

  /**
   * Get thread by case ID
   */
  async getThreadByCaseId(
    caseId: string,
    tenantId: string
  ): Promise<AgentThreadState | null> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    const query = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId AND c._partitionKey = @tenantId',
      parameters: [
        { name: '@caseId', value: caseId },
        { name: '@tenantId', value: tenantId },
      ],
    };

    const { resources } = await this.threadContainer.items.query(query).fetchAll();

    if (resources.length === 0) {
      return null;
    }

    // Return the most recent thread
    return resources.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] as AgentThreadState;
  }

  /**
   * List active threads for a user
   */
  async listActiveThreads(
    userId: string,
    tenantId: string
  ): Promise<AgentThreadState[]> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    const query = {
      query: `
        SELECT * FROM c
        WHERE c.userId = @userId
        AND c._partitionKey = @tenantId
        AND c.status IN ('active', 'awaiting_user', 'awaiting_tool')
        ORDER BY c.lastActivityAt DESC
      `,
      parameters: [
        { name: '@userId', value: userId },
        { name: '@tenantId', value: tenantId },
      ],
    };

    const { resources } = await this.threadContainer.items.query(query).fetchAll();
    return resources as AgentThreadState[];
  }

  /**
   * Save case context
   */
  async saveCaseContext(
    caseId: string,
    tenantId: string,
    context: CaseContext
  ): Promise<void> {
    if (!this.contextContainer) {
      throw new Error('State manager not initialized');
    }

    const document: CaseContextDocument = {
      id: caseId,
      caseId,
      tenantId,
      context,
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _partitionKey: tenantId,
      ttl: this.config.threadTtlSeconds * 2, // Keep context longer than threads
    };

    await this.contextContainer.items.upsert(document);

    this.logger.debug('Case context saved', { caseId });
  }

  /**
   * Get case context
   */
  async getCaseContext(
    caseId: string,
    tenantId: string
  ): Promise<CaseContext | null> {
    if (!this.contextContainer) {
      throw new Error('State manager not initialized');
    }

    try {
      const { resource } = await this.contextContainer
        .item(caseId, tenantId)
        .read<CaseContextDocument>();

      return resource?.context || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Add conversation turn to case context
   */
  async addConversationTurn(
    caseId: string,
    tenantId: string,
    turn: ConversationTurn
  ): Promise<void> {
    if (!this.contextContainer) {
      throw new Error('State manager not initialized');
    }

    const existing = await this.contextContainer
      .item(caseId, tenantId)
      .read<CaseContextDocument>();

    if (!existing.resource) {
      throw new Error('Case context not found');
    }

    existing.resource.turns.push(turn);
    existing.resource.updatedAt = new Date().toISOString();

    await this.contextContainer.item(caseId, tenantId).replace(existing.resource);

    this.logger.debug('Conversation turn added', {
      caseId,
      turnNumber: turn.turnNumber,
    });
  }

  /**
   * Get conversation history for a case
   */
  async getConversationHistory(
    caseId: string,
    tenantId: string
  ): Promise<ConversationTurn[]> {
    if (!this.contextContainer) {
      throw new Error('State manager not initialized');
    }

    try {
      const { resource } = await this.contextContainer
        .item(caseId, tenantId)
        .read<CaseContextDocument>();

      return resource?.turns || [];
    } catch (error: any) {
      if (error.code === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Mark thread as expired
   */
  async expireThread(threadId: string, tenantId: string): Promise<void> {
    await this.updateThreadState(threadId, tenantId, {
      status: 'expired' as AgentThreadStatus,
    });

    this.logger.info('Thread expired', { threadId });
  }

  /**
   * Cleanup expired threads (to be called by a scheduled job)
   */
  async cleanupExpiredThreads(tenantId: string): Promise<number> {
    if (!this.threadContainer) {
      throw new Error('State manager not initialized');
    }

    // Threads older than TTL that are still active
    const cutoffTime = new Date(
      Date.now() - this.config.threadTtlSeconds * 1000
    ).toISOString();

    const query = {
      query: `
        SELECT c.id, c.threadId FROM c
        WHERE c._partitionKey = @tenantId
        AND c.lastActivityAt < @cutoffTime
        AND c.status IN ('active', 'awaiting_user')
      `,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@cutoffTime', value: cutoffTime },
      ],
    };

    const { resources } = await this.threadContainer.items.query(query).fetchAll();

    for (const thread of resources) {
      await this.expireThread(thread.threadId, tenantId);
    }

    this.logger.info('Expired threads cleanup completed', {
      tenantId,
      count: resources.length,
    });

    return resources.length;
  }
}

/**
 * Create state manager with default configuration
 */
export function createAgentStateManager(
  logger: Logger,
  cosmosEndpoint?: string
): AgentStateManager {
  const config: AgentStateManagerConfig = {
    cosmosEndpoint: cosmosEndpoint || process.env.COSMOS_ENDPOINT || '',
    databaseId: process.env.COSMOS_DATABASE || 'order-processing',
    threadContainerId: 'agent-threads',
    contextContainerId: 'agent-contexts',
    threadTtlSeconds: 86400, // 24 hours
  };

  return new AgentStateManager(config, logger);
}
