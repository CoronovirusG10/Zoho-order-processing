/**
 * Storage Service Types
 *
 * Types for Azure Blob Storage with 5+ year audit retention.
 */

import { ActorType } from '@order-processing/types';

/**
 * Container names for blob storage layout
 */
export enum BlobContainer {
  OrdersIncoming = 'orders-incoming',
  OrdersAudit = 'orders-audit',
  LogsArchive = 'logs-archive',
}

/**
 * Blob path components
 */
export interface BlobPath {
  container: BlobContainer;
  path: string;
}

/**
 * Storage tier for lifecycle management
 */
export enum StorageTier {
  Hot = 'Hot',
  Cool = 'Cool',
  Archive = 'Archive',
}

/**
 * WORM (Write Once Read Many) policy configuration
 */
export interface WormPolicy {
  /** Whether WORM is enabled for this container */
  enabled: boolean;
  /** Retention period in days (minimum 1, maximum 146000 for 400 years) */
  retentionDays: number;
  /** Whether the policy is locked (immutable) */
  locked: boolean;
}

/**
 * Lifecycle rule for tiering
 */
export interface LifecycleRule {
  /** Rule name */
  name: string;
  /** Container prefix pattern */
  prefix: string;
  /** Days until transition to cool tier */
  daysToCool: number;
  /** Days until transition to archive tier */
  daysToArchive: number;
  /** Days until deletion (0 = never delete) */
  daysToDelete: number;
}

/**
 * Lifecycle configuration for storage account
 */
export interface LifecycleConfig {
  rules: LifecycleRule[];
}

/**
 * Audit bundle containing all artifacts for a case
 */
export interface AuditBundle {
  /** Bundle format version */
  version: string;
  /** Case ID */
  caseId: string;
  /** Tenant ID */
  tenantId: string;
  /** Bundle creation timestamp (ISO 8601) */
  createdAt: string;
  /** Original file information */
  original: {
    /** Blob path to original file */
    blobPath: string;
    /** SHA-256 hash of original file */
    sha256: string;
    /** Original filename */
    filename: string;
    /** File size in bytes */
    sizeBytes: number;
    /** Upload timestamp */
    uploadedAt: string;
  };
  /** Extracted canonical order JSON */
  canonical: {
    /** Blob path to canonical JSON */
    blobPath: string;
    /** SHA-256 hash of canonical JSON */
    sha256: string;
    /** Extraction timestamp */
    extractedAt: string;
  };
  /** Committee votes and prompts */
  committee: {
    /** Blob paths to individual model outputs */
    modelOutputs: Array<{
      modelId: string;
      blobPath: string;
      promptBlobPath: string;
    }>;
    /** Blob path to aggregated result */
    aggregatedResult: string;
    /** Committee execution timestamp */
    executedAt: string;
  };
  /** User correction patches */
  corrections: Array<{
    /** Blob path to correction patch */
    blobPath: string;
    /** User who made the correction */
    userId: string;
    /** Correction timestamp */
    correctedAt: string;
  }>;
  /** Zoho API interactions */
  zohoPayloads: {
    /** Blob path to request payload */
    requestBlobPath: string;
    /** Blob path to response payload */
    responseBlobPath: string;
    /** Zoho sales order ID if created */
    salesOrderId?: string;
    /** API call timestamp */
    calledAt: string;
  };
  /** Correlation IDs */
  correlation: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
  /** All event timestamps */
  timeline: Array<{
    eventType: string;
    timestamp: string;
    sequence: number;
  }>;
}

/**
 * Event types for audit logging
 */
export enum AuditEventType {
  // Case lifecycle events
  CaseCreated = 'case.created',
  CaseParsed = 'case.parsed',
  CaseValidated = 'case.validated',
  CaseCorrected = 'case.corrected',
  CaseDraftCreated = 'case.draft_created',
  CaseFailed = 'case.failed',
  CaseCancelled = 'case.cancelled',

  // File events
  FileUploaded = 'file.uploaded',
  FileStored = 'file.stored',
  FileBlocked = 'file.blocked',

  // Committee events
  CommitteeStarted = 'committee.started',
  CommitteeModelCalled = 'committee.model_called',
  CommitteeCompleted = 'committee.completed',

