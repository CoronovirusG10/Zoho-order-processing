/**
 * Audit Bundle Service
 *
 * Creates and manages audit bundles containing all artifacts for a case:
 * - Original file SHA256
 * - Extracted canonical JSON
 * - Committee votes + prompts
 * - User correction patches
 * - Zoho request/response payloads
 * - Timestamps and correlation IDs
 */

import { createHash } from 'crypto';
import { BlobLayoutManager } from './blob-layout.js';
import {
  AuditBundle,
  BlobContainer,
  BlobPath,
} from './types.js';

/**
 * Input for creating/updating audit bundle
 */
export interface AuditBundleInput {
  caseId: string;
  tenantId: string;
  correlation: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
}

/**
 * Original file info for audit bundle
 */
export interface OriginalFileInfo {
  filename: string;
  content: Buffer;
  uploadedAt: string;
}

/**
 * Canonical order info for audit bundle
 */
export interface CanonicalOrderInfo {
  order: unknown;
  extractedAt: string;
}

/**
 * Committee output for audit bundle
 */
export interface CommitteeOutputInfo {
  modelId: string;
  prompt: unknown;
  output: unknown;
  executedAt: string;
}

/**
 * User correction for audit bundle
 */
export interface CorrectionInfo {
  userId: string;
  patches: unknown[];
  correctedAt: string;
}

/**
 * Zoho API interaction for audit bundle
 */
export interface ZohoInteractionInfo {
  request: unknown;
  response: unknown;
  salesOrderId?: string;
  calledAt: string;
}

/**
 * Audit Bundle Service
 *
 * Manages the creation and retrieval of audit bundles for 5+ year retention.
 */
export class AuditBundleService {
  private layoutManager: BlobLayoutManager;

