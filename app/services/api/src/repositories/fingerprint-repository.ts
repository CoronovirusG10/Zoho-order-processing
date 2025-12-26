import { CosmosClient, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { Fingerprint } from '../types.js';

/**
 * Repository for Fingerprint records in Cosmos DB
 * Used for idempotency checking
 */
export class FingerprintRepository {
  private container: Container;

  constructor(
    private endpoint: string,
    private databaseId: string,
    private containerId: string
  ) {
    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ endpoint, aadCredentials: credential });
    this.container = client.database(databaseId).container(containerId);
  }

  /**
   * Create or find existing fingerprint (upsert with conflict detection)
   */
  async upsert(
    fingerprint: string,
    caseId: string,
    tenantId: string
  ): Promise<{ existing: boolean; record: Fingerprint }> {
    const item: Fingerprint = {
      id: fingerprint,
      fingerprint,
      caseId,
      tenantId,
      createdAt: new Date().toISOString(),
      _partitionKey: tenantId,
    };

    try {
      // Try to create (will fail if exists)
      const { resource } = await this.container.items.create(item);
      return {
        existing: false,
        record: resource as Fingerprint,
      };
    } catch (error: any) {
      if (error.code === 409) {
        // Conflict - fingerprint already exists
        const existing = await this.findByFingerprint(fingerprint, tenantId);
        if (!existing) {
          throw new Error('Fingerprint conflict but not found');
        }
        return {
          existing: true,
          record: existing,
        };
      }
      throw error;
    }
  }

  /**
   * Find fingerprint record
   */
  async findByFingerprint(
    fingerprint: string,
    tenantId: string
  ): Promise<Fingerprint | null> {
    try {
      const { resource } = await this.container
        .item(fingerprint, tenantId)
        .read();
      return resource as Fingerprint | null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update fingerprint with Zoho sales order ID
   */
  async updateZohoId(
    fingerprint: string,
    tenantId: string,
    zohoSalesOrderId: string
  ): Promise<void> {
    const existing = await this.findByFingerprint(fingerprint, tenantId);
    if (!existing) {
      throw new Error('Fingerprint not found');
    }

    const updated: Fingerprint = {
      ...existing,
      zohoSalesOrderId,
    };

    await this.container.item(fingerprint, tenantId).replace(updated);
  }

  /**
   * Find fingerprints for a case
   */
  async findByCaseId(caseId: string, tenantId: string): Promise<Fingerprint[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId AND c.tenantId = @tenantId',
      parameters: [
        { name: '@caseId', value: caseId },
        { name: '@tenantId', value: tenantId },
      ],
    };

    const { resources } = await this.container.items
      .query(querySpec)
      .fetchAll();

    return resources as Fingerprint[];
  }
}
