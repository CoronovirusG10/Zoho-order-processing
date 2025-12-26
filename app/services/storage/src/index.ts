/**
 * Storage Service
 *
 * Azure Blob Storage service for audit trail and 5+ year retention.
 *
 * Features:
 * - Structured blob layout (orders-incoming, orders-audit, logs-archive)
 * - Audit bundle management with SHA256 verification
 * - Append-only JSONL event logging
 * - WORM policy configuration for immutability
 * - Lifecycle management (hot -> cool -> archive)
 * - Redaction policies for secrets and PII
 * - Role-based SAS URL generation
 */

// Types
export * from './types.js';

// Import classes for use in StorageService
import { BlobLayoutManager } from './blob-layout.js';
import { AuditBundleService } from './audit-bundle.js';
import { EventLoggerService } from './event-logger.js';
import { LifecyclePolicyManager } from './lifecycle-policy.js';
import { RedactionService } from './redaction.js';
import { SasGeneratorService } from './sas-generator.js';

// Blob Layout Manager
export { BlobLayoutManager } from './blob-layout.js';

// Audit Bundle Service
export {
  AuditBundleService,
  type AuditBundleInput,
  type OriginalFileInfo,
  type CanonicalOrderInfo,
  type CommitteeOutputInfo,
  type CorrectionInfo,
  type ZohoInteractionInfo,
} from './audit-bundle.js';

// Event Logger
export {
  EventLoggerService,
  type EventLoggerConfig,
} from './event-logger.js';

// Lifecycle Policy
export {
  LifecyclePolicyManager,
  DEFAULT_LIFECYCLE_CONFIG,
  DEFAULT_WORM_POLICIES,
  DEPLOYMENT_INSTRUCTIONS,
} from './lifecycle-policy.js';

// Redaction Service
export {
  RedactionService,
  redactionService,
} from './redaction.js';

// SAS Generator
export {
  SasGeneratorService,
  createSasGenerator,
} from './sas-generator.js';

/**
 * Create a fully configured storage service
 */
export interface StorageServiceConfig {
  storageAccountUrl: string;
  accountName?: string;
  accountKey?: string;
  eventLoggerConfig?: {
    useHourlyLogs?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
    redactionPolicy?: string;
  };
}

export class StorageService {
  public readonly blobLayout: BlobLayoutManager;
  public readonly auditBundle: AuditBundleService;
  public readonly eventLogger: EventLoggerService;
  public readonly lifecycle: LifecyclePolicyManager;
  public readonly redaction: RedactionService;
  public readonly sasGenerator: SasGeneratorService;

  constructor(config: StorageServiceConfig) {
    this.blobLayout = new BlobLayoutManager(config.storageAccountUrl);
    this.auditBundle = new AuditBundleService(config.storageAccountUrl);
    this.eventLogger = new EventLoggerService(
      config.storageAccountUrl,
      config.eventLoggerConfig
    );
    this.lifecycle = new LifecyclePolicyManager(config.storageAccountUrl);
    this.redaction = new RedactionService();
    this.sasGenerator = new SasGeneratorService(
      config.storageAccountUrl,
      config.accountName,
      config.accountKey
    );
  }

  /**
   * Shutdown the storage service (flush pending events)
   */
  async shutdown(): Promise<void> {
    await this.eventLogger.shutdown();
  }
}

/**
 * Create a storage service instance
 */
export function createStorageService(
  config: StorageServiceConfig
): StorageService {
  return new StorageService(config);
}