  constructor(storageAccountUrl: string) {
    this.layoutManager = new BlobLayoutManager(storageAccountUrl);
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private calculateSha256(content: Buffer | string): string {
    const buffer =
      typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Initialize a new audit bundle for a case
   */
  async initializeBundle(input: AuditBundleInput): Promise<AuditBundle> {
    const bundle: AuditBundle = {
      version: '1.0.0',
      caseId: input.caseId,
      tenantId: input.tenantId,
      createdAt: new Date().toISOString(),
      original: {
        blobPath: '',
        sha256: '',
        filename: '',
        sizeBytes: 0,
        uploadedAt: '',
      },
      canonical: {
        blobPath: '',
        sha256: '',
        extractedAt: '',
      },
      committee: {
        modelOutputs: [],
        aggregatedResult: '',
        executedAt: '',
      },
      corrections: [],
      zohoPayloads: {
        requestBlobPath: '',
        responseBlobPath: '',
        calledAt: '',
      },
      correlation: input.correlation,
      timeline: [
        {
          eventType: 'bundle.initialized',
          timestamp: new Date().toISOString(),
          sequence: 1,
        },
      ],
    };

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store the original uploaded file
   */
  async storeOriginalFile(
    input: AuditBundleInput,
    file: OriginalFileInfo
  ): Promise<AuditBundle> {
    // Store the file
    const { blobPath, sha256, sizeBytes } =
      await this.layoutManager.storeOriginalFile(
        input.caseId,
        file.filename,
        file.content,
        {
          tenantId: input.tenantId,
          traceId: input.correlation.traceId,
        }
      );

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.original = {
      blobPath: this.formatBlobPath(blobPath),
      sha256,
      filename: file.filename,
      sizeBytes,
      uploadedAt: file.uploadedAt,
    };

    bundle.timeline.push({
      eventType: 'original.stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store the canonical order JSON
   */
  async storeCanonicalOrder(
    input: AuditBundleInput,
    canonical: CanonicalOrderInfo
  ): Promise<AuditBundle> {
    const blobPath = this.layoutManager.getCanonicalJsonPath(input.caseId);

    await this.layoutManager.storeAuditArtifact(blobPath, canonical.order, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
    });

    const sha256 = this.calculateSha256(JSON.stringify(canonical.order));

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.canonical = {
      blobPath: this.formatBlobPath(blobPath),
      sha256,
      extractedAt: canonical.extractedAt,
    };

    bundle.timeline.push({
      eventType: 'canonical.stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store committee model output
   */
  async storeCommitteeOutput(
    input: AuditBundleInput,
    output: CommitteeOutputInfo
  ): Promise<AuditBundle> {
    // Store prompt
    const promptPath = this.layoutManager.getCommitteePromptPath(
      input.caseId,
      output.modelId
    );
    await this.layoutManager.storeAuditArtifact(promptPath, output.prompt, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
      modelId: output.modelId,
    });

    // Store output
    const outputPath = this.layoutManager.getCommitteeOutputPath(
      input.caseId,
      output.modelId
    );
    await this.layoutManager.storeAuditArtifact(outputPath, output.output, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
      modelId: output.modelId,
    });

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.committee.modelOutputs.push({
      modelId: output.modelId,
      blobPath: this.formatBlobPath(outputPath),
      promptBlobPath: this.formatBlobPath(promptPath),
    });
    bundle.committee.executedAt = output.executedAt;

    bundle.timeline.push({
      eventType: 'committee.model_output_stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store aggregated committee result
   */
  async storeAggregatedResult(
    input: AuditBundleInput,
    result: unknown,
    executedAt: string
  ): Promise<AuditBundle> {
    const blobPath = {
      container: BlobContainer.OrdersAudit,
      path: `${input.caseId}/committee/aggregated.json`,
    };

    await this.layoutManager.storeAuditArtifact(blobPath, result, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
    });

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.committee.aggregatedResult = this.formatBlobPath(blobPath);
    bundle.committee.executedAt = executedAt;

    bundle.timeline.push({
      eventType: 'committee.aggregated_stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store user correction patch
   */
  async storeCorrection(
    input: AuditBundleInput,
    correction: CorrectionInfo
  ): Promise<AuditBundle> {
    const blobPath = this.layoutManager.getCorrectionPatchPath(input.caseId);

    await this.layoutManager.storeAuditArtifact(
      blobPath,
      {
        userId: correction.userId,
        patches: correction.patches,
        correctedAt: correction.correctedAt,
      },
      {
        tenantId: input.tenantId,
        traceId: input.correlation.traceId,
        userId: correction.userId,
      }
    );

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.corrections.push({
      blobPath: this.formatBlobPath(blobPath),
      userId: correction.userId,
      correctedAt: correction.correctedAt,
    });

    bundle.timeline.push({
      eventType: 'correction.stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Store Zoho API interaction
   */
  async storeZohoInteraction(
    input: AuditBundleInput,
    interaction: ZohoInteractionInfo
  ): Promise<AuditBundle> {
    // Store request
    const requestPath = this.layoutManager.getZohoRequestPath(input.caseId);
    await this.layoutManager.storeAuditArtifact(requestPath, interaction.request, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
    });

    // Store response
    const responsePath = this.layoutManager.getZohoResponsePath(input.caseId);
    await this.layoutManager.storeAuditArtifact(responsePath, interaction.response, {
      tenantId: input.tenantId,
      traceId: input.correlation.traceId,
    });

    // Update bundle
    const bundle = await this.getOrCreateBundle(input);
    bundle.zohoPayloads = {
      requestBlobPath: this.formatBlobPath(requestPath),
      responseBlobPath: this.formatBlobPath(responsePath),
      salesOrderId: interaction.salesOrderId,
      calledAt: interaction.calledAt,
    };

    bundle.timeline.push({
      eventType: 'zoho.interaction_stored',
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Get existing bundle or create new one
   */
  async getOrCreateBundle(input: AuditBundleInput): Promise<AuditBundle> {
    const bundlePath = this.layoutManager.getAuditBundlePath(input.caseId);

    try {
      if (await this.layoutManager.blobExists(bundlePath)) {
        return await this.layoutManager.readAuditArtifact<AuditBundle>(bundlePath);
      }
    } catch {
      // Bundle doesn't exist, create new one
    }

    return this.initializeBundle(input);
  }

  /**
   * Get the audit bundle for a case
   */
  async getBundle(caseId: string): Promise<AuditBundle | null> {
    const bundlePath = this.layoutManager.getAuditBundlePath(caseId);

    try {
      if (await this.layoutManager.blobExists(bundlePath)) {
        return await this.layoutManager.readAuditArtifact<AuditBundle>(bundlePath);
      }
    } catch {
      // Bundle doesn't exist
    }

    return null;
  }

  /**
   * Finalize the bundle (seal for audit)
   */
  async finalizeBundle(
    input: AuditBundleInput,
    finalStatus: 'completed' | 'failed' | 'cancelled'
  ): Promise<AuditBundle> {
    const bundle = await this.getOrCreateBundle(input);

    bundle.timeline.push({
      eventType: `bundle.finalized.${finalStatus}`,
      timestamp: new Date().toISOString(),
      sequence: bundle.timeline.length + 1,
    });

    await this.saveBundle(bundle);
    return bundle;
  }

  /**
   * Save the bundle to storage
   */
  private async saveBundle(bundle: AuditBundle): Promise<void> {
    const bundlePath = this.layoutManager.getAuditBundlePath(bundle.caseId);
    await this.layoutManager.storeAuditArtifact(bundlePath, bundle, {
      tenantId: bundle.tenantId,
      version: bundle.version,
    });
  }

  /**
   * Format blob path as string
   */
  private formatBlobPath(blobPath: BlobPath): string {
    return `${blobPath.container}/${blobPath.path}`;
  }

  /**
   * List all artifacts for a case
   */
  async listCaseArtifacts(caseId: string): Promise<{
    incoming: string[];
    audit: string[];
  }> {
    const incoming = await this.layoutManager.listCaseBlobs(
      BlobContainer.OrdersIncoming,
      caseId
    );
    const audit = await this.layoutManager.listCaseBlobs(
      BlobContainer.OrdersAudit,
      caseId
    );

    return { incoming, audit };
  }

  /**
   * Verify bundle integrity by checking all referenced blobs exist
   */
  async verifyBundleIntegrity(caseId: string): Promise<{
    valid: boolean;
    missingBlobs: string[];
  }> {
    const bundle = await this.getBundle(caseId);
    if (!bundle) {
      return { valid: false, missingBlobs: ['bundle.json'] };
    }

    const missingBlobs: string[] = [];
    const pathsToCheck: string[] = [
      bundle.original.blobPath,
      bundle.canonical.blobPath,
      bundle.committee.aggregatedResult,
      ...bundle.committee.modelOutputs.flatMap((m) => [
        m.blobPath,
        m.promptBlobPath,
      ]),
      ...bundle.corrections.map((c) => c.blobPath),
      bundle.zohoPayloads.requestBlobPath,
      bundle.zohoPayloads.responseBlobPath,
    ].filter(Boolean);

    for (const pathStr of pathsToCheck) {
      const [container, ...pathParts] = pathStr.split('/');
      const blobPath: BlobPath = {
        container: container as BlobContainer,
        path: pathParts.join('/'),
      };

      try {
        if (!(await this.layoutManager.blobExists(blobPath))) {
          missingBlobs.push(pathStr);
        }
      } catch {
        missingBlobs.push(pathStr);
      }
    }

    return {
      valid: missingBlobs.length === 0,
      missingBlobs,
    };
  }
}
