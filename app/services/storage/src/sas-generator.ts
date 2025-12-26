/**
 * SAS URL Generator
 *
 * Generates time-limited SAS URLs for audit bundle downloads:
 * - Role-based access controls
 * - Configurable expiry times
 * - IP restrictions (optional)
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  BlobSASSignatureValues,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  SASProtocol,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobContainer,
  BlobPath,
  SasConfig,
  SasPermission,
  SasUrlResult,
  ROLE_SAS_CONFIG,
} from './types.js';

/**
 * SAS URL Generator Service
 *
 * Provides secure, time-limited access to blobs via SAS URLs.
 */
export class SasGeneratorService {
  private blobServiceClient: BlobServiceClient;
  private sharedKeyCredential: StorageSharedKeyCredential | null = null;
  private storageAccountUrl: string;
  private accountName?: string;

  constructor(
    storageAccountUrl: string,
    accountName?: string,
    accountKey?: string
  ) {
    this.storageAccountUrl = storageAccountUrl;
    this.accountName = accountName;

    // Use shared key credential if provided (required for SAS generation)
    if (accountName && accountKey) {
      this.sharedKeyCredential = new StorageSharedKeyCredential(
        accountName,
        accountKey
      );
      this.blobServiceClient = new BlobServiceClient(
        storageAccountUrl,
        this.sharedKeyCredential
      );
    } else {
      // Use managed identity (won't be able to generate SAS URLs)
      const credential = new DefaultAzureCredential();
      this.blobServiceClient = new BlobServiceClient(
        storageAccountUrl,
        credential
      );
    }
  }

  /**
   * Get container client
   */
  private getContainerClient(container: BlobContainer): ContainerClient {
    return this.blobServiceClient.getContainerClient(container);
  }

  /**
   * Map our permission enum to Azure SDK permissions
   */
  private mapPermissions(permissions: SasPermission[]): BlobSASPermissions {
    const sasPermissions = new BlobSASPermissions();

    for (const permission of permissions) {
      switch (permission) {
        case SasPermission.Read:
          sasPermissions.read = true;
          break;
        case SasPermission.Write:
          sasPermissions.write = true;
          break;
        case SasPermission.Delete:
          sasPermissions.delete = true;
          break;
        case SasPermission.List:
          // List is at container level, handled separately
          break;
      }
    }

    return sasPermissions;
  }

  /**
   * Generate a SAS URL for a specific blob
   */
  async generateBlobSasUrl(
    blobPath: BlobPath,
    config: SasConfig,
    ipAddress?: string
  ): Promise<SasUrlResult> {
    // Validate container access
    if (!config.allowedContainers.includes(blobPath.container)) {
      throw new Error(
        `Access denied: Container ${blobPath.container} is not allowed for this role`
      );
    }

    // Check IP restrictions if configured
    if (config.allowedIps && config.allowedIps.length > 0 && ipAddress) {
      const isAllowed = config.allowedIps.some((cidr) =>
        this.isIpInCidr(ipAddress, cidr)
      );
      if (!isAllowed) {
        throw new Error(`Access denied: IP ${ipAddress} is not in allowed list`);
      }
    }

    // Calculate expiry time
    const startsOn = new Date();
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + config.expiryMinutes);

    // Check if we can generate SAS (requires shared key)
    if (!this.sharedKeyCredential) {
      throw new Error(
        'Cannot generate SAS URL: Shared key credential not configured. ' +
          'Use User Delegation SAS or configure account key.'
      );
    }

