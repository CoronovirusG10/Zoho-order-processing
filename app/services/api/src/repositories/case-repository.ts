import { CosmosClient, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { Case, CaseFilters, CaseStatus } from '../types.js';

/**
 * Repository for Case records in Cosmos DB
 */
export class CaseRepository {
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
   * Create a new case
   */
  async create(caseData: Omit<Case, 'id' | '_partitionKey'>): Promise<Case> {
    const item: Case = {
      ...caseData,
      id: caseData.caseId,
      _partitionKey: caseData.tenantId,
    };

    const { resource } = await this.container.items.create(item);
    return resource as Case;
  }

  /**
   * Get case by ID
   */
  async findById(caseId: string, tenantId: string): Promise<Case | null> {
    try {
      const { resource } = await this.container.item(caseId, tenantId).read();
      return resource as Case | null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update case
   */
  async update(
    caseId: string,
    tenantId: string,
    updates: Partial<Case>
  ): Promise<Case> {
    const existing = await this.findById(caseId, tenantId);
    if (!existing) {
      throw new Error('Case not found');
    }

    const updated: Case = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    const { resource } = await this.container
      .item(caseId, tenantId)
      .replace(updated);
    return resource as Case;
  }

  /**
   * List cases with filters
   */
  async list(filters: CaseFilters, tenantId: string): Promise<Case[]> {
    const querySpec = this.buildQuery(filters, tenantId);

    const { resources } = await this.container.items
      .query(querySpec)
      .fetchAll();

    return resources as Case[];
  }

  /**
   * Count total cases matching filters
   */
  async count(filters: CaseFilters, tenantId: string): Promise<number> {
    const baseQuery = this.buildQuery(filters, tenantId, true);

    const { resources } = await this.container.items
      .query(baseQuery)
      .fetchAll();

    return resources[0]?.count || 0;
  }

  /**
   * Build Cosmos DB query from filters
   */
  private buildQuery(
    filters: CaseFilters,
    tenantId: string,
    countOnly = false
  ): {
    query: string;
    parameters: Array<{ name: string; value: any }>;
  } {
    const conditions: string[] = ['c.tenantId = @tenantId'];
    const parameters: Array<{ name: string; value: any }> = [
      { name: '@tenantId', value: tenantId },
    ];

    // Status filter
    if (filters.status && filters.status.length > 0) {
      conditions.push('c.status IN (@status)');
      parameters.push({ name: '@status', value: filters.status });
    }

    // User filter
    if (filters.userId) {
      conditions.push('c.userId = @userId');
      parameters.push({ name: '@userId', value: filters.userId });
    }

    // Customer filter (case-insensitive contains)
    if (filters.customer) {
      conditions.push('CONTAINS(LOWER(c.customerName), LOWER(@customer))');
      parameters.push({ name: '@customer', value: filters.customer });
    }

    // Date range filters
    if (filters.dateFrom) {
      conditions.push('c.createdAt >= @dateFrom');
      parameters.push({ name: '@dateFrom', value: filters.dateFrom });
    }

    if (filters.dateTo) {
      conditions.push('c.createdAt <= @dateTo');
      parameters.push({ name: '@dateTo', value: filters.dateTo });
    }

    const whereClause = conditions.join(' AND ');

    let query: string;
    if (countOnly) {
      query = `SELECT VALUE COUNT(1) as count FROM c WHERE ${whereClause}`;
    } else {
      query = `SELECT * FROM c WHERE ${whereClause} ORDER BY c.lastActivityAt DESC`;

      // Pagination
      if (filters.limit) {
        query += ` OFFSET ${filters.offset || 0} LIMIT ${filters.limit}`;
      }
    }

    return { query, parameters };
  }

  /**
   * Update case status
   */
  async updateStatus(
    caseId: string,
    tenantId: string,
    status: CaseStatus
  ): Promise<void> {
    await this.update(caseId, tenantId, { status });
  }

  /**
   * Delete case (soft delete by status)
   */
  async delete(caseId: string, tenantId: string): Promise<void> {
    await this.updateStatus(caseId, tenantId, CaseStatus.Cancelled);
  }
}
