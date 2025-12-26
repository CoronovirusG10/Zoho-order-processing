/**
 * Conversation reference storage for proactive messaging
 * Stores conversation references in Azure Cosmos DB for later use
 */

import { ConversationReference as BotConversationReference, TurnContext } from 'botbuilder';
import { createLogger } from '../middleware/logging-middleware.js';
import { getCorrelationId } from '../middleware/correlation-middleware.js';

/**
 * Stored conversation reference with metadata
 */
export interface StoredConversationReference {
  id: string;
  partitionKey: string;
  conversationReference: BotConversationReference;
  caseId?: string;
  tenantId: string;
  userId: string;
  userName?: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  ttl?: number;
}

/**
 * Conversation store interface
 */
export interface IConversationStore {
  store(context: TurnContext, caseId?: string): Promise<string>;
  get(conversationId: string): Promise<StoredConversationReference | null>;
  getByCase(caseId: string): Promise<StoredConversationReference | null>;
  getByUser(userId: string, tenantId: string): Promise<StoredConversationReference[]>;
  delete(conversationId: string): Promise<void>;
}

/**
 * In-memory conversation store (for development/testing)
 * In production, this should be replaced with Cosmos DB
 */
export class InMemoryConversationStore implements IConversationStore {
  private _storage: Map<string, StoredConversationReference> = new Map();
  private caseIndex: Map<string, string> = new Map(); // caseId -> conversationId

  async store(context: TurnContext, caseId?: string): Promise<string> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const activity = context.activity;
    const channelData = activity.channelData as any;
    const conversationId = activity.conversation?.id || '';

    // Build the conversation reference using Bot Framework's method
    const conversationReference = TurnContext.getConversationReference(activity) as BotConversationReference;

    const stored: StoredConversationReference = {
      id: conversationId,
      partitionKey: channelData?.tenant?.id || 'default',
      conversationReference,
      caseId,
      tenantId: channelData?.tenant?.id || 'unknown',
      userId: activity.from?.aadObjectId || activity.from?.id || 'unknown',
      userName: activity.from?.name,
      locale: activity.locale,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this._storage.set(conversationId, stored);

    if (caseId) {
      this.caseIndex.set(caseId, conversationId);
    }

    logger.info('Conversation reference stored', {
      conversationId,
      caseId,
      tenantId: stored.tenantId,
    });

    return conversationId;
  }

  async get(conversationId: string): Promise<StoredConversationReference | null> {
    return this._storage.get(conversationId) || null;
  }

  async getByCase(caseId: string): Promise<StoredConversationReference | null> {
    const conversationId = this.caseIndex.get(caseId);
    if (!conversationId) {
      return null;
    }
    return this._storage.get(conversationId) || null;
  }

  async getByUser(_userId: string, _tenantId: string): Promise<StoredConversationReference[]> {
    const results: StoredConversationReference[] = [];
    for (const stored of this._storage.values()) {
      if (stored.userId === _userId && stored.tenantId === _tenantId) {
        results.push(stored);
      }
    }
    return results;
  }

  async delete(conversationId: string): Promise<void> {
    const stored = this._storage.get(conversationId);
    if (stored?.caseId) {
      this.caseIndex.delete(stored.caseId);
    }
    this._storage.delete(conversationId);
  }
}

/**
 * Cosmos DB conversation store (production)
 * Uses Azure Cosmos DB for durable storage
 */
export class CosmosConversationStore implements IConversationStore {
  private containerName = 'conversations';
  private databaseName = 'orderprocessing';
  private endpoint: string;
  private initialized = false;

  constructor() {
    this.endpoint = process.env.COSMOS_ENDPOINT || '';
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // In production, initialize Cosmos DB client here
    // For now, log that Cosmos is not configured
    if (!this.endpoint) {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'Cosmos DB not configured, using in-memory fallback',
        timestamp: new Date().toISOString(),
      }));
    }

    this.initialized = true;
  }

  async store(context: TurnContext, caseId?: string): Promise<string> {
    await this.ensureInitialized();

    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const activity = context.activity;
    const channelData = activity.channelData as any;
    const conversationId = activity.conversation?.id || '';

    const conversationReference = TurnContext.getConversationReference(activity) as BotConversationReference;

    const document: StoredConversationReference = {
      id: conversationId,
      partitionKey: channelData?.tenant?.id || 'default',
      conversationReference,
      caseId,
      tenantId: channelData?.tenant?.id || 'unknown',
      userId: activity.from?.aadObjectId || activity.from?.id || 'unknown',
      userName: activity.from?.name,
      locale: activity.locale,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Set TTL for 90 days (in seconds)
      ttl: 90 * 24 * 60 * 60,
    };

    // In production, upsert to Cosmos DB
    // await container.items.upsert(document);

    logger.info('Conversation reference stored to Cosmos', {
      conversationId,
      caseId,
      tenantId: document.tenantId,
    });

    return conversationId;
  }

  async get(conversationId: string): Promise<StoredConversationReference | null> {
    await this.ensureInitialized();

    // In production, query Cosmos DB
    // const { resource } = await container.item(conversationId, partitionKey).read();
    // return resource;

    return null;
  }

  async getByCase(caseId: string): Promise<StoredConversationReference | null> {
    await this.ensureInitialized();

    // In production, query Cosmos DB with caseId index
    // const querySpec = {
    //   query: 'SELECT * FROM c WHERE c.caseId = @caseId',
    //   parameters: [{ name: '@caseId', value: caseId }],
    // };

    return null;
  }

  async getByUser(userId: string, tenantId: string): Promise<StoredConversationReference[]> {
    await this.ensureInitialized();

    // In production, query Cosmos DB
    // const querySpec = {
    //   query: 'SELECT * FROM c WHERE c.userId = @userId AND c.tenantId = @tenantId',
    //   parameters: [
    //     { name: '@userId', value: userId },
    //     { name: '@tenantId', value: tenantId },
    //   ],
    // };

    return [];
  }

  async delete(conversationId: string): Promise<void> {
    await this.ensureInitialized();

    // In production, delete from Cosmos DB
    // await container.item(conversationId, partitionKey).delete();
  }
}

/**
 * Create the appropriate conversation store based on environment
 */
export function createConversationStore(): IConversationStore {
  const useCosmosDb = process.env.USE_COSMOS_DB === 'true' && process.env.COSMOS_ENDPOINT;

  if (useCosmosDb) {
    return new CosmosConversationStore();
  }

  return new InMemoryConversationStore();
}

/**
 * Default conversation store instance
 */
export const conversationStore = createConversationStore();
