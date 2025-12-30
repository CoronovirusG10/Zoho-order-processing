/**
 * Run Committee Activity (Temporal)
 *
 * Runs the 3-model AI committee for bounded mapping cross-check.
 * Uses multiple AI providers (GPT, Claude, DeepSeek, etc.) to validate
 * column-to-field mappings and detects disagreements requiring human intervention.
 */

import { log } from '@temporalio/activity';

// Import committee engine from the library
import {
  CommitteeEngine,
  ProviderFactory,
  createDefaultConfig,
  getDefaultProviderConfigs,
} from '@order-processing/committee';
import type {
  EvidencePack,
  SchemaMappingTask,
  CommitteeResult,
  ConsensusType,
} from '@order-processing/committee';

// Input/Output interfaces
export interface RunCommitteeInput {
  caseId: string;
  evidencePack: EvidencePack;
  expectedFields?: string[];
  correlationId?: string;
}

export interface ColumnMapping {
  header: string;
  canonicalField: string;
  confidence: number;
}

export interface CommitteeDisagreement {
  field: string;
  votes: Record<string, string | null>;
  reason: string;
}

export interface RunCommitteeOutput {
  success: boolean;
  needsHuman: boolean;
  consensus: ConsensusType;
  mappings: ColumnMapping[];
  finalMappings: Record<string, string | null>;
  disagreements?: CommitteeDisagreement[];
  executionTimeMs?: number;
  selectedProviders?: string[];
  taskId?: string;
}

// Default canonical fields for sales order mapping
const DEFAULT_EXPECTED_FIELDS = [
  'sku',
  'gtin',
  'product_name',
  'quantity',
  'unit_price',
  'line_total',
  'customer_name',
];

// Singleton engine to avoid recreating providers on each call
let cachedFactory: ProviderFactory | null = null;
let cachedEngine: CommitteeEngine | null = null;

/**
 * Get or create the committee engine
 */
function getCommitteeEngine(): CommitteeEngine {
  if (cachedEngine) {
    return cachedEngine;
  }

  // Initialize provider factory with default configurations
  const providerConfigs = getDefaultProviderConfigs();
  cachedFactory = new ProviderFactory({ configs: providerConfigs });

  const enabledCount = cachedFactory.getProviderCount();
  if (enabledCount === 0) {
    log.warn('No AI providers enabled. Check environment variables for provider configuration.');
  } else {
    log.info(`Committee engine initialized with ${enabledCount} providers`);
  }

  // Create committee configuration
  const config = createDefaultConfig();

  // Create committee engine with optional blob storage for audit trail
  const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  cachedEngine = new CommitteeEngine(cachedFactory, config, blobConnectionString);

  return cachedEngine;
}

/**
 * Runs the AI committee mapping validation for a case
 *
 * The committee selects 3 random AI providers from the configured pool,
 * each independently evaluates the column-to-field mappings, and their
 * votes are aggregated using weighted consensus.
 *
 * @param input - The input containing caseId and evidencePack
 * @returns Committee consensus result and any disagreements
 */
export async function runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  const { caseId, evidencePack, expectedFields, correlationId } = input;

  log.info('Running AI committee validation', {
    caseId,
    columnCount: evidencePack.candidateHeaders.length,
    expectedFieldCount: expectedFields?.length ?? DEFAULT_EXPECTED_FIELDS.length,
    correlationId,
  });

  try {
    const engine = getCommitteeEngine();

    // Check if we have enough providers
    if (!cachedFactory || cachedFactory.getProviderCount() < 2) {
      log.warn('Insufficient AI providers available - returning with needsHuman=true', {
        caseId,
        enabledProviders: cachedFactory?.getProviderCount() ?? 0,
      });

      return {
        success: false,
        needsHuman: true,
        consensus: 'no_consensus',
        mappings: [],
        finalMappings: {},
        disagreements: [{
          field: 'all',
          votes: {},
          reason: 'Insufficient AI providers configured. Please verify API keys and endpoints.',
        }],
      };
    }

    // Build the schema mapping task
    const task: SchemaMappingTask = {
      type: 'schema-mapping',
      evidencePack,
      expectedFields: expectedFields ?? DEFAULT_EXPECTED_FIELDS,
      candidateColumns: {}, // Engine will derive from evidence pack
    };

    // Run the committee
    const result: CommitteeResult = await engine.runCommittee(task);

    // Convert result to activity output format
    const mappings: ColumnMapping[] = [];
    for (const fieldVote of result.aggregatedResult.fieldVotes) {
      if (fieldVote.winner !== null) {
        const columnIndex = parseInt(fieldVote.winner, 10);
        const header = evidencePack.candidateHeaders[columnIndex] ?? `Column ${columnIndex}`;

        // Calculate weighted confidence from votes
        const winnerVote = fieldVote.votes.find(v => v.columnId === fieldVote.winner);
        const confidence = winnerVote?.confidence ?? 0;

        mappings.push({
          header,
          canonicalField: fieldVote.field,
          confidence,
        });
      }
    }

    // Convert disagreements
    const disagreements: CommitteeDisagreement[] = result.aggregatedResult.disagreements.map(d => ({
      field: d.field,
      votes: d.providerOutputs,
      reason: d.reason,
    }));

    log.info('Committee validation complete', {
      caseId,
      taskId: result.taskId,
      consensus: result.aggregatedResult.consensus,
      needsHuman: result.requiresHumanReview,
      mappingCount: mappings.length,
      disagreementCount: disagreements.length,
      executionTimeMs: result.executionTimeMs,
      selectedProviders: result.selectedProviders,
    });

    return {
      success: true,
      needsHuman: result.requiresHumanReview,
      consensus: result.aggregatedResult.consensus,
      mappings,
      finalMappings: result.finalMappings,
      disagreements: disagreements.length > 0 ? disagreements : undefined,
      executionTimeMs: result.executionTimeMs,
      selectedProviders: result.selectedProviders,
      taskId: result.taskId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Committee validation failed', {
      caseId,
      error: errorMessage,
      correlationId,
    });

    // Don't throw - return with needsHuman=true to allow manual intervention
    return {
      success: false,
      needsHuman: true,
      consensus: 'no_consensus',
      mappings: [],
      finalMappings: {},
      disagreements: [{
        field: 'all',
        votes: {},
        reason: `Committee execution failed: ${errorMessage}`,
      }],
    };
  }
}
