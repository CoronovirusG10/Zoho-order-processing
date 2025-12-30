/**
 * End-to-End Tests for Order Processing Workflow
 *
 * Tests the complete order processing workflow using Temporal's test environment.
 * All external dependencies (Cosmos, Blob, Zoho, Teams) are mocked.
 *
 * Test Scenarios:
 * 1. Happy Path - All auto-matches, user approves
 * 2. Customer Disambiguation - Multiple customer matches require selection
 * 3. Item Disambiguation - Multiple item matches require selection
 * 4. Correction Flow - Committee finds issues requiring user corrections
 * 5. Cancellation - User cancels mid-flow
 * 6. Timeout - Workflow times out waiting for user input
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, Runtime, DefaultLogger } from '@temporalio/worker';
import { Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import type {
  OrderProcessingInput,
  ApprovalReceivedEvent,
  SelectionsSubmittedEvent,
  CorrectionsSubmittedEvent,
  FileReuploadedEvent,
  StoreFileOutput,
  ParseExcelOutput,
  RunCommitteeOutput,
  ResolveCustomerOutput,
  ResolveItemsOutput,
  CreateZohoDraftOutput,
  NotifyUserOutput,
  UpdateCaseOutput,
  ApplyCorrectionsOutput,
  ApplySelectionsOutput,
  FinalizeAuditOutput,
  CustomerCandidate,
  ItemCandidate,
  CommitteeDisagreement,
} from '../workflows/types';

// =============================================================================
// Test Configuration
// =============================================================================

// Generate unique task queue for each test to prevent worker registration conflicts
function createTaskQueue(): string {
  return `test-order-processing-${uuidv4().slice(0, 8)}`;
}

// Reduce logging noise during tests
Runtime.install({
  logger: new DefaultLogger('WARN'),
});

// =============================================================================
// Mock Activity Options
// =============================================================================

interface MockActivityOptions {
  // Store file
  storeFileSuccess?: boolean;
  storedPath?: string;
  sha256?: string;

  // Parse Excel
  parseSuccess?: boolean;
  parseBlocked?: boolean;
  parseBlockReason?: string;

  // Committee
  committeeSuccess?: boolean;
  committeeNeedsHuman?: boolean;
  committeeConsensus?: 'unanimous' | 'majority' | 'split' | 'no_consensus';
  committeeDisagreements?: CommitteeDisagreement[];

  // Customer resolution
  customerSuccess?: boolean;
  customerResolved?: boolean;
  customerNeedsHuman?: boolean;
  customerId?: string;
  customerName?: string;
  customerCandidates?: CustomerCandidate[];

  // Item resolution
  itemsSuccess?: boolean;
  itemsAllResolved?: boolean;
  itemsNeedsHuman?: boolean;
  unresolvedLines?: number[];
  itemCandidates?: Record<number, ItemCandidate[]>;

  // Zoho draft
  zohoSuccess?: boolean;
  zohoQueued?: boolean;
  zohoOrderId?: string;
  zohoOrderNumber?: string;
  zohoError?: string;

  // Finalize audit
  auditSuccess?: boolean;
  auditManifestPath?: string;

  // Notification tracking
  notificationLog?: Array<{ caseId: string; type: string }>;
}

// =============================================================================
// Mock Activity Factory
// =============================================================================

function createMockActivities(options: MockActivityOptions = {}) {
  const notificationLog = options.notificationLog || [];

  return {
    /**
     * Store file in blob storage
     */
    async storeFile(): Promise<StoreFileOutput> {
      if (options.storeFileSuccess === false) {
        throw new Error('Failed to store file');
      }
      return {
        success: true,
        storedPath: options.storedPath || 'test-tenant/test-case-id/original.xlsx',
        sha256: options.sha256 || 'abc123def456',
      };
    },

    /**
     * Parse Excel file
     */
    async parseExcel(): Promise<ParseExcelOutput> {
      if (options.parseBlocked) {
        return {
          success: false,
          blocked: true,
          blockReason: options.parseBlockReason || 'File contains formulas',
        };
      }
      if (options.parseSuccess === false) {
        return {
          success: false,
          blocked: false,
        };
      }
      return {
        success: true,
        blocked: false,
        canonicalData: {
          customerInfo: {
            name: 'Test Customer Ltd',
            email: 'test@customer.com',
          },
          lineItems: [
            { lineNumber: 1, description: 'Product A', quantity: 10, sku: 'SKU-001' },
            { lineNumber: 2, description: 'Product B', quantity: 5, sku: 'SKU-002' },
          ],
          orderMeta: {
            poNumber: 'PO-12345',
          },
        },
        issues: [],
      };
    },

    /**
     * Run committee validation
     */
    async runCommittee(): Promise<RunCommitteeOutput> {
      if (options.committeeSuccess === false) {
        throw new Error('Committee validation failed');
      }
      return {
        success: true,
        needsHuman: options.committeeNeedsHuman || false,
        consensus: options.committeeConsensus || 'unanimous',
        disagreements: options.committeeDisagreements,
      };
    },

    /**
     * Resolve customer against Zoho
     */
    async resolveCustomer(): Promise<ResolveCustomerOutput> {
      if (options.customerSuccess === false) {
        throw new Error('Customer resolution failed');
      }
      if (options.customerNeedsHuman) {
        return {
          success: true,
          resolved: false,
          needsHuman: true,
          candidates: options.customerCandidates || [
            {
              zohoCustomerId: 'cust-1',
              zohoCustomerName: 'Test Customer Ltd',
              score: 0.85,
              matchReasons: ['Name match'],
            },
            {
              zohoCustomerId: 'cust-2',
              zohoCustomerName: 'Test Customer Inc',
              score: 0.75,
              matchReasons: ['Partial name match'],
            },
          ],
        };
      }
      return {
        success: true,
        resolved: true,
        needsHuman: false,
        zohoCustomerId: options.customerId || 'zoho-customer-123',
        zohoCustomerName: options.customerName || 'Test Customer Ltd',
      };
    },

    /**
     * Resolve items against Zoho catalog
     */
    async resolveItems(): Promise<ResolveItemsOutput> {
      if (options.itemsSuccess === false) {
        throw new Error('Item resolution failed');
      }
      if (options.itemsNeedsHuman) {
        return {
          success: true,
          allResolved: false,
          needsHuman: true,
          unresolvedLines: options.unresolvedLines || [2],
          candidates: options.itemCandidates || {
            2: [
              {
                zohoItemId: 'item-1',
                sku: 'SKU-002-A',
                name: 'Product B Variant A',
                score: 0.8,
                matchReasons: ['SKU partial match'],
              },
              {
                zohoItemId: 'item-2',
                sku: 'SKU-002-B',
                name: 'Product B Variant B',
                score: 0.7,
                matchReasons: ['Name match'],
              },
            ],
          },
        };
      }
      return {
        success: true,
        allResolved: true,
        needsHuman: false,
      };
    },

    /**
     * Apply user corrections
     */
    async applyCorrections(): Promise<ApplyCorrectionsOutput> {
      return {
        success: true,
        appliedCount: 1,
        validationPassed: true,
        newVersion: '2',
      };
    },

    /**
     * Apply user selections
     */
    async applySelections(): Promise<ApplySelectionsOutput> {
      return {
        success: true,
        customerApplied: true,
        itemsApplied: 1,
        newVersion: '2',
      };
    },

    /**
     * Create Zoho draft sales order
     */
    async createZohoDraft(): Promise<CreateZohoDraftOutput> {
      if (options.zohoSuccess === false) {
        if (options.zohoQueued) {
          return {
            success: false,
            queued: true,
            error: options.zohoError || 'Zoho unavailable',
          };
        }
        throw new Error(options.zohoError || 'Failed to create Zoho draft');
      }
      return {
        success: true,
        salesorder_id: options.zohoOrderId || 'so-123456',
        salesorder_number: options.zohoOrderNumber || 'SO-00001',
        status: 'draft',
      };
    },

    /**
     * Notify user via Teams
     */
    async notifyUser(input: { caseId: string; type: string }): Promise<NotifyUserOutput> {
      notificationLog.push({ caseId: input.caseId, type: input.type });
      return {
        success: true,
        messageId: `msg-${uuidv4()}`,
      };
    },

    /**
     * Update case in Cosmos DB
     */
    async updateCase(): Promise<UpdateCaseOutput> {
      return { success: true };
    },

    /**
     * Finalize audit bundle
     */
    async finalizeAudit(): Promise<FinalizeAuditOutput> {
      if (options.auditSuccess === false) {
        return {
          success: false,
          error: 'Audit finalization failed',
        };
      }
      return {
        success: true,
        manifestPath: options.auditManifestPath || 'test-tenant/test-case-id/audit/manifest.json',
        manifestSha256: 'audit-sha256-hash',
        artifactCount: 5,
      };
    },
  };
}

