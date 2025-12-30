/**
 * Finalize Audit Activity (Temporal)
 *
 * Gathers all artifacts from blob storage for a case and creates
 * an audit manifest JSON file in the WORM container for long-term retention.
 *
 * The audit bundle includes references to:
 * - Original uploaded file
 * - Canonical JSON extraction
 * - Committee model outputs and prompts
 * - User correction patches
 * - Zoho API request/response payloads
 * - Complete event timeline
 */

import { log } from '@temporalio/activity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'crypto';
import { getCasesRepository } from '../repositories/index.js';
import { getEventsRepository } from '../repositories/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for FinalizeAudit activity
 */
export interface FinalizeAuditInput {
  caseId: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
  /** Zoho order ID to include in audit manifest */
  zohoOrderId?: string;
}

/**
 * Artifact reference in the audit manifest
 */
export interface ArtifactReference {
  /** Relative blob path within the container */
  blobPath: string;
  /** SHA-256 hash of the content */
  sha256?: string;
  /** Size in bytes */
  sizeBytes?: number;
  /** Content type */
  contentType?: string;
  /** Creation/upload timestamp */
  timestamp?: string;
}

/**
 * Audit manifest structure - comprehensive record of all case artifacts
 */
export interface AuditManifest {
  /** Manifest format version */
  version: '1.0';
  /** Case ID */
  caseId: string;
  /** Tenant ID */
  tenantId: string;
  /** Manifest creation timestamp (ISO 8601) */
  createdAt: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** User who initiated the workflow */
  userId?: string;

  /** Original uploaded file reference */
  original?: ArtifactReference;

  /** Canonical JSON extraction reference */
  canonical?: ArtifactReference;

  /** Committee outputs */
  committee?: {
    /** Individual model outputs */
    models: Array<{
      modelId: string;
      output?: ArtifactReference;
      prompt?: ArtifactReference;
    }>;
    /** Aggregated result */
    aggregated?: ArtifactReference;
    /** Execution timestamp */
    executedAt?: string;
  };

  /** User correction patches */
  corrections?: ArtifactReference[];

  /** User selections (customer/items) */
  selections?: ArtifactReference[];

  /** Zoho API interactions */
  zoho?: {
    request?: ArtifactReference;
    response?: ArtifactReference;
    salesOrderId?: string;
    salesOrderNumber?: string;
  };

  /** Complete event timeline from Cosmos */
  timeline?: Array<{
    eventType: string;
    timestamp: string;
    sequence: number;
    userId?: string;
    metadata?: Record<string, unknown>;
  }>;

  /** Case final status */
  finalStatus: string;

  /** All artifacts discovered */
  allArtifacts: ArtifactReference[];
}

/**
 * Output from FinalizeAudit activity
 */
export interface FinalizeAuditOutput {
  success: boolean;
  /** Path to the audit manifest */
  manifestPath?: string;
  /** SHA-256 hash of the manifest */
  manifestSha256?: string;
  /** Number of artifacts collected */
  artifactCount?: number;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const AUDIT_CONTAINER = 'orders-audit';
const INCOMING_CONTAINER = 'orders-incoming';
const MANIFEST_VERSION = '1.0';

// ============================================================================
// Activity Implementation
// ============================================================================

/**
 * Finalizes the audit bundle by gathering all artifacts and creating manifest
 *
 * @param input - The input containing caseId and tenantId
 * @returns Result with manifest path and artifact count
 */
export async function finalizeAudit(input: FinalizeAuditInput): Promise<FinalizeAuditOutput> {
  const { caseId, tenantId, userId, correlationId, zohoOrderId } = input;

  log.info('Starting audit finalization', { caseId, tenantId, zohoOrderId });

  try {
    // Initialize Azure Blob client
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!accountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME not configured');
    }

    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );

    // Get container clients
    const auditContainer = blobServiceClient.getContainerClient(AUDIT_CONTAINER);
    const incomingContainer = blobServiceClient.getContainerClient(INCOMING_CONTAINER);

    // Gather all artifacts for this case
    const allArtifacts: ArtifactReference[] = [];

    // 1. Collect artifacts from orders-incoming container
    const incomingArtifacts = await listCaseArtifacts(incomingContainer, caseId);
    allArtifacts.push(...incomingArtifacts);

    // 2. Collect artifacts from orders-audit container
    const auditArtifacts = await listCaseArtifacts(auditContainer, caseId);
    allArtifacts.push(...auditArtifacts);

    log.info('Collected artifacts', {
      caseId,
      incomingCount: incomingArtifacts.length,
      auditCount: auditArtifacts.length,
      totalCount: allArtifacts.length,
    });

    // 3. Get case data from Cosmos
    const casesRepo = getCasesRepository();
    const caseData = await casesRepo.getCase(caseId, tenantId);

    // 4. Get events timeline from Cosmos
    const eventsRepo = getEventsRepository();
    const events = await eventsRepo.getEventsByCaseId(caseId);

    // 5. Build the audit manifest
    const manifest: AuditManifest = {
      version: MANIFEST_VERSION,
      caseId,
      tenantId,
      createdAt: new Date().toISOString(),
      correlationId,
      userId,
      finalStatus: caseData?.status || 'unknown',
      allArtifacts,
    };

