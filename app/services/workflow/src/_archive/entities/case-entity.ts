/**
 * Case Entity - Durable Entity
 *
 * Maintains case state across orchestrations.
 * Provides atomic updates and queryable state.
 */

import * as df from 'durable-functions';

interface CaseState {
  caseId: string;
  tenantId: string;
  userId: string;
  status: string;
  workflowInstanceId?: string;
  createdAt: string;
  updatedAt: string;
  blobUrl?: string;
  sha256?: string;
  parseResult?: unknown;
  committeeResult?: unknown;
  customerResolution?: unknown;
  itemsResolution?: unknown;
  approvalData?: unknown;
  zohoData?: unknown;
  errors: Array<{
    timestamp: string;
    step: string;
    message: string;
    retryable: boolean;
  }>;
  auditTrail: Array<{
    timestamp: string;
    event: string;
    actor: string;
    data?: unknown;
  }>;
}

class CaseEntity {
  private state: CaseState | null = null;

  // Initialize new case
  init(data: {
    caseId: string;
    tenantId: string;
    userId: string;
    blobUrl: string;
    workflowInstanceId: string;
  }): void {
    const now = new Date().toISOString();
    this.state = {
      caseId: data.caseId,
      tenantId: data.tenantId,
      userId: data.userId,
      status: 'pending',
      workflowInstanceId: data.workflowInstanceId,
      createdAt: now,
      updatedAt: now,
      blobUrl: data.blobUrl,
      errors: [],
      auditTrail: [
        {
          timestamp: now,
          event: 'case_created',
          actor: data.userId,
          data: { blobUrl: data.blobUrl },
        },
      ],
    };
  }

  // Update case status
  updateStatus(status: string, actor: string): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    const now = new Date().toISOString();
    this.state.status = status;
    this.state.updatedAt = now;
    this.state.auditTrail.push({
      timestamp: now,
      event: 'status_changed',
      actor,
      data: { newStatus: status },
    });
  }

  // Store file metadata
  storeFileMetadata(sha256: string): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.sha256 = sha256;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store parse result
  storeParseResult(result: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.parseResult = result;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store committee result
  storeCommitteeResult(result: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.committeeResult = result;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store customer resolution
  storeCustomerResolution(result: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.customerResolution = result;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store items resolution
  storeItemsResolution(result: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.itemsResolution = result;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store approval data
  storeApproval(data: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.approvalData = data;
    this.state.updatedAt = new Date().toISOString();
  }

  // Store Zoho result
  storeZohoData(data: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.zohoData = data;
    this.state.updatedAt = new Date().toISOString();
  }

  // Add error
  addError(error: {
    step: string;
    message: string;
    retryable: boolean;
  }): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.errors.push({
      timestamp: new Date().toISOString(),
      ...error,
    });
    this.state.updatedAt = new Date().toISOString();
  }

  // Add audit event
  addAuditEvent(event: string, actor: string, data?: unknown): void {
    if (!this.state) {
      throw new Error('Case not initialized');
    }

    this.state.auditTrail.push({
      timestamp: new Date().toISOString(),
      event,
      actor,
      data,
    });
    this.state.updatedAt = new Date().toISOString();
  }

  // Get current state
  get(): CaseState | null {
    return this.state;
  }

  // Delete case (for cleanup)
  delete(): void {
    this.state = null;
  }
}

// Register entity using v3 pattern with manual operation dispatch
df.app.entity('CaseEntity', (context: df.EntityContext<CaseState | null>) => {
  // Restore state if exists, otherwise initialize to null
  let state: CaseState | null = context.df.getState(() => null) ?? null;

  // Get the operation name and input
  const operationName = context.df.operationName;
  const operationInput = context.df.getInput();

  // Handle operations based on operation name
  switch (operationName) {
    case 'init': {
      const data = operationInput as {
        caseId: string;
        tenantId: string;
        userId: string;
        blobUrl: string;
        workflowInstanceId: string;
      };
      const now = new Date().toISOString();
      state = {
        caseId: data.caseId,
        tenantId: data.tenantId,
        userId: data.userId,
        status: 'pending',
        workflowInstanceId: data.workflowInstanceId,
        createdAt: now,
        updatedAt: now,
        blobUrl: data.blobUrl,
        errors: [],
        auditTrail: [
          {
            timestamp: now,
            event: 'case_created',
            actor: data.userId,
            data: { blobUrl: data.blobUrl },
          },
        ],
      };
      break;
    }

    case 'updateStatus': {
      if (!state) throw new Error('Case not initialized');
      const input = operationInput as unknown as { status: string; actor: string };
      const now = new Date().toISOString();
      state.status = input.status;
      state.updatedAt = now;
      state.auditTrail.push({
        timestamp: now,
        event: 'status_changed',
        actor: input.actor,
        data: { newStatus: input.status },
      });
      break;
    }

    case 'storeFileMetadata': {
      if (!state) throw new Error('Case not initialized');
      const fileInput = operationInput as unknown as { sha256: string };
      state.sha256 = fileInput.sha256;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeParseResult': {
      if (!state) throw new Error('Case not initialized');
      state.parseResult = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeCommitteeResult': {
      if (!state) throw new Error('Case not initialized');
      state.committeeResult = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeCustomerResolution': {
      if (!state) throw new Error('Case not initialized');
      state.customerResolution = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeItemsResolution': {
      if (!state) throw new Error('Case not initialized');
      state.itemsResolution = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeApproval': {
      if (!state) throw new Error('Case not initialized');
      state.approvalData = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'storeZohoData': {
      if (!state) throw new Error('Case not initialized');
      state.zohoData = operationInput;
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'addError': {
      if (!state) throw new Error('Case not initialized');
      const error = operationInput as unknown as {
        step: string;
        message: string;
        retryable: boolean;
      };
      state.errors.push({
        timestamp: new Date().toISOString(),
        step: error.step,
        message: error.message,
        retryable: error.retryable,
      });
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'addAuditEvent': {
      if (!state) throw new Error('Case not initialized');
      const auditInput = operationInput as unknown as {
        event: string;
        actor: string;
        data?: unknown;
      };
      state.auditTrail.push({
        timestamp: new Date().toISOString(),
        event: auditInput.event,
        actor: auditInput.actor,
        data: auditInput.data,
      });
      state.updatedAt = new Date().toISOString();
      break;
    }

    case 'get': {
      // Return current state without modification
      context.df.return(state);
      break;
    }

    case 'delete': {
      state = null;
      break;
    }

    default:
      throw new Error(`Unknown operation: ${operationName}`);
  }

  // Save state after operation
  context.df.setState(state);
});

// Export CaseState type for use by other modules
export type { CaseState };
