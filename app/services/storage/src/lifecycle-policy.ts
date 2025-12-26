/**
 * Lifecycle Policy Configuration
 *
 * Manages Azure Blob Storage lifecycle policies for 5+ year retention:
 * - WORM (Write Once Read Many) policy configuration
 * - Lifecycle: hot -> cool -> archive
 * - Immutability enforcement
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlobImmutabilityPolicy,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobContainer,
  WormPolicy,
  LifecycleConfig,
  LifecycleRule,
  StorageTier,
} from './types.js';

/**
 * Default lifecycle configuration for 5+ year retention
 *
 * Timeline:
 * - Hot tier: 0-30 days (active processing)
 * - Cool tier: 30-365 days (occasional access)
 * - Archive tier: 365+ days (rare access, long-term retention)
 * - Delete: Never (audit retention)
 */
export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  rules: [
    {
      name: 'orders-incoming-lifecycle',
      prefix: 'orders-incoming/',
      daysToCool: 30, // Move to cool after 30 days
      daysToArchive: 365, // Move to archive after 1 year
      daysToDelete: 0, // Never delete (0 = disabled)
    },
    {
      name: 'orders-audit-lifecycle',
      prefix: 'orders-audit/',
      daysToCool: 30, // Move to cool after 30 days
      daysToArchive: 365, // Move to archive after 1 year
      daysToDelete: 0, // Never delete (audit retention)
    },
    {
      name: 'logs-archive-lifecycle',
      prefix: 'logs-archive/',
      daysToCool: 7, // Move to cool after 7 days (logs accessed less frequently)
      daysToArchive: 90, // Move to archive after 90 days
      daysToDelete: 0, // Never delete (audit retention)
    },
  ],
};

/**
 * Default WORM policies for containers
 *
 * Note: WORM policies require Azure Blob Storage with versioning enabled
 * and immutable storage feature enabled at the account level.
 */
export const DEFAULT_WORM_POLICIES: Record<BlobContainer, WormPolicy> = {
  [BlobContainer.OrdersIncoming]: {
    enabled: true,
    retentionDays: 1825, // 5 years
    locked: false, // Can be locked after validation
  },
  [BlobContainer.OrdersAudit]: {
    enabled: true,
    retentionDays: 2555, // 7 years (extended for audit)
    locked: false, // Can be locked after validation
  },
  [BlobContainer.LogsArchive]: {
    enabled: true,
    retentionDays: 1825, // 5 years
    locked: false, // Can be locked after validation
  },
};

/**
 * Lifecycle Policy Manager
 *
 * Manages blob lifecycle and immutability policies for long-term retention.
 */
export class LifecyclePolicyManager {
  private blobServiceClient: BlobServiceClient;
  private containerClients: Map<BlobContainer, ContainerClient> = new Map();

  constructor(storageAccountUrl: string) {
    const credential = new DefaultAzureCredential();
    this.blobServiceClient = new BlobServiceClient(
      storageAccountUrl,
      credential
    );
  }

  /**
   * Get or create a container client
   */
  private async getContainerClient(
    container: BlobContainer
  ): Promise<ContainerClient> {
    let client = this.containerClients.get(container);

    if (!client) {
      client = this.blobServiceClient.getContainerClient(container);
      await client.createIfNotExists();
      this.containerClients.set(container, client);
    }

    return client;
  }