    // Populate specific artifact references
    manifest.original = findArtifact(incomingArtifacts, 'original');
    manifest.canonical = findArtifact(auditArtifacts, 'canonical.json');

    // Committee outputs
    const committeeArtifacts = auditArtifacts.filter(a => a.blobPath.includes('/committee/'));
    if (committeeArtifacts.length > 0) {
      const modelOutputs = extractCommitteeOutputs(committeeArtifacts);
      manifest.committee = {
        models: modelOutputs,
        aggregated: findArtifact(auditArtifacts, 'committee/aggregated'),
      };
    }

    // Corrections
    const correctionArtifacts = auditArtifacts.filter(a => a.blobPath.includes('/corrections/'));
    if (correctionArtifacts.length > 0) {
      manifest.corrections = correctionArtifacts;
    }

    // Selections
    const selectionArtifacts = auditArtifacts.filter(a => a.blobPath.includes('/selections/'));
    if (selectionArtifacts.length > 0) {
      manifest.selections = selectionArtifacts;
    }

    // Zoho payloads
    const zohoRequest = findArtifact(auditArtifacts, 'zoho/request.json');
    const zohoResponse = findArtifact(auditArtifacts, 'zoho/response.json');
    // Use zohoOrderId from input (passed from workflow) or fallback to caseData
    const finalZohoOrderId = zohoOrderId || caseData?.zohoOrderId;
    if (zohoRequest || zohoResponse || finalZohoOrderId) {
      manifest.zoho = {
        request: zohoRequest,
        response: zohoResponse,
        salesOrderId: finalZohoOrderId,
        salesOrderNumber: caseData?.zohoOrderNumber,
      };
    }

    // Event timeline
    if (events && events.length > 0) {
      manifest.timeline = events.map((event, index) => ({
        eventType: event.type,
        timestamp: event.timestamp,
        sequence: index + 1,
        userId: event.userId,
        metadata: event.metadata,
      }));
    }

    // 6. Store the manifest in WORM container
    const manifestPath = `${caseId}/audit/audit_manifest.json`;
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    const manifestSha256 = createHash('sha256').update(manifestBuffer).digest('hex');

    const blockBlobClient = auditContainer.getBlockBlobClient(manifestPath);
    await blockBlobClient.upload(manifestBuffer, manifestBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
      },
      metadata: {
        caseId,
        tenantId,
        sha256: manifestSha256,
        version: MANIFEST_VERSION,
        artifactCount: String(allArtifacts.length),
        createdAt: manifest.createdAt,
      },
    });

    log.info('Audit manifest created', {
      caseId,
      manifestPath,
      manifestSha256,
      artifactCount: allArtifacts.length,
      timelineEvents: manifest.timeline?.length || 0,
    });

    return {
      success: true,
      manifestPath,
      manifestSha256,
      artifactCount: allArtifacts.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to finalize audit', {
      caseId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * List all artifacts for a case in a container
 */
async function listCaseArtifacts(
  containerClient: ContainerClient,
  caseId: string
): Promise<ArtifactReference[]> {
  const artifacts: ArtifactReference[] = [];

  try {
    for await (const blob of containerClient.listBlobsFlat({
      prefix: `${caseId}/`,
      includeMetadata: true,
    })) {
      artifacts.push({
        blobPath: blob.name,
        sha256: blob.metadata?.sha256,
        sizeBytes: blob.properties.contentLength,
        contentType: blob.properties.contentType,
        timestamp: blob.properties.createdOn?.toISOString() || blob.properties.lastModified?.toISOString(),
      });
    }
  } catch (error) {
    log.warn('Error listing artifacts', {
      container: containerClient.containerName,
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return artifacts;
}

/**
 * Find a specific artifact by partial path match
 */
function findArtifact(
  artifacts: ArtifactReference[],
  pathPattern: string
): ArtifactReference | undefined {
  return artifacts.find(a => a.blobPath.includes(pathPattern));
}

/**
 * Extract committee model outputs from artifacts
 */
function extractCommitteeOutputs(
  artifacts: ArtifactReference[]
): Array<{ modelId: string; output?: ArtifactReference; prompt?: ArtifactReference }> {
  // Group by model ID
  const modelGroups = new Map<string, { output?: ArtifactReference; prompt?: ArtifactReference }>();

  for (const artifact of artifacts) {
    // Extract model ID from path like "{caseId}/committee/{modelId}/output.json"
    const pathParts = artifact.blobPath.split('/');
    const committeeIndex = pathParts.findIndex(p => p === 'committee');
    if (committeeIndex >= 0 && pathParts[committeeIndex + 1]) {
      const modelId = pathParts[committeeIndex + 1];

      if (!modelGroups.has(modelId)) {
        modelGroups.set(modelId, {});
      }

      const group = modelGroups.get(modelId)!;
      if (artifact.blobPath.includes('output.json')) {
        group.output = artifact;
      } else if (artifact.blobPath.includes('prompt.json')) {
        group.prompt = artifact;
      }
    }
  }

  return Array.from(modelGroups.entries()).map(([modelId, group]) => ({
    modelId,
    output: group.output,
    prompt: group.prompt,
  }));
}