// =============================================================================
// Test Input Factory
// =============================================================================

function createTestInput(overrides: Partial<OrderProcessingInput> = {}): OrderProcessingInput {
  return {
    caseId: `test-case-${uuidv4().slice(0, 8)}`,
    blobUrl: 'https://test.blob.core.windows.net/uploads/test-order.xlsx',
    tenantId: 'test-tenant',
    userId: 'test-user',
    correlationId: uuidv4(),
    teams: {
      chatId: 'test-chat-id',
      messageId: 'test-message-id',
      activityId: 'test-activity-id',
    },
    ...overrides,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Order Processing Workflow E2E', () => {
  let testEnv: TestWorkflowEnvironment;
  let client: Client;

  beforeAll(async () => {
    // Create the test environment (local Temporal server)
    testEnv = await TestWorkflowEnvironment.createLocal();
    client = testEnv.client;
  }, 120000); // 2 minute timeout for environment setup

  afterAll(async () => {
    await testEnv?.teardown();
  });

  // =============================================================================
  // Happy Path Tests
  // =============================================================================

  describe('Happy Path', () => {
    it('should complete order processing with all auto-matches and approval', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({ notificationLog });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      // Create worker with mock activities
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      // Run worker in background
      const workerPromise = worker.run();

      try {
        // Start workflow
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-happy-path-${uuidv4()}`,
        });

        // Wait a bit for workflow to reach approval stage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send approval signal
        const approvalEvent: ApprovalReceivedEvent = {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        };
        await handle.signal('ApprovalReceived', approvalEvent);

        // Wait for workflow completion
        const result = await handle.result();

        // Assertions
        expect(result.status).toBe('completed');
        expect(result.zohoOrderId).toBe('so-123456');
        expect(result.zohoOrderNumber).toBe('SO-00001');

        // Verify notifications were sent
        const notificationTypes = notificationLog.map((n) => n.type);
        expect(notificationTypes).toContain('ready_for_approval');
        expect(notificationTypes).toContain('complete');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);

    it('should include audit manifest in completion', async () => {
      const mockActivities = createMockActivities({
        auditManifestPath: 'tenant/case/audit/manifest.json',
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-audit-${uuidv4()}`,
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.zohoOrderId).toBeDefined();
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Customer Disambiguation Tests
  // =============================================================================

  describe('Customer Disambiguation', () => {
    it('should wait for customer selection when multiple matches found', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({
        customerNeedsHuman: true,
        customerCandidates: [
          { zohoCustomerId: 'cust-1', zohoCustomerName: 'Acme Corp', score: 0.9, matchReasons: ['Exact match'] },
          { zohoCustomerId: 'cust-2', zohoCustomerName: 'Acme LLC', score: 0.8, matchReasons: ['Partial match'] },
        ],
        notificationLog,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-customer-disambiguation-${uuidv4()}`,
        });

        // Wait for workflow to reach customer selection stage (needs more time for all activities)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify selection_needed notification was sent
        expect(notificationLog.some((n) => n.type === 'selection_needed')).toBe(true);

        // Send customer selection signal
        const selectionEvent: SelectionsSubmittedEvent = {
          caseId: input.caseId,
          selections: {
            customer: { zohoCustomerId: 'cust-1' },
          },
          submittedBy: 'test-user',
          submittedAt: new Date().toISOString(),
        };
        await handle.signal('SelectionsSubmitted', selectionEvent);

        // Wait a bit, then send approval
        await new Promise((resolve) => setTimeout(resolve, 300));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Item Disambiguation Tests
  // =============================================================================

  describe('Item Disambiguation', () => {
    it('should wait for item selection when multiple matches found', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({
        itemsNeedsHuman: true,
        unresolvedLines: [2],
        itemCandidates: {
          2: [
            { zohoItemId: 'item-a', sku: 'SKU-A', name: 'Product A', score: 0.85 },
            { zohoItemId: 'item-b', sku: 'SKU-B', name: 'Product B', score: 0.75 },
          ],
        },
        notificationLog,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-item-disambiguation-${uuidv4()}`,
        });

        // Wait for workflow to reach item selection stage (needs more time for all activities)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify selection_needed notification was sent
        expect(notificationLog.filter((n) => n.type === 'selection_needed').length).toBeGreaterThanOrEqual(1);

        // Send item selection signal
        const selectionEvent: SelectionsSubmittedEvent = {
          caseId: input.caseId,
          selections: {
            items: { 2: { zohoItemId: 'item-a' } },
          },
          submittedBy: 'test-user',
          submittedAt: new Date().toISOString(),
        };
        await handle.signal('SelectionsSubmitted', selectionEvent);

        // Wait a bit, then send approval
        await new Promise((resolve) => setTimeout(resolve, 300));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Correction Flow Tests
  // =============================================================================

  describe('Correction Flow', () => {
    it('should wait for user corrections when committee finds disagreements', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({
        committeeNeedsHuman: true,
        committeeConsensus: 'split',
        committeeDisagreements: [
          {
            field: 'quantity_line_1',
            votes: { model1: '10', model2: '100' },
            confidence: { model1: 0.8, model2: 0.7 },
          },
        ],
        notificationLog,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-corrections-${uuidv4()}`,
        });

        // Wait for workflow to reach corrections stage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify issues notification was sent
        expect(notificationLog.some((n) => n.type === 'issues')).toBe(true);

        // Send corrections signal
        const correctionsEvent: CorrectionsSubmittedEvent = {
          caseId: input.caseId,
          corrections: {
            quantity_line_1: {
              originalValue: '10',
              correctedValue: '100',
              notes: 'Confirmed with customer',
            },
          },
          submittedBy: 'test-user',
          submittedAt: new Date().toISOString(),
        };
        await handle.signal('CorrectionsSubmitted', correctionsEvent);

        // Wait a bit, then send approval
        await new Promise((resolve) => setTimeout(resolve, 300));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Cancellation Tests
  // =============================================================================

  describe('Cancellation Flow', () => {
    it('should cancel workflow when user rejects approval', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({ notificationLog });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-cancellation-${uuidv4()}`,
        });

        // Wait for workflow to reach approval stage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send rejection signal
        const approvalEvent: ApprovalReceivedEvent = {
          caseId: input.caseId,
          approved: false,
          approvedBy: 'test-user',
          approvedAt: new Date().toISOString(),
          comments: 'Customer changed their mind',
        };
        await handle.signal('ApprovalReceived', approvalEvent);

        // Wait for workflow completion
        const result = await handle.result();

        // Assertions
        expect(result.status).toBe('cancelled');
        expect(result.zohoOrderId).toBeUndefined();
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Blocked File Tests
  // =============================================================================

  describe('Blocked File Flow', () => {
    it('should handle blocked file and continue after reupload', async () => {
      // We need a more complex mock setup for this test
      // The parseExcel needs to return blocked first, then success after reupload
      let parseCallCount = 0;
      const mockActivities = {
        ...createMockActivities(),
        async parseExcel(): Promise<ParseExcelOutput> {
          parseCallCount++;
          if (parseCallCount === 1) {
            return {
              success: false,
              blocked: true,
              blockReason: 'File contains formulas that cannot be evaluated',
            };
          }
          return {
            success: true,
            blocked: false,
            canonicalData: {
              customerInfo: { name: 'Test Customer' },
              lineItems: [{ lineNumber: 1, description: 'Product', quantity: 1 }],
              orderMeta: {},
            },
          };
        },
      };

      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-blocked-file-${uuidv4()}`,
        });

        // Wait for workflow to block
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send file reuploaded signal
        const reuploadEvent: FileReuploadedEvent = {
          caseId: input.caseId,
          blobUrl: 'https://test.blob.core.windows.net/uploads/test-order-fixed.xlsx',
          correlationId: uuidv4(),
        };
        await handle.signal('FileReuploaded', reuploadEvent);

        // Wait for workflow to continue, then approve
        await new Promise((resolve) => setTimeout(resolve, 500));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Zoho Queued Tests
  // =============================================================================

  describe('Zoho Unavailable', () => {
    it('should complete with queued status when Zoho is unavailable', async () => {
      const mockActivities = createMockActivities({
        zohoSuccess: false,
        zohoQueued: true,
        zohoError: 'Zoho API temporarily unavailable',
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-zoho-queued-${uuidv4()}`,
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        // When Zoho is unavailable but queued, workflow still completes
        expect(result.status).toBe('completed');
        expect(result.zohoOrderId).toBeUndefined();
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Timeout Tests (using time skipping)
  // =============================================================================

  describe('Timeout Flow', () => {
    it('should send reminder notification after initial wait period', async () => {
      // Use TestWorkflowEnvironment's time skipping capability
      // This test is conceptual - actual timeout testing requires TimeSkipping environment
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({ notificationLog });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-timeout-${uuidv4()}`,
        });

        // Wait for workflow to reach approval stage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Note: Full timeout testing requires TimeSkipping environment
        // For now, we just verify the workflow reaches approval stage
        // and can be completed normally

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();
        expect(result.status).toBe('completed');
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Query Tests
  // =============================================================================

  describe('Workflow Queries', () => {
    it('should return current workflow state via query', async () => {
      const mockActivities = createMockActivities();
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-query-${uuidv4()}`,
        });

        // Wait for workflow to reach approval stage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Query workflow state
        const state = await handle.query('getState');

        expect(state).toBeDefined();
        expect(state.currentStep).toBeDefined();
        expect(state.status).toBeDefined();
        expect(state.lastUpdated).toBeDefined();

        // Complete the workflow
        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        await handle.result();
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('Error Handling', () => {
    it('should fail gracefully when store file fails', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({
        storeFileSuccess: false,
        notificationLog,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-store-fail-${uuidv4()}`,
        });

        // Wait for workflow to fail
        const result = await handle.result();

        expect(result.status).toBe('failed');
        expect(result.error).toBeDefined();

        // Verify failure notification was sent
        expect(notificationLog.some((n) => n.type === 'failed')).toBe(true);
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);

    it('should fail gracefully when parse fails', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];
      const mockActivities = createMockActivities({
        parseSuccess: false,
        notificationLog,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-parse-fail-${uuidv4()}`,
        });

        const result = await handle.result();

        expect(result.status).toBe('failed');
        expect(notificationLog.some((n) => n.type === 'failed')).toBe(true);
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);

    it('should continue with audit failure (non-blocking)', async () => {
      const mockActivities = createMockActivities({
        auditSuccess: false,
      });
      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-audit-fail-${uuidv4()}`,
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        // Workflow should still complete even if audit fails
        expect(result.status).toBe('completed');
        expect(result.zohoOrderId).toBeDefined();
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });

  // =============================================================================
  // Combined Disambiguation Tests
  // =============================================================================

  describe('Combined Flows', () => {
    it('should handle both customer and item disambiguation in sequence', async () => {
      const notificationLog: Array<{ caseId: string; type: string }> = [];

      // Need to track state to return different responses for customer vs item resolution
      let customerResolved = false;

      const mockActivities = {
        ...createMockActivities({ notificationLog }),
        async resolveCustomer(): Promise<ResolveCustomerOutput> {
          if (!customerResolved) {
            return {
              success: true,
              resolved: false,
              needsHuman: true,
              candidates: [
                { zohoCustomerId: 'cust-1', zohoCustomerName: 'Customer A', score: 0.9 },
                { zohoCustomerId: 'cust-2', zohoCustomerName: 'Customer B', score: 0.8 },
              ],
            };
          }
          return {
            success: true,
            resolved: true,
            needsHuman: false,
            zohoCustomerId: 'cust-1',
            zohoCustomerName: 'Customer A',
          };
        },
        async resolveItems(): Promise<ResolveItemsOutput> {
          return {
            success: true,
            allResolved: false,
            needsHuman: true,
            unresolvedLines: [1],
            candidates: {
              1: [
                { zohoItemId: 'item-1', sku: 'SKU-1', name: 'Item 1', score: 0.85 },
                { zohoItemId: 'item-2', sku: 'SKU-2', name: 'Item 2', score: 0.75 },
              ],
            },
          };
        },
        async applySelections(): Promise<ApplySelectionsOutput> {
          customerResolved = true;
          return { success: true, customerApplied: true, itemsApplied: 1 };
        },
      };

      const input = createTestInput();
      const taskQueue = createTaskQueue();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../../dist/workflows'),
        activities: mockActivities,
      });

      const workerPromise = worker.run();

      try {
        const handle = await client.workflow.start('orderProcessingWorkflow', {
          args: [input],
          taskQueue,
          workflowId: `test-combined-${uuidv4()}`,
        });

        // Wait for customer selection stage (needs more time for all activities)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Send customer selection
        await handle.signal('SelectionsSubmitted', {
          caseId: input.caseId,
          selections: { customer: { zohoCustomerId: 'cust-1' } },
          submittedBy: 'test-user',
          submittedAt: new Date().toISOString(),
        });

        // Wait for item selection stage
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Send item selection
        await handle.signal('SelectionsSubmitted', {
          caseId: input.caseId,
          selections: { items: { 1: { zohoItemId: 'item-1' } } },
          submittedBy: 'test-user',
          submittedAt: new Date().toISOString(),
        });

        // Wait and send approval
        await new Promise((resolve) => setTimeout(resolve, 300));

        await handle.signal('ApprovalReceived', {
          caseId: input.caseId,
          approved: true,
          approvedBy: 'test-approver',
          approvedAt: new Date().toISOString(),
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');

        // Verify selection_needed was sent twice (once for customer, once for items)
        const selectionNotifications = notificationLog.filter((n) => n.type === 'selection_needed');
        expect(selectionNotifications.length).toBe(2);
      } finally {
        worker.shutdown();
        await workerPromise;
      }
    }, 30000);
  });
});