  /**
   * Generate Azure Lifecycle Management policy JSON
   *
   * This is the format required by Azure's Management API for lifecycle policies.
   * Deploy this via Azure Portal, ARM template, or Azure CLI.
   */
  generateLifecyclePolicyJson(config: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG): object {
    return {
      rules: config.rules.map((rule) => ({
        enabled: true,
        name: rule.name,
        type: 'Lifecycle',
        definition: {
          filters: {
            blobTypes: ['blockBlob', 'appendBlob'],
            prefixMatch: [rule.prefix],
          },
          actions: {
            baseBlob: {
              tierToCool: rule.daysToCool > 0 ? {
                daysAfterModificationGreaterThan: rule.daysToCool,
              } : undefined,
              tierToArchive: rule.daysToArchive > 0 ? {
                daysAfterModificationGreaterThan: rule.daysToArchive,
              } : undefined,
              delete: rule.daysToDelete > 0 ? {
                daysAfterModificationGreaterThan: rule.daysToDelete,
              } : undefined,
            },
            snapshot: {
              tierToCool: rule.daysToCool > 0 ? {
                daysAfterCreationGreaterThan: rule.daysToCool,
              } : undefined,
              tierToArchive: rule.daysToArchive > 0 ? {
                daysAfterCreationGreaterThan: rule.daysToArchive,
              } : undefined,
            },
            version: {
              tierToCool: rule.daysToCool > 0 ? {
                daysAfterCreationGreaterThan: rule.daysToCool,
              } : undefined,
              tierToArchive: rule.daysToArchive > 0 ? {
                daysAfterCreationGreaterThan: rule.daysToArchive,
              } : undefined,
            },
          },
        },
      })),
    };
  }

  /**
   * Generate WORM policy configuration for deployment
   *
   * This is for documentation/deployment purposes.
   * WORM policies must be set via Azure Portal or ARM templates.
   */
  generateWormPolicyConfig(
    policies: Record<BlobContainer, WormPolicy> = DEFAULT_WORM_POLICIES
  ): object {
    return {
      description: 'WORM policies for immutable audit storage',
      note: 'Deploy via Azure Portal > Storage Account > Containers > Access Policy',
      containers: Object.entries(policies).map(([container, policy]) => ({
        containerName: container,
        immutableStorage: {
          enabled: policy.enabled,
          immutabilityPolicy: {
            immutabilityPeriodSinceCreationInDays: policy.retentionDays,
            allowProtectedAppendWrites: true, // Allow append blobs (for JSONL logs)
            state: policy.locked ? 'Locked' : 'Unlocked',
          },
        },
      })),
    };
  }

