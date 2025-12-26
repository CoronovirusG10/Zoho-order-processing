/**
 * Committee Engine
 *
 * Main orchestrator for multi-provider committee decisions
 */

import {
  CommitteeConfig,
  CommitteeTask,
  CommitteeResult,
  SchemaMappingTask,
  ProviderOutput,
} from './types';
import { ProviderFactory } from './providers/provider-factory';
import { executeSchemaMappingReview, validateProviderOutputs } from './tasks/schema-mapping-review';
import { executeExtractionReview } from './tasks/extraction-review';
import { aggregateVotes } from './aggregation/weighted-voting';
import { isSufficientConsensus } from './aggregation/consensus-detector';
import { loadWeights } from './config/weights';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

/**
 * Committee Engine
 *
 * Orchestrates multi-provider AI committee for validation tasks
 */
export class CommitteeEngine {
  private factory: ProviderFactory;
  private blobClient?: BlobServiceClient;
  private config: CommitteeConfig;

  constructor(factory: ProviderFactory, config: CommitteeConfig, blobConnectionString?: string) {
    this.factory = factory;
    this.config = config;

    if (blobConnectionString) {
      this.blobClient = BlobServiceClient.fromConnectionString(blobConnectionString);
    }
  }

  /**
   * Run the committee on a task
   *
   * @param task - The task to execute
   * @returns Committee result with aggregated decisions
   */
  async runCommittee(task: CommitteeTask): Promise<CommitteeResult> {
    const startTime = Date.now();
    const taskId = uuidv4();

    // 1. Select N providers randomly from pool
    const selectedProviders = this.factory.selectRandomProviders(
      this.config.providerCount,
      this.config.providerPool
    );

    const selectedProviderIds = selectedProviders.map((p) => p.getId());

    console.log(`Committee ${taskId}: Selected providers:`, selectedProviderIds);

    // 2. Prepare evidence pack (already done by caller, just validate)
    this.validateEvidencePack(task.evidencePack);

    // 3. Call each provider in parallel
    let providerOutputs: ProviderOutput[];

    try {
      providerOutputs = await this.executeTask(task, selectedProviders);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Committee execution failed: ${errorMsg}`);
    }

    // 4. Validate each response
    const validationErrors = this.validateOutputs(task, providerOutputs);
    if (validationErrors.length > 0) {
      console.warn(`Committee ${taskId}: Validation warnings:`, validationErrors);
    }

    // 5. Aggregate votes
    const aggregatedResult = aggregateVotes(
      providerOutputs.filter((o) => !o.error),
      this.config.weights,
      this.config.consensusThreshold
    );

    // 6. Determine consensus and final mappings
    const finalMappings = this.extractFinalMappings(aggregatedResult);
    const requiresHumanReview = this.determineHumanReviewNeeded(aggregatedResult);

    // 7. Store raw outputs to blob (if configured)
    const rawOutputsBlobUri = await this.storeRawOutputs(taskId, providerOutputs);
    const evidencePackBlobUri = await this.storeEvidencePack(taskId, task.evidencePack);

    const executionTimeMs = Date.now() - startTime;

    const result: CommitteeResult = {
      taskId,
      caseId: task.evidencePack.caseId,
      taskType: task.type,
      selectedProviders: selectedProviderIds,
      providerOutputs,
      aggregatedResult,
      finalMappings,
      requiresHumanReview,
      executionTimeMs,
      auditTrail: {
        timestamp: new Date().toISOString(),
        config: this.config,
        evidencePackBlobUri,
        rawOutputsBlobUri,
      },
    };

    console.log(
      `Committee ${taskId}: Completed in ${executionTimeMs}ms. Consensus: ${aggregatedResult.consensus}, Human review: ${requiresHumanReview}`
    );

    return result;
  }

  /**
   * Execute task based on type
   */
  private async executeTask(
    task: CommitteeTask,
    providers: any[]
  ): Promise<ProviderOutput[]> {
    switch (task.type) {
      case 'schema-mapping':
        return executeSchemaMappingReview(task as SchemaMappingTask, providers, this.config);
      case 'extraction-review':
        return executeExtractionReview(task, providers, this.config);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Validate evidence pack
   */
  private validateEvidencePack(evidencePack: any): void {
    if (!evidencePack.caseId) {
      throw new Error('Evidence pack missing caseId');
    }

    if (!evidencePack.candidateHeaders || evidencePack.candidateHeaders.length === 0) {
      throw new Error('Evidence pack missing candidateHeaders');
    }

    if (!evidencePack.constraints || evidencePack.constraints.length === 0) {
      throw new Error('Evidence pack missing constraints');
    }
  }

  /**
   * Validate provider outputs
   */
  private validateOutputs(task: CommitteeTask, outputs: ProviderOutput[]): string[] {
    const errors: string[] = [];

    // Check minimum successful providers
    const successfulCount = outputs.filter((o) => !o.error).length;
    if (successfulCount < this.config.minSuccessfulProviders) {
      errors.push(
        `Only ${successfulCount} providers succeeded (minimum: ${this.config.minSuccessfulProviders})`
      );
    }

    // Task-specific validation
    if (task.type === 'schema-mapping') {
      const mappingErrors = validateProviderOutputs(outputs, task.expectedFields);
      errors.push(...mappingErrors);
    }

    return errors;
  }

  /**
   * Extract final mappings from aggregated result
   */
  private extractFinalMappings(aggregatedResult: any): Record<string, string | null> {
    const mappings: Record<string, string | null> = {};

    for (const fieldVote of aggregatedResult.fieldVotes) {
      mappings[fieldVote.field] = fieldVote.winner;
    }

    return mappings;
  }

  /**
   * Determine if human review is needed
   */
  private determineHumanReviewNeeded(aggregatedResult: any): boolean {
    // Always require human review if consensus is insufficient
    if (!isSufficientConsensus(
      aggregatedResult.consensus,
      aggregatedResult.overallConfidence,
      this.config.confidenceThreshold
    )) {
      return true;
    }

    // Check for any fields requiring human review
    const hasFieldsNeedingReview = aggregatedResult.fieldVotes.some(
      (fv: any) => fv.requiresHuman
    );

    return hasFieldsNeedingReview;
  }

  /**
   * Store raw outputs to blob storage
   */
  private async storeRawOutputs(
    taskId: string,
    outputs: ProviderOutput[]
  ): Promise<string | undefined> {
    if (!this.blobClient) {
      return undefined;
    }

    try {
      const containerClient = this.blobClient.getContainerClient('committee-outputs');
      await containerClient.createIfNotExists();

      const blobName = `${taskId}/raw-outputs.json`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const content = JSON.stringify(outputs, null, 2);
      await blockBlobClient.upload(content, content.length);

      return blockBlobClient.url;
    } catch (error) {
      console.error('Failed to store raw outputs:', error);
      return undefined;
    }
  }

  /**
   * Store evidence pack to blob storage
   */
  private async storeEvidencePack(
    taskId: string,
    evidencePack: any
  ): Promise<string | undefined> {
    if (!this.blobClient) {
      return undefined;
    }

    try {
      const containerClient = this.blobClient.getContainerClient('committee-outputs');
      await containerClient.createIfNotExists();

      const blobName = `${taskId}/evidence-pack.json`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const content = JSON.stringify(evidencePack, null, 2);
      await blockBlobClient.upload(content, content.length);

      return blockBlobClient.url;
    } catch (error) {
      console.error('Failed to store evidence pack:', error);
      return undefined;
    }
  }
}

/**
 * Create default committee configuration
 */
export function createDefaultConfig(): CommitteeConfig {
  return {
    providerCount: 3,
    providerPool: [
      'azure-gpt-5.1',
      'azure-claude-opus-4.5',
      'azure-deepseek-v3.2',
      'gemini-2.5-pro',
      'xai-grok-4-reasoning',
    ],
    weights: loadWeights(),
    consensusThreshold: 0.66, // 2/3 majority
    confidenceThreshold: 0.75,
    timeoutMs: 30000, // 30 seconds per provider
    minSuccessfulProviders: 2, // At least 2 out of 3 must succeed
  };
}