  // Zoho events
  ZohoApiRequest = 'zoho.api_request',
  ZohoApiResponse = 'zoho.api_response',
  ZohoDraftCreated = 'zoho.draft_created',

  // User events
  UserCorrectionSubmitted = 'user.correction_submitted',
  UserApproved = 'user.approved',
  UserRejected = 'user.rejected',
  UserSelected = 'user.selected',
}

/**
 * Audit event for JSONL logging
 */
export interface AuditEvent {
  /** ISO 8601 timestamp */
  ts: string;
  /** Event type */
  eventType: AuditEventType | string;
  /** Case ID */
  caseId: string;
  /** Tenant ID */
  tenantId: string;
  /** Event sequence number (monotonic per case) */
  sequence: number;
  /** Correlation IDs */
  correlation: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
  /** Actor who triggered the event */
  actor: {
    type: ActorType;
    userId?: string;
    displayName?: string;
    ip?: string;
  };
  /** Event-specific data (small payloads only) */
  data?: Record<string, unknown>;
  /** Blob pointers for large payloads */
  pointers?: Record<string, string>;
  /** Redaction information */
  redactions?: {
    containsSecrets: boolean;
    containsPii: boolean;
    policy: string;
  };
}

/**
 * Fields that should always be redacted from logs
 */
export const REDACTED_FIELDS = [
  'accessToken',
  'refreshToken',
  'token',
  'password',
  'secret',
  'apiKey',
  'authorization',
  'bearer',
  'clientSecret',
  'zohoToken',
  'connectionString',
  'sasToken',
  'privateKey',
  'cert',
  'certificate',
] as const;

/**
 * PII fields that should be redacted or hashed
 */
export const PII_FIELDS = [
  'email',
  'phone',
  'address',
  'ssn',
  'taxId',
  'creditCard',
  'bankAccount',
  'dateOfBirth',
] as const;

/**
 * Redaction policy configuration
 */
export interface RedactionPolicy {
  /** Policy name */
  name: string;
  /** Fields to fully redact */
  redactFields: readonly string[];
  /** Fields to hash (one-way for correlation) */
  hashFields: readonly string[];
  /** Whether to apply PII redaction */
  redactPii: boolean;
  /** Regex patterns to redact */
  patterns: Array<{
    name: string;
    pattern: RegExp;
    replacement: string;
  }>;
}

/**
 * SAS URL permission levels
 */
export enum SasPermission {
  Read = 'read',
  Write = 'write',
  Delete = 'delete',
  List = 'list',
}

/**
 * Role-based SAS URL configuration
 */
export interface SasConfig {
  /** Permissions granted */
  permissions: SasPermission[];
  /** Expiry time in minutes */
  expiryMinutes: number;
  /** IP address restrictions (CIDR notation) */
  allowedIps?: string[];
  /** Allowed containers */
  allowedContainers: BlobContainer[];
}

/**
 * Role to SAS configuration mapping
 */
export const ROLE_SAS_CONFIG: Record<string, SasConfig> = {
  SalesUser: {
    permissions: [SasPermission.Read],
    expiryMinutes: 60,
    allowedContainers: [BlobContainer.OrdersAudit],
  },
  SalesManager: {
    permissions: [SasPermission.Read, SasPermission.List],
    expiryMinutes: 120,
    allowedContainers: [BlobContainer.OrdersAudit],
  },
  OpsAuditor: {
    permissions: [SasPermission.Read, SasPermission.List],
    expiryMinutes: 480, // 8 hours for audit reviews
    allowedContainers: [
      BlobContainer.OrdersIncoming,
      BlobContainer.OrdersAudit,
      BlobContainer.LogsArchive,
    ],
  },
};

/**
 * Generated SAS URL response
 */
export interface SasUrlResult {
  /** SAS URL for download */
  sasUrl: string;
  /** Expiry timestamp (ISO 8601) */
  expiresAt: string;
  /** Container name */
  container: BlobContainer;
  /** Blob path */
  blobPath: string;
  /** Permissions granted */
  permissions: SasPermission[];
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Azure storage account URL */
  accountUrl: string;
  /** Lifecycle configuration */
  lifecycle: LifecycleConfig;
  /** WORM policies by container */
  wormPolicies: Record<BlobContainer, WormPolicy>;
  /** Default redaction policy name */
  defaultRedactionPolicy: string;
}
