import { config } from '../config.js';
import { CaseRepository } from '../repositories/case-repository.js';
import { FingerprintRepository } from '../repositories/fingerprint-repository.js';
import { CaseService } from './case-service.js';
import { AuditService } from './audit-service.js';
import { BlobService } from './blob-service.js';

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
   * Reset all services (useful for testing)
   */
  reset(): void {
    this._caseRepository = undefined;
    this._fingerprintRepository = undefined;
    this._caseService = undefined;
    this._auditService = undefined;
    this._blobService = undefined;
  }
}

// Export singleton instance
export const serviceFactory = ServiceFactory.getInstance();
