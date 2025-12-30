import { config } from '../config.js';
import { CaseRepository } from '../repositories/case-repository.js';
import { FingerprintRepository } from '../repositories/fingerprint-repository.js';
import { CaseService } from './case-service.js';
import { AuditService } from './audit-service.js';
import { BlobService } from './blob-service.js';
import {
  ZohoClient,
  tryInitializeZohoPersistence,
  type ZohoPersistenceStores,
} from '@order-processing/zoho';

/**
 * Service factory for dependency injection
 * Creates singleton instances of services and repositories
 */
class ServiceFactory {
  private static instance: ServiceFactory;

  private _caseRepository?: CaseRepository;
  private _fingerprintRepository?: FingerprintRepository;
  private _caseService?: CaseService;
  private _auditService?: AuditService;
  private _blobService?: BlobService;
  private _zohoClient?: ZohoClient;
  private _zohoPersistence?: ZohoPersistenceStores | null;
  private _zohoInitPromise?: Promise<void>;

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  get caseRepository(): CaseRepository {
    if (!this._caseRepository) {
      this._caseRepository = new CaseRepository(
        config.cosmos.endpoint,
        config.cosmos.databaseId,
        config.cosmos.containers.cases
      );
    }
    return this._caseRepository;
  }

  get fingerprintRepository(): FingerprintRepository {
    if (!this._fingerprintRepository) {
      this._fingerprintRepository = new FingerprintRepository(
        config.cosmos.endpoint,
        config.cosmos.databaseId,
        config.cosmos.containers.fingerprints
      );
    }
    return this._fingerprintRepository;
  }

  get caseService(): CaseService {
    if (!this._caseService) {
      this._caseService = new CaseService(this.caseRepository);
    }
    return this._caseService;
  }

  get auditService(): AuditService {
    if (!this._auditService) {
      this._auditService = new AuditService(
        config.cosmos.endpoint,
        config.cosmos.databaseId,
        config.cosmos.containers.auditEvents,
        config.storage.accountUrl,
        config.storage.containers.auditBundles
      );
    }
    return this._auditService;
  }

  get blobService(): BlobService {
    if (!this._blobService) {
      this._blobService = new BlobService(config.storage.accountUrl);
    }
    return this._blobService;
  }

  /**
   * Get the ZohoClient with Cosmos persistence (if available)
   * Must call initializeZohoClient() first to enable Cosmos persistence
   */
  get zohoClient(): ZohoClient {
    if (!this._zohoClient) {
      // Create with persistence stores if available, otherwise in-memory
      const keyVaultUrl = process.env.KEY_VAULT_URL || '';
      const gtinCustomFieldId = process.env.ZOHO_GTIN_CUSTOM_FIELD_ID;
      const externalOrderKeyFieldId = process.env.ZOHO_EXTERNAL_ORDER_KEY_FIELD_ID;

      if (this._zohoPersistence) {
        this._zohoClient = new ZohoClient({
          keyVaultUrl,
          gtinCustomFieldId,
          externalOrderKeyFieldId,
          fingerprintStore: this._zohoPersistence.fingerprintStore,
          retryQueue: this._zohoPersistence.retryQueue,
          outbox: this._zohoPersistence.outbox,
        });
      } else {
        // Fallback to in-memory storage
        this._zohoClient = new ZohoClient({
          keyVaultUrl,
          gtinCustomFieldId,
          externalOrderKeyFieldId,
        });
      }
    }
    return this._zohoClient;
  }

  /**
   * Initialize the ZohoClient with Cosmos persistence
   * Should be called during application startup
   */
  async initializeZohoClient(): Promise<void> {
    // Use a promise to prevent concurrent initialization
    if (this._zohoInitPromise) {
      return this._zohoInitPromise;
    }

    this._zohoInitPromise = (async () => {
      console.log('[ServiceFactory] Initializing Zoho client with Cosmos persistence...');

      // Try to initialize Cosmos persistence
      this._zohoPersistence = await tryInitializeZohoPersistence({
        cosmosEndpoint: config.cosmos.endpoint,
        cosmosDatabase: config.cosmos.databaseId,
      });

      if (this._zohoPersistence) {
        console.log('[ServiceFactory] Zoho Cosmos persistence initialized successfully');
      } else {
        console.warn('[ServiceFactory] Zoho Cosmos persistence unavailable - using in-memory storage');
      }

      // Reset the client so it gets recreated with persistence
      this._zohoClient = undefined;
    })();

    return this._zohoInitPromise;
  }

  /**
   * Reset all services (useful for testing)
   */
  reset(): void {
    this._caseRepository = undefined;
    this._fingerprintRepository = undefined;
    this._caseService = undefined;
    this._auditService = undefined;
    this._blobService = undefined;
    this._zohoClient = undefined;
    this._zohoPersistence = undefined;
    this._zohoInitPromise = undefined;
  }
}

// Export singleton instance
export const serviceFactory = ServiceFactory.getInstance();
