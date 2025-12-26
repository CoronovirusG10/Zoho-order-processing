/**
 * Core types for the Committee Engine
 *
 * This module defines all interfaces and types used across the committee system.
 */

/**
 * Column statistics for evidence packs
 */
export interface ColumnStats {
  columnId: string;
  headerText: string;
  nonEmptyCount: number;
  uniqueCount: number;
  dataTypes: Record<string, number>; // { "string": 10, "number": 5 }
  patterns: string[]; // Detected patterns like "GTIN-13", "Currency"
}

/**
 * Supported languages for evidence packs
 */
export type SupportedLanguage = 'en' | 'fa' | 'ar' | 'mixed' | 'unknown';

/**
 * Evidence pack sent to providers
 * Bounded - does not include full workbook
 */
export interface EvidencePack {
  caseId: string;
  candidateHeaders: string[]; // Header text only
  sampleValues: Record<string, string[]>; // columnId -> [5 sample values]
  columnStats: ColumnStats[];
  detectedLanguage: SupportedLanguage;
  constraints: string[]; // ["Must choose from candidate IDs only", "Cannot invent columns"]
  timestamp: string;
  /** Optional metadata for additional context */
  metadata?: {
    sourceFileName?: string;
    totalRows?: number;
    totalColumns?: number;
    hasFormulas?: boolean;
  };
}

/**
 * Individual mapping decision from a provider
 */
export interface ProviderMapping {
  field: string; // canonical field name (e.g., "customer_name", "sku")
  selectedColumnId: string | null; // must be from candidates, or null if no match
  confidence: number; // 0.0 to 1.0
  reasoning: string; // for audit trail
}

/**
 * Issue detected by a provider
 */
export interface ProviderIssue {
  code: string; // e.g., "AMBIGUOUS_MAPPING", "LOW_CONFIDENCE"
  severity: 'info' | 'warning' | 'error';
  evidence: string; // Reference to specific evidence
}

/**
 * Provider output schema (strict JSON)
 */
export interface ProviderMappingOutput {
  mappings: ProviderMapping[];
  issues: ProviderIssue[];
  overallConfidence: number; // 0.0 to 1.0
  processingTimeMs: number;
}

/**
 * Provider output with metadata
 */
export interface ProviderOutput {
  providerId: string;
  providerName: string;
  output: ProviderMappingOutput;
  error?: string;
  rawOutputBlobUri?: string; // Pointer to full output in blob storage
}

/**
 * Weighted vote for a single field
 */
export interface FieldVote {
  field: string;
  votes: {
    columnId: string | null;
    weight: number;
    confidence: number;
    providers: string[];
  }[];
  winner: string | null;
  winnerMargin: number; // Difference between winner and runner-up
  requiresHuman: boolean;
}

/**
 * Consensus types
 */
export type ConsensusType = 'unanimous' | 'majority' | 'split' | 'no_consensus';

/**
 * Aggregated result from all providers
 */
export interface AggregatedResult {
  consensus: ConsensusType;
  fieldVotes: FieldVote[];
  overallConfidence: number;
  disagreements: {
    field: string;
    reason: string;
    providerOutputs: Record<string, string | null>;
  }[];
}

/**
 * Committee configuration
 */
export interface CommitteeConfig {
  providerCount: number; // Default: 3
  providerPool: string[]; // Available provider IDs
  weights: Record<string, number>; // Provider weights
  consensusThreshold: number; // e.g., 0.66 for 2/3
  confidenceThreshold: number; // Minimum confidence to auto-accept
  timeoutMs: number; // Timeout for each provider call
  minSuccessfulProviders: number; // Minimum providers that must succeed (default: 2)
}

/**
 * Committee task types
 */
export type CommitteeTaskType = 'schema-mapping' | 'extraction-review';

/**
 * Base committee task
 */
export interface CommitteeTask {
  type: CommitteeTaskType;
  evidencePack: EvidencePack;
  expectedFields: string[]; // Canonical field names to map
}

/**
 * Schema mapping review task
 */
export interface SchemaMappingTask extends CommitteeTask {
  type: 'schema-mapping';
  candidateColumns: Record<string, string[]>; // field -> [candidate column IDs]
}

/**
 * Extraction review task (for future use)
 */
export interface ExtractionReviewTask extends CommitteeTask {
  type: 'extraction-review';
  extractedValues: Record<string, unknown>;
}

/**
 * Committee result
 */
export interface CommitteeResult {
  taskId: string;
  caseId: string;
  taskType: CommitteeTaskType;
  selectedProviders: string[];
  providerOutputs: ProviderOutput[];
  aggregatedResult: AggregatedResult;
  finalMappings: Record<string, string | null>; // field -> columnId
  requiresHumanReview: boolean;
  executionTimeMs: number;
  auditTrail: {
    timestamp: string;
    config: CommitteeConfig;
    evidencePackBlobUri?: string;
    rawOutputsBlobUri?: string;
  };
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'azure-openai' | 'azure-anthropic' | 'azure-deepseek' | 'gemini' | 'xai';
  endpoint?: string; // For Azure providers
  apiKey?: string; // For external providers
  deploymentName?: string; // For Azure deployments
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

/**
 * Provider factory options
 */
export interface ProviderFactoryOptions {
  configs: ProviderConfig[];
  storageConnectionString?: string; // For storing raw outputs
}

/**
 * Weight calibration result
 */
export interface CalibrationResult {
  providerId: string;
  accuracy: number;
  fieldAccuracies: Record<string, number>;
  recommendedWeight: number;
  testCasesProcessed: number;
}

/**
 * Golden file test case
 */
export interface GoldenTestCase {
  caseId: string;
  filePath: string;
  expectedMappings: Record<string, string | null>;
  evidencePack: EvidencePack;
  description: string;
}