    const containerClient = this.getContainerClient(blobPath.container);
    const blobClient = containerClient.getBlobClient(blobPath.path);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob not found: ${blobPath.container}/${blobPath.path}`);
    }

    // Generate SAS token
    const sasOptions: BlobSASSignatureValues = {
      containerName: blobPath.container,
      blobName: blobPath.path,
      permissions: this.mapPermissions(config.permissions),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
      // Add IP restriction if single IP specified
      ipRange: ipAddress
        ? { start: ipAddress, end: ipAddress }
        : undefined,
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      this.sharedKeyCredential
    ).toString();

    const sasUrl = `${blobClient.url}?${sasToken}`;

    return {
      sasUrl,
      expiresAt: expiresOn.toISOString(),
      container: blobPath.container,
      blobPath: blobPath.path,
      permissions: config.permissions,
    };
  }

  /**
   * Generate a SAS URL for a role
   */
  async generateSasForRole(
    role: string,
    blobPath: BlobPath,
    ipAddress?: string
  ): Promise<SasUrlResult> {
    const config = ROLE_SAS_CONFIG[role];

    if (!config) {
      throw new Error(`Unknown role: ${role}. Valid roles: ${Object.keys(ROLE_SAS_CONFIG).join(', ')}`);
    }

    return this.generateBlobSasUrl(blobPath, config, ipAddress);
  }

  /**
   * Generate a SAS URL for audit bundle download
   */
  async generateAuditBundleSas(
    caseId: string,
    role: string,
    ipAddress?: string
  ): Promise<SasUrlResult> {
    const blobPath: BlobPath = {
      container: BlobContainer.OrdersAudit,
      path: `${caseId}/bundle.json`,
    };

    return this.generateSasForRole(role, blobPath, ipAddress);
  }

  /**
   * Generate a SAS URL for original file download
   */
  async generateOriginalFileSas(
    caseId: string,
    filename: string,
    role: string,
    ipAddress?: string
  ): Promise<SasUrlResult> {
    // Only auditors can access original files
    if (role !== 'OpsAuditor') {
      throw new Error('Access denied: Only auditors can access original files');
    }

    const ext = filename.match(/\.[^.]*$/)?.[0] || '.xlsx';
    const blobPath: BlobPath = {
      container: BlobContainer.OrdersIncoming,
      path: `${caseId}/original${ext}`,
    };

    return this.generateSasForRole(role, blobPath, ipAddress);
  }

  /**
   * Generate User Delegation SAS (uses AAD authentication)
   *
   * This is preferred over shared key for production environments.
   * Requires:
   * - Storage Blob Data Contributor role on the storage account
   * - Azure AD authentication
   */
  async generateUserDelegationSas(
    blobPath: BlobPath,
    expiryMinutes: number,
    permissions: SasPermission[]
  ): Promise<SasUrlResult> {
    const startsOn = new Date();
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

    // Get user delegation key (valid for up to 7 days)
    const userDelegationKeyStart = new Date();
    const userDelegationKeyExpiry = new Date();
    userDelegationKeyExpiry.setDate(userDelegationKeyExpiry.getDate() + 1);

    const userDelegationKey = await this.blobServiceClient.getUserDelegationKey(
      userDelegationKeyStart,
      userDelegationKeyExpiry
    );

    const containerClient = this.getContainerClient(blobPath.container);
    const blobClient = containerClient.getBlobClient(blobPath.path);

    // Generate SAS token with user delegation key
    const sasOptions: BlobSASSignatureValues = {
      containerName: blobPath.container,
      blobName: blobPath.path,
      permissions: this.mapPermissions(permissions),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      userDelegationKey,
      this.extractAccountName()
    ).toString();

    const sasUrl = `${blobClient.url}?${sasToken}`;

    return {
      sasUrl,
      expiresAt: expiresOn.toISOString(),
      container: blobPath.container,
      blobPath: blobPath.path,
      permissions,
    };
  }

  /**
   * Extract account name from storage URL
   */
  private extractAccountName(): string {
    if (this.accountName) {
      return this.accountName;
    }

    // Extract from URL: https://<account>.blob.core.windows.net
    const match = this.storageAccountUrl.match(
      /https:\/\/([^.]+)\.blob\.core\.windows\.net/
    );
    if (!match) {
      throw new Error('Cannot extract account name from storage URL');
    }
    return match[1];
  }

  /**
   * Check if an IP is within a CIDR range
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    // Handle single IP (no CIDR notation)
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipParts = ip.split('.').map((p) => parseInt(p));
    const rangeParts = range.split('.').map((p) => parseInt(p));

    const ipNum =
      (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum =
      (rangeParts[0] << 24) |
      (rangeParts[1] << 16) |
      (rangeParts[2] << 8) |
      rangeParts[3];

    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * Validate a SAS URL (check if still valid)
   */
  parseSasUrl(sasUrl: string): {
    container: string;
    blobPath: string;
    expiresAt: Date | null;
    isExpired: boolean;
  } {
    try {
      const url = new URL(sasUrl);
      const se = url.searchParams.get('se'); // Expiry time

      const pathParts = url.pathname.split('/').filter(Boolean);
      const container = pathParts[0] || '';
      const blobPath = pathParts.slice(1).join('/');

      const expiresAt = se ? new Date(se) : null;
      const isExpired = expiresAt ? expiresAt < new Date() : false;

      return {
        container,
        blobPath,
        expiresAt,
        isExpired,
      };
    } catch {
      throw new Error('Invalid SAS URL format');
    }
  }

  /**
   * Revoke access by regenerating storage account keys
   *
   * Note: This is a drastic action that affects all SAS tokens.
   * Use with caution and only when security breach is suspected.
   */
  async revokeAllSasTokens(): Promise<void> {
    // This would require Azure Management SDK
    throw new Error(
      'Revoking SAS tokens requires regenerating storage account keys. ' +
        'This should be done via Azure Portal or Azure CLI.'
    );
  }
}

/**
 * Factory function to create SAS generator with proper credentials
 */
export function createSasGenerator(
  storageAccountUrl: string,
  options?: {
    accountName?: string;
    accountKey?: string;
  }
): SasGeneratorService {
  return new SasGeneratorService(
    storageAccountUrl,
    options?.accountName,
    options?.accountKey
  );
}
