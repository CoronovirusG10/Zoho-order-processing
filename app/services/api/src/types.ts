import { Request } from 'express';

/**
 * Authentication context extracted from JWT
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  roles: string[];
  displayName?: string;
}

/**
 * Extended Express Request with auth context
 */
export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
  correlationId: string;
}

/**
 * User roles for authorization
 */
export enum UserRole {
  SalesUser = 'SalesUser',
  SalesManager = 'SalesManager',
  OpsAuditor = 'OpsAuditor',
}

/**
 * Case status values
 */
export enum CaseStatus {
  Processing = 'processing',
  NeedsInput = 'needs_input',
  Ready = 'ready',
  Approved = 'approved',
  DraftCreated = 'draft_created',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Case record stored in Cosmos DB
 */
export interface Case {
  id: string;
  caseId: string;
  tenantId: string;
  userId: string;
  userDisplayName?: string;
  status: CaseStatus;
  blobUrl: string;
  fileName: string;
  fileSha256: string;
  customerName?: string;
  zohoSalesOrderId?: string;
  zohoSalesOrderNumber?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  correlationId: string;
  _partitionKey?: string;
}

/**
 * Case filters for listing
 */
export interface CaseFilters {
  status?: CaseStatus[];
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated case response
 */
export interface CasePage {
  cases: Case[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Input for creating a new case
 */
export interface CreateCaseInput {
  tenantId: string;
  userId: string;
  userDisplayName?: string;
  blobUrl: string;
  fileName: string;
  fileSha256: string;
  correlationId: string;
  teamsActivityId?: string;
}

/**
 * Correction input from user
 */
export interface Correction {
  field: string;
  value: unknown;
  lineIndex?: number;
}

/**
 * Order processing event for audit trail
 */
export interface OrderProcessingEvent {
  id: string;
  caseId: string;
  tenantId: string;
  sequence: number;
  timestamp: string;
  eventType: string;
  userId?: string;
  data: Record<string, unknown>;
  correlationId: string;
  _partitionKey?: string;
}

/**
 * Fingerprint record for idempotency
 */
export interface Fingerprint {
  id: string;
  fingerprint: string;
  caseId: string;
  tenantId: string;
  createdAt: string;
  zohoSalesOrderId?: string;
  _partitionKey?: string;
}

/**
 * Bot webhook event types
 */
export interface FileUploadedEvent {
  caseId: string;
  blobUrl: string;
  tenantId: string;
  userId: string;
  activityId?: string;
  fileName: string;
  fileSha256: string;
}

export interface CorrectionsSubmittedEvent {
  caseId: string;
  corrections: Correction[];
  userId: string;
  tenantId: string;
}

export interface ApprovalEvent {
  caseId: string;
  approved: boolean;
  userId: string;
  tenantId: string;
}

/**
 * SAS URL response
 */
export interface SasUrlResponse {
  sasUrl: string;
  expiresAt: string;
}

/**
 * API error response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: unknown;
  };
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  dependencies?: {
    cosmos?: 'up' | 'down';
    blob?: 'up' | 'down';
  };
}
