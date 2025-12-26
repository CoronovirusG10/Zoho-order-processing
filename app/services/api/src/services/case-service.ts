import { v4 as uuidv4 } from 'uuid';
import {
  Case,
  CaseFilters,
  CasePage,
  CaseStatus,
  CreateCaseInput,
  Correction,
  AuthContext,
  UserRole,
} from '../types.js';
import { CaseRepository } from '../repositories/case-repository.js';
import { NotFoundError, ForbiddenError } from '../middleware/error-handler.js';

/**
 * Service for case management operations
 */
export class CaseService {
  constructor(private caseRepo: CaseRepository) {}

  /**
   * Create a new case
   */
  async createCase(input: CreateCaseInput): Promise<Case> {
    const caseId = uuidv4();
    const now = new Date().toISOString();

    const caseData: Omit<Case, 'id' | '_partitionKey'> = {
      caseId,
      tenantId: input.tenantId,
      userId: input.userId,
      userDisplayName: input.userDisplayName,
      status: CaseStatus.Processing,
      blobUrl: input.blobUrl,
      fileName: input.fileName,
      fileSha256: input.fileSha256,
      correlationId: input.correlationId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    return await this.caseRepo.create(caseData);
  }

  /**
   * Get case by ID with authorization check
   */
  async getCase(caseId: string, auth: AuthContext): Promise<Case> {
    const caseRecord = await this.caseRepo.findById(caseId, auth.tenantId);

    if (!caseRecord) {
      throw new NotFoundError('Case');
    }

    // Authorization: user must own the case or be a manager/auditor
    if (!this.canAccessCase(caseRecord, auth)) {
      throw new ForbiddenError('You do not have access to this case');
    }

    return caseRecord;
  }

  /**
   * List cases with filters and authorization
   */
  async listCases(filters: CaseFilters, auth: AuthContext): Promise<CasePage> {
    // Apply authorization filter
    const effectiveFilters = { ...filters };

    // Non-managers can only see their own cases
    if (!this.hasRole(auth, UserRole.SalesManager)) {
      effectiveFilters.userId = auth.userId;
    } else if (!effectiveFilters.userId) {
      // Managers can see all team cases (no userId filter)
      // If they specified a userId, respect it
    }

    // Get cases and total count
    const [cases, total] = await Promise.all([
      this.caseRepo.list(effectiveFilters, auth.tenantId),
      this.caseRepo.count(effectiveFilters, auth.tenantId),
    ]);

    return {
      cases,
      total,
      limit: effectiveFilters.limit || 50,
      offset: effectiveFilters.offset || 0,
    };
  }

  /**
   * Update case status
   */
  async updateStatus(
    caseId: string,
    tenantId: string,
    status: CaseStatus
  ): Promise<void> {
    await this.caseRepo.updateStatus(caseId, tenantId, status);
  }

  /**
   * Apply user corrections to a case
   */
  async applyCorrections(
    caseId: string,
    tenantId: string,
    corrections: Correction[]
  ): Promise<void> {
    const caseRecord = await this.caseRepo.findById(caseId, tenantId);

    if (!caseRecord) {
      throw new NotFoundError('Case');
    }

    // Store corrections metadata
    // The actual correction processing happens in the workflow/parser service
    await this.caseRepo.update(caseId, tenantId, {
      status: CaseStatus.Processing,
      lastActivityAt: new Date().toISOString(),
    });
  }

  /**
   * Update case with customer information
   */
  async updateCustomer(
    caseId: string,
    tenantId: string,
    customerName: string
  ): Promise<void> {
    await this.caseRepo.update(caseId, tenantId, { customerName });
  }

  /**
   * Update case with Zoho sales order information
   */
  async updateZohoOrder(
    caseId: string,
    tenantId: string,
    zohoSalesOrderId: string,
    zohoSalesOrderNumber: string
  ): Promise<void> {
    await this.caseRepo.update(caseId, tenantId, {
      zohoSalesOrderId,
      zohoSalesOrderNumber,
      status: CaseStatus.DraftCreated,
    });
  }

  /**
   * Check if user can access a case
   */
  private canAccessCase(caseRecord: Case, auth: AuthContext): boolean {
    // User owns the case
    if (caseRecord.userId === auth.userId) {
      return true;
    }

    // User is a manager or auditor
    if (
      this.hasRole(auth, UserRole.SalesManager) ||
      this.hasRole(auth, UserRole.OpsAuditor)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has a specific role
   */
  private hasRole(auth: AuthContext, role: UserRole): boolean {
    return auth.roles.includes(role);
  }
}