  /**
   * Set immutability policy on a blob
   *
   * Note: Requires container-level immutability policy to be configured first.
   */
  async setBlobImmutability(
    container: BlobContainer,
    blobPath: string,
    retentionDays: number
  ): Promise<void> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);

    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + retentionDays);

    const policy: BlobImmutabilityPolicy = {
      expiriesOn: expiresOn,
      policyMode: 'Unlocked', // Can be changed to 'Locked' for permanent retention
    };

    await blobClient.setImmutabilityPolicy(policy);
  }

  /**
   * Delete immutability policy from a blob (only if unlocked)
   */
  async deleteBlobImmutability(
    container: BlobContainer,
    blobPath: string
  ): Promise<void> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);

    await blobClient.deleteImmutabilityPolicy();
  }

  /**
   * Set legal hold on a blob
   *
   * Legal hold prevents deletion even after retention period expires.
   */
  async setLegalHold(
    container: BlobContainer,
    blobPath: string,
    hold: boolean
  ): Promise<void> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);

    await blobClient.setLegalHold(hold);
  }

  /**
   * Move blob to a specific tier
   */
  async setTier(
    container: BlobContainer,
    blobPath: string,
    tier: StorageTier
  ): Promise<void> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);

    await blobClient.setAccessTier(tier);
  }

  /**
   * Rehydrate a blob from archive tier
   *
   * Note: Rehydration can take up to 15 hours for standard priority.
   */
  async rehydrateFromArchive(
    container: BlobContainer,
    blobPath: string,
    targetTier: StorageTier.Hot | StorageTier.Cool = StorageTier.Hot,
    priority: 'Standard' | 'High' = 'Standard'
  ): Promise<void> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);

    await blobClient.setAccessTier(targetTier, {
      rehydratePriority: priority,
    });
  }

  /**
   * Get blob tier information
   */
  async getBlobTier(
    container: BlobContainer,
    blobPath: string
  ): Promise<{
    tier: string;
    archiveStatus?: string;
    rehydrationPriority?: string;
  }> {
    const containerClient = await this.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);
    const properties = await blobClient.getProperties();

    return {
      tier: properties.accessTier || 'Unknown',
      archiveStatus: properties.archiveStatus,
      rehydrationPriority: properties.rehydratePriority,
    };
  }

  /**
   * Validate that a container has proper retention policy
   */
  async validateContainerPolicy(
    container: BlobContainer,
    _expectedRetentionDays: number
  ): Promise<{
    valid: boolean;
    currentRetentionDays?: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const containerClient = await this.getContainerClient(container);
      const properties = await containerClient.getProperties();

      // Check if immutable storage is configured
      // Note: This information may not be available via SDK, check Azure Portal
      if (!properties.hasImmutabilityPolicy) {
        issues.push(
          `Container ${container} does not have an immutability policy configured`
        );
      }

      // Additional validation would require Azure Management SDK
      // to check the actual retention period

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        issues: [`Failed to validate container ${container}: ${message}`],
      };
    }
  }

  /**
   * Export lifecycle and WORM configuration for deployment
   */
  exportConfiguration(): {
    lifecycle: object;
    worm: object;
    armTemplate: object;
  } {
    const lifecycle = this.generateLifecyclePolicyJson();
    const worm = this.generateWormPolicyConfig();

    // Generate ARM template snippet
    const armTemplate = {
      '$schema':
        'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
      contentVersion: '1.0.0.0',
      resources: [
        {
          type: 'Microsoft.Storage/storageAccounts/managementPolicies',
          apiVersion: '2023-01-01',
          name: '[concat(parameters(\'storageAccountName\'), \'/default\')]',
          properties: {
            policy: lifecycle,
          },
        },
      ],
    };

    return { lifecycle, worm, armTemplate };
  }

  /**
   * Get recommended tier for a blob based on age
   */
  getRecommendedTier(
    lastModified: Date,
    rule: LifecycleRule
  ): StorageTier {
    const ageInDays = Math.floor(
      (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (rule.daysToArchive > 0 && ageInDays >= rule.daysToArchive) {
      return StorageTier.Archive;
    }

    if (rule.daysToCool > 0 && ageInDays >= rule.daysToCool) {
      return StorageTier.Cool;
    }

    return StorageTier.Hot;
  }
}

/**
 * Deployment instructions for lifecycle and WORM policies
 */
export const DEPLOYMENT_INSTRUCTIONS = `
# Azure Blob Storage Lifecycle and WORM Policy Deployment

## Prerequisites
1. Azure Storage Account with:
   - Hierarchical namespace DISABLED (for WORM support)
   - Blob versioning ENABLED
   - Point-in-time restore DISABLED (incompatible with immutable storage)

## Deploy Lifecycle Policy

### Using Azure CLI:
\`\`\`bash
az storage account management-policy create \\
  --account-name <storage-account-name> \\
  --resource-group <resource-group> \\
  --policy @lifecycle-policy.json
\`\`\`

### Using Azure Portal:
1. Navigate to Storage Account > Data management > Lifecycle management
2. Add rules for each container prefix

## Deploy WORM Policy

### Using Azure CLI:
\`\`\`bash
# Enable version-level WORM on storage account
az storage account update \\
  --name <storage-account-name> \\
  --resource-group <resource-group> \\
  --enable-versioning true

# Set container-level immutability policy
az storage container immutability-policy create \\
  --container-name orders-audit \\
  --account-name <storage-account-name> \\
  --period 2555 \\
  --allow-protected-append-writes true

# Lock the policy (IRREVERSIBLE!)
# az storage container immutability-policy lock \\
#   --container-name orders-audit \\
#   --account-name <storage-account-name>
\`\`\`

### Using Azure Portal:
1. Navigate to Storage Account > Containers
2. Select container > Access policy
3. Configure time-based retention policy

## Validation
Run the validation script to verify policies are correctly applied.
`;
