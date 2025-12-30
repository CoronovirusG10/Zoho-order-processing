/**
 * Order Processing Temporal Workflow
 *
 * Main durable workflow for processing Excel orders through the full lifecycle:
 * 1. Store file in blob storage
 * 2. Parse Excel file
 * 3. Run committee (AI cross-validation)
 * 4. Resolve customer against Zoho
 * 5. Resolve items against Zoho catalog
 * 6. Await human approval
 * 7. Create Zoho draft sales order
 * 8. Notify completion
 *
 * Migrated from Azure Durable Functions to Temporal.io
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  continueAsNew,
  ApplicationFailure,
  log,
  workflowInfo,
} from '@temporalio/workflow';

import type { RetryPolicy } from '@temporalio/common';

// Import types from local types file
import type {
  OrderProcessingInput,
  OrderProcessingOutput,
  FileReuploadedEvent,
  CorrectionsSubmittedEvent,
  SelectionsSubmittedEvent,
  ApprovalReceivedEvent,
  WorkflowSignalState,
  StoreFileInput,
  StoreFileOutput,
  ParseExcelInput,
  ParseExcelOutput,
  RunCommitteeInput,
  RunCommitteeOutput,
  ResolveCustomerInput,
  ResolveCustomerOutput,
  ResolveItemsInput,
  ResolveItemsOutput,
  CreateZohoDraftInput,
  CreateZohoDraftOutput,
  NotifyUserInput,
  NotifyUserOutput,
  UpdateCaseInput,
  UpdateCaseOutput,
  ApplyCorrectionsInput,
  ApplyCorrectionsOutput,
  ApplySelectionsInput,
  ApplySelectionsOutput,
  FinalizeAuditInput,
  FinalizeAuditOutput,
  CaseStatus,
  HumanWaitContext,
  HumanWaitTimeoutConfig,
} from './types';

import { DEFAULT_HUMAN_WAIT_TIMEOUT } from './types';

// ============================================================================
// Retry Policies
// ============================================================================

/**
 * Standard retry policy for most activities (3 attempts, exponential backoff)
 * Equivalent to Azure Durable Functions RetryPolicies.standard()
 */
const standardRetry: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '5s',
  backoffCoefficient: 2,
  maximumInterval: '30s',
  nonRetryableErrorTypes: ['ValidationError', 'BlockedFileError'],
};

/**
 * Aggressive retry policy for critical operations (5 attempts)
 * Equivalent to Azure Durable Functions RetryPolicies.aggressive()
 */
const aggressiveRetry: RetryPolicy = {
  maximumAttempts: 5,
  initialInterval: '5s',
  backoffCoefficient: 2,
  maximumInterval: '60s',
  nonRetryableErrorTypes: ['ValidationError'],
};

// ============================================================================
// Activity Interface
// ============================================================================

/**
 * Activity interface definitions for type-safe proxy
 */
interface Activities {
  storeFile(input: StoreFileInput): Promise<StoreFileOutput>;
  parseExcel(input: ParseExcelInput): Promise<ParseExcelOutput>;
  runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput>;
  resolveCustomer(input: ResolveCustomerInput): Promise<ResolveCustomerOutput>;
  resolveItems(input: ResolveItemsInput): Promise<ResolveItemsOutput>;
  createZohoDraft(input: CreateZohoDraftInput): Promise<CreateZohoDraftOutput>;
  notifyUser(input: NotifyUserInput): Promise<NotifyUserOutput>;
  updateCase(input: UpdateCaseInput): Promise<UpdateCaseOutput>;
  applyCorrections(input: ApplyCorrectionsInput): Promise<ApplyCorrectionsOutput>;
  applySelections(input: ApplySelectionsInput): Promise<ApplySelectionsOutput>;
  finalizeAudit(input: FinalizeAuditInput): Promise<FinalizeAuditOutput>;
}

// ============================================================================
// Activity Proxies
// ============================================================================

/**
 * Standard activities with default retry policy
 */
const {
  storeFile,
  parseExcel,
  runCommittee,
  resolveCustomer,
  resolveItems,
  notifyUser,
  updateCase,
  applyCorrections,
  applySelections,
} = proxyActivities<Activities>({
  startToCloseTimeout: '5m',
  retry: standardRetry,
});

/**
 * Activities requiring aggressive retry (external API calls to Zoho)
 */
const { createZohoDraft: createZohoDraftAggressive } = proxyActivities<Activities>({
  startToCloseTimeout: '10m',
  retry: aggressiveRetry,
});

/**
 * Finalize audit activity with appropriate timeout for blob operations
 */
const { finalizeAudit } = proxyActivities<Activities>({
  startToCloseTimeout: '60s',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
  },
});

// ============================================================================
// Re-export Types for External Use
// ============================================================================

// Re-export types from local types file for consumers
export type {
  OrderProcessingInput,
  OrderProcessingOutput,
  FileReuploadedEvent,
  CorrectionsSubmittedEvent,
  SelectionsSubmittedEvent,
  ApprovalReceivedEvent,
  HumanWaitContext,
  HumanWaitTimeoutConfig,
  DurationString,
} from './types';

export { DEFAULT_HUMAN_WAIT_TIMEOUT } from './types';

// Workflow result type (alias for backward compatibility)
export type OrderProcessingResult = OrderProcessingOutput;

// ============================================================================
// Workflow State for Queries
// ============================================================================

/**
 * Internal workflow state for query responses
 */
interface WorkflowState {
  currentStep: string;
  status: string;
  lastUpdated: string;
  errors: string[];
}

// ============================================================================
// Signal Definitions
// ============================================================================

/**
 * Signal for when user re-uploads a file after a blocking issue
 * Matches Azure Durable Functions 'FileReuploaded' external event
 */
export const fileReuploadedSignal = defineSignal<[FileReuploadedEvent]>('FileReuploaded');

/**
 * Signal for when user submits corrections for committee disagreements
 * Matches Azure Durable Functions 'CorrectionsSubmitted' external event
 */
export const correctionsSubmittedSignal = defineSignal<[CorrectionsSubmittedEvent]>('CorrectionsSubmitted');

/**
 * Signal for when user makes selections for ambiguous matches
 * Matches Azure Durable Functions 'SelectionsSubmitted' external event
 */
export const selectionsSubmittedSignal = defineSignal<[SelectionsSubmittedEvent]>('SelectionsSubmitted');

/**
 * Signal for when user approves or rejects the order
 * Matches Azure Durable Functions 'ApprovalReceived' external event
 */
export const approvalReceivedSignal = defineSignal<[ApprovalReceivedEvent]>('ApprovalReceived');

// ============================================================================
// Query Definitions
// ============================================================================

/**
 * Query to get current workflow state
 */
export const getStateQuery = defineQuery<WorkflowState>('getState');

// ============================================================================
// Human Wait with Escalation Helper
// ============================================================================

/**
 * Result of waiting for human input with timeout escalation
 */
type HumanWaitResult =
  | { received: true }
  | { received: false; reason: 'timeout' };

/**
 * Options for waiting for human input with escalation
 */
interface WaitForHumanOptions {
  /** Function that returns true when the expected signal has been received */
  conditionFn: () => boolean;
  /** Type of wait for notification context */
  waitType: HumanWaitContext['waitType'];
  /** Case ID for notifications */
  caseId: string;
  /** User ID who should respond */
  userId?: string;
  /** Manager to escalate to (optional) */
  managerUserId?: string;
  /** Timeout configuration (uses defaults if not provided) */
  timeoutConfig?: HumanWaitTimeoutConfig;
}

/**
 * Wait for human input with automatic reminder, escalation, and timeout handling.
 *
 * Timeline:
 * - 0-24h: Wait for signal
 * - 24h: Send reminder notification
 * - 24h-48h: Continue waiting for signal
 * - 48h: Send escalation notification (optionally to manager)
 * - 48h-6d: Continue waiting for signal
 * - 6d: Send timeout warning
 * - 6d-7d: Final wait period
 * - 7d: Auto-cancel (throw ApplicationFailure)
 *
 * @param options - Configuration for the human wait
 * @returns HumanWaitResult indicating if signal was received or timeout occurred
 */
async function waitForHumanWithEscalation(options: WaitForHumanOptions): Promise<HumanWaitResult> {
  const {
    conditionFn,
    waitType,
    caseId,
    userId,
    managerUserId,
    timeoutConfig = DEFAULT_HUMAN_WAIT_TIMEOUT,
  } = options;

  // Phase 1: Initial wait until reminder time (24h default)
  log.info(`[${caseId}] Starting human wait with escalation`, {
    waitType,
    reminderAfter: timeoutConfig.reminderAfter,
    escalationAfter: timeoutConfig.escalationAfter,
    maxWait: timeoutConfig.maxWait,
  });

  const phase1Result = await condition(conditionFn, timeoutConfig.reminderAfter);

  if (phase1Result) {
    log.info(`[${caseId}] Human response received before reminder`, { waitType });
    return { received: true };
  }

  // Phase 2: Send reminder and wait until escalation time
  log.info(`[${caseId}] Sending reminder notification`, { waitType, waitDuration: timeoutConfig.reminderAfter });

  await notifyUser({
    caseId,
    type: 'reminder',
    waitContext: {
      waitType,
      waitDuration: timeoutConfig.reminderAfter,
      userId,
    },
  });

  // Calculate remaining time until escalation (48h - 24h = 24h)
  const phase2Duration = '24h'; // Time between reminder and escalation
  const phase2Result = await condition(conditionFn, phase2Duration);

  if (phase2Result) {
    log.info(`[${caseId}] Human response received after reminder`, { waitType });
    return { received: true };
  }

  // Phase 3: Send escalation and wait until timeout warning
  log.info(`[${caseId}] Sending escalation notification`, { waitType, waitDuration: timeoutConfig.escalationAfter });

  await notifyUser({
    caseId,
    type: 'escalation',
    waitContext: {
      waitType,
      waitDuration: timeoutConfig.escalationAfter,
      userId,
      managerUserId,
    },
  });

  // Wait from 48h to 6d (5 days + 16 hours, or approximately 5d)
  const phase3Duration = '5d';
  const phase3Result = await condition(conditionFn, phase3Duration);

  if (phase3Result) {
    log.info(`[${caseId}] Human response received after escalation`, { waitType });
    return { received: true };
  }

  // Phase 4: Send timeout warning and final wait
  log.info(`[${caseId}] Sending timeout warning notification`, { waitType, waitDuration: '6d' });

  await notifyUser({
    caseId,
    type: 'timeout_warning',
    waitContext: {
      waitType,
      waitDuration: '6 days',
      userId,
      managerUserId,
      timeUntilCancel: '24 hours',
    },
  });

  // Final wait (24 hours until max wait of 7 days)
  const phase4Duration = '1d';
  const phase4Result = await condition(conditionFn, phase4Duration);

  if (phase4Result) {
    log.info(`[${caseId}] Human response received after timeout warning`, { waitType });
    return { received: true };
  }

  // Timeout - no response received within max wait time
  log.warn(`[${caseId}] Human wait timed out after ${timeoutConfig.maxWait}`, { waitType });

  return { received: false, reason: 'timeout' };
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Order Processing Workflow
 *
 * Processes an uploaded Excel order file through validation, resolution,
 * approval, and Zoho integration stages.
 *
 * @param input - Workflow input containing case details and file location
 * @returns Workflow output with final status and Zoho order details
 */
export async function orderProcessingWorkflow(input: OrderProcessingInput): Promise<OrderProcessingOutput> {
  const { caseId, correlationId, tenantId, userId, blobUrl, teams } = input;

  // Get workflow info for logging
  const info = workflowInfo();

  // State tracking for queries
  let state: WorkflowState = {
    currentStep: 'started',
    status: 'processing',
    lastUpdated: new Date().toISOString(),
    errors: [],
  };

  // Signal state - these will be populated when signals are received
  let fileReuploadedEvent: FileReuploadedEvent | null = null;
  let correctionsSubmittedEvent: CorrectionsSubmittedEvent | null = null;
  let selectionsSubmittedEvent: SelectionsSubmittedEvent | null = null;
  let approvalReceivedEvent: ApprovalReceivedEvent | null = null;

  // ============================================================================
  // Signal Handlers
  // ============================================================================

  setHandler(fileReuploadedSignal, (event) => {
    log.info(`[${caseId}] Received FileReuploaded signal`, { event });
    fileReuploadedEvent = event;
  });

  setHandler(correctionsSubmittedSignal, (event) => {
    log.info(`[${caseId}] Received CorrectionsSubmitted signal`, { event });
    correctionsSubmittedEvent = event;
  });

  setHandler(selectionsSubmittedSignal, (event) => {
    log.info(`[${caseId}] Received SelectionsSubmitted signal`, { event });
    selectionsSubmittedEvent = event;
  });

  setHandler(approvalReceivedSignal, (event) => {
    log.info(`[${caseId}] Received ApprovalReceived signal`, { event });
    approvalReceivedEvent = event;
  });

  // Set up query handler
  setHandler(getStateQuery, () => state);

  /**
   * Helper to update workflow state
   */
  const updateState = (step: string, status: string = 'processing') => {
    state = {
      ...state,
      currentStep: step,
      status,
      lastUpdated: new Date().toISOString(),
    };
  };

  // ============================================================================
  // Workflow Execution
  // ============================================================================

  try {
    log.info(`[${caseId}] Starting order processing workflow`, {
      workflowId: info.workflowId,
      runId: info.runId,
      correlationId,
      tenantId,
      userId,
    });

    // -------------------------------------------------------------------------
    // Step 1: Store file in blob storage
    // -------------------------------------------------------------------------
    updateState('storing_file');
    log.info(`[${caseId}] Step 1: Storing uploaded file`);
    await updateCase({ caseId, tenantId, correlationId, status: 'storing_file', eventType: 'status_changed' });

    const storeResult = await storeFile({
      caseId,
      blobUrl,
    });

    if (!storeResult.success) {
      throw ApplicationFailure.nonRetryable(`Failed to store file: ${storeResult.error || 'Unknown error'}`);
    }

    log.info(`[${caseId}] Step 1: File stored successfully`, {
      path: storeResult.storedPath,
      sha256: storeResult.sha256,
    });

    // -------------------------------------------------------------------------
    // Step 2: Parse Excel
    // -------------------------------------------------------------------------
    updateState('parsing_excel');
    log.info(`[${caseId}] Step 2: Parsing Excel file`);
    await updateCase({ caseId, tenantId, correlationId, status: 'parsing', eventType: 'file_stored' });

    const parseResult: ParseExcelOutput = await parseExcel({ caseId });

    // Handle blocked scenarios (formulas, protected workbook, etc.)
    if (parseResult.blocked) {
      log.info(`[${caseId}] Step 2: File is blocked`, {
        reason: parseResult.blockReason,
      });

      await notifyUser({
        caseId,
        type: 'blocked',
        reason: parseResult.blockReason,
      });

      // Wait for user to re-upload (no timeout - Temporal handles workflow expiry)
      log.info(`[${caseId}] Step 2: Waiting for file reupload`);
      await condition(() => fileReuploadedEvent !== null);

      const reuploadEvent = fileReuploadedEvent!;
      log.info(`[${caseId}] Step 2: File reuploaded, restarting workflow`, {
        newBlobUrl: reuploadEvent.blobUrl,
      });

      // Continue as new with the new file
      return continueAsNew<typeof orderProcessingWorkflow>({
        ...input,
        blobUrl: reuploadEvent.blobUrl,
        correlationId: reuploadEvent.correlationId,
      });
    }

    if (!parseResult.success) {
      throw ApplicationFailure.nonRetryable('Excel parsing failed');
    }

    log.info(`[${caseId}] Step 2: Excel parsed successfully`, {
      issueCount: parseResult.issues?.length || 0,
    });

    // -------------------------------------------------------------------------
    // Step 3: Run committee (bounded mapping cross-check)
    // -------------------------------------------------------------------------
    updateState('running_committee');
    log.info(`[${caseId}] Step 3: Running committee mapping validation`);
    await updateCase({ caseId, tenantId, correlationId, status: 'running_committee', eventType: 'file_parsed' });

    const committeeResult: RunCommitteeOutput = await runCommittee({ caseId });

    if (!committeeResult.success) {
      throw ApplicationFailure.nonRetryable('Committee validation failed');
    }

    // Handle committee disagreements
    if (committeeResult.needsHuman) {
      log.info(`[${caseId}] Step 3: Committee needs human intervention`, {
        consensus: committeeResult.consensus,
        disagreements: committeeResult.disagreements,
      });

      await updateCase({ caseId, tenantId, correlationId, status: 'awaiting_corrections', eventType: 'committee_completed' });
      await notifyUser({
        caseId,
        type: 'issues',
        issues: committeeResult.disagreements,
      });

      // Wait for user corrections with timeout/escalation handling
      updateState('awaiting_corrections', 'awaiting_user_input');
      log.info(`[${caseId}] Step 3: Waiting for user corrections`);

      const correctionsWaitResult = await waitForHumanWithEscalation({
        conditionFn: () => correctionsSubmittedEvent !== null,
        waitType: 'corrections',
        caseId,
        userId,
      });

      if (!correctionsWaitResult.received) {
        // Timed out waiting for corrections - auto-cancel workflow
        log.warn(`[${caseId}] Step 3: Corrections wait timed out, auto-cancelling workflow`);
        await updateCase({
          caseId,
          tenantId,
          correlationId,
          status: 'cancelled',
          eventType: 'workflow_cancelled',
          updates: {
            cancelledAt: new Date().toISOString(),
            cancellationReason: 'Workflow timed out waiting for corrections (7 days)',
          },
        });
        throw ApplicationFailure.nonRetryable('Workflow timed out waiting for user corrections after 7 days');
      }

      const correctionsEvent = correctionsSubmittedEvent!;
      log.info(`[${caseId}] Step 3: Corrections received, applying`, {
        submittedBy: correctionsEvent.submittedBy,
      });

      await applyCorrections({
        caseId,
        tenantId,
        corrections: correctionsEvent.corrections,
        submittedBy: correctionsEvent.submittedBy,
        correlationId,
      });
    }

    log.info(`[${caseId}] Step 3: Committee validation complete`);

    // -------------------------------------------------------------------------
    // Step 4: Resolve customer
    // -------------------------------------------------------------------------
    updateState('resolving_customer');
    log.info(`[${caseId}] Step 4: Resolving customer against Zoho`);
    await updateCase({ caseId, tenantId, correlationId, status: 'resolving_customer', eventType: 'status_changed' });

    const customerResult: ResolveCustomerOutput = await resolveCustomer({ caseId, tenantId });

    if (!customerResult.success) {
      throw ApplicationFailure.nonRetryable('Customer resolution failed');
    }

    if (customerResult.needsHuman) {
      log.info(`[${caseId}] Step 4: Customer resolution needs human selection`, {
        candidateCount: customerResult.candidates?.length || 0,
      });

      await updateCase({ caseId, tenantId, correlationId, status: 'awaiting_customer_selection', eventType: 'customer_resolved' });
      await notifyUser({
        caseId,
        type: 'selection_needed',
        candidates: { customer: customerResult.candidates },
      });

      // Wait for customer selection with timeout/escalation handling
      updateState('awaiting_customer_selection', 'awaiting_user_input');
      log.info(`[${caseId}] Step 4: Waiting for customer selection`);

      // Reset selections event to allow fresh selection
      selectionsSubmittedEvent = null;

      const customerSelectionWaitResult = await waitForHumanWithEscalation({
        conditionFn: () => selectionsSubmittedEvent !== null,
        waitType: 'customer_selection',
        caseId,
        userId,
      });

      if (!customerSelectionWaitResult.received) {
        // Timed out waiting for customer selection - auto-cancel workflow
        log.warn(`[${caseId}] Step 4: Customer selection wait timed out, auto-cancelling workflow`);
        await updateCase({
          caseId,
          tenantId,
          correlationId,
          status: 'cancelled',
          eventType: 'workflow_cancelled',
          updates: {
            cancelledAt: new Date().toISOString(),
            cancellationReason: 'Workflow timed out waiting for customer selection (7 days)',
          },
        });
        throw ApplicationFailure.nonRetryable('Workflow timed out waiting for customer selection after 7 days');
      }

      const selectionsEvent = selectionsSubmittedEvent!;
      log.info(`[${caseId}] Step 4: Customer selected, applying`, {
        selection: selectionsEvent.selections.customer,
      });

      await applySelections({
        caseId,
        tenantId,
        selections: selectionsEvent.selections,
        submittedBy: selectionsEvent.submittedBy,
        correlationId,
      });
    }

    log.info(`[${caseId}] Step 4: Customer resolved`, {
      customerId: customerResult.zohoCustomerId,
      customerName: customerResult.zohoCustomerName,
    });

    // -------------------------------------------------------------------------
    // Step 5: Resolve items
    // -------------------------------------------------------------------------
    updateState('resolving_items');
    log.info(`[${caseId}] Step 5: Resolving line items against Zoho catalog`);
    await updateCase({ caseId, tenantId, correlationId, status: 'resolving_items', eventType: 'customer_resolved' });

    const itemsResult: ResolveItemsOutput = await resolveItems({ caseId, tenantId });

    if (!itemsResult.success) {
      throw ApplicationFailure.nonRetryable('Item resolution failed');
    }

    if (itemsResult.needsHuman) {
      log.info(`[${caseId}] Step 5: Item resolution needs human selection`, {
        unresolvedLines: itemsResult.unresolvedLines,
      });

      await updateCase({ caseId, tenantId, correlationId, status: 'awaiting_item_selection', eventType: 'items_resolved' });
      await notifyUser({
        caseId,
        type: 'selection_needed',
        candidates: { items: itemsResult.candidates },
      });

      // Wait for item selections with timeout/escalation handling
      updateState('awaiting_item_selection', 'awaiting_user_input');
      log.info(`[${caseId}] Step 5: Waiting for item selections`);

      // Reset selections event to allow fresh selection
      selectionsSubmittedEvent = null;

      const itemSelectionWaitResult = await waitForHumanWithEscalation({
        conditionFn: () => selectionsSubmittedEvent !== null,
        waitType: 'item_selection',
        caseId,
        userId,
      });

      if (!itemSelectionWaitResult.received) {
        // Timed out waiting for item selection - auto-cancel workflow
        log.warn(`[${caseId}] Step 5: Item selection wait timed out, auto-cancelling workflow`);
        await updateCase({
          caseId,
          tenantId,
          correlationId,
          status: 'cancelled',
          eventType: 'workflow_cancelled',
          updates: {
            cancelledAt: new Date().toISOString(),
            cancellationReason: 'Workflow timed out waiting for item selection (7 days)',
          },
        });
        throw ApplicationFailure.nonRetryable('Workflow timed out waiting for item selection after 7 days');
      }

      const selectionsEvent = selectionsSubmittedEvent!;
      log.info(`[${caseId}] Step 5: Items selected, applying`, {
        selections: selectionsEvent.selections.items,
      });

      await applySelections({
        caseId,
        tenantId,
        selections: selectionsEvent.selections,
        submittedBy: selectionsEvent.submittedBy,
        correlationId,
      });
    }

    log.info(`[${caseId}] Step 5: All items resolved`);

    // -------------------------------------------------------------------------
    // Step 6: Await human approval
    // -------------------------------------------------------------------------
    updateState('awaiting_approval', 'awaiting_approval');
    log.info(`[${caseId}] Step 6: Ready for approval, notifying user`);
    await updateCase({ caseId, tenantId, correlationId, status: 'awaiting_approval', eventType: 'items_resolved' });

    await notifyUser({
      caseId,
      type: 'ready_for_approval',
    });

    // Wait for approval with timeout/escalation handling
    log.info(`[${caseId}] Step 6: Waiting for approval`);

    const approvalWaitResult = await waitForHumanWithEscalation({
      conditionFn: () => approvalReceivedEvent !== null,
      waitType: 'approval',
      caseId,
      userId,
    });

    if (!approvalWaitResult.received) {
      // Timed out waiting for approval - auto-cancel workflow
      log.warn(`[${caseId}] Step 6: Approval wait timed out, auto-cancelling workflow`);
      await updateCase({
        caseId,
        tenantId,
        correlationId,
        status: 'cancelled',
        eventType: 'workflow_cancelled',
        updates: {
          cancelledAt: new Date().toISOString(),
          cancellationReason: 'Workflow timed out waiting for approval (7 days)',
        },
      });
      throw ApplicationFailure.nonRetryable('Workflow timed out waiting for approval after 7 days');
    }

    const approvalEvent = approvalReceivedEvent!;

    if (!approvalEvent.approved) {
      log.info(`[${caseId}] Step 6: Order cancelled by user`, {
        approvedBy: approvalEvent.approvedBy,
        comments: approvalEvent.comments,
      });

      await updateCase({
        caseId,
        tenantId,
        correlationId,
        status: 'cancelled',
        eventType: 'workflow_cancelled',
        userId: approvalEvent.approvedBy,
        updates: {
          cancelledBy: approvalEvent.approvedBy,
          cancelledAt: approvalEvent.approvedAt,
          cancellationReason: approvalEvent.comments,
        },
      });

      return {
        status: 'cancelled',
      };
    }

    log.info(`[${caseId}] Step 6: Order approved`, {
      approvedBy: approvalEvent.approvedBy,
      approvedAt: approvalEvent.approvedAt,
    });

    // -------------------------------------------------------------------------
    // Step 7: Create Zoho draft sales order
    // -------------------------------------------------------------------------
    updateState('creating_zoho_draft');
    log.info(`[${caseId}] Step 7: Creating Zoho draft sales order`);
    await updateCase({ caseId, tenantId, correlationId, status: 'creating_zoho_draft', eventType: 'approval_received' });

    const zohoResult: CreateZohoDraftOutput = await createZohoDraftAggressive({ caseId });

    if (!zohoResult.success) {
      if (zohoResult.queued) {
        // Zoho is down, order queued for later
        log.info(`[${caseId}] Step 7: Zoho unavailable, order queued`, {
          error: zohoResult.error,
        });

        await notifyUser({
          caseId,
          type: 'issues',
          issues: [{
            code: 'ZOHO_UNAVAILABLE',
            message: 'Zoho is temporarily unavailable. Order queued for creation.',
          }],
        });

        await updateCase({
          caseId,
          tenantId,
          correlationId,
          status: 'queued_for_zoho',
          eventType: 'status_changed',
        });

        return {
          status: 'completed',
        };
      }

      throw ApplicationFailure.nonRetryable(`Failed to create Zoho draft: ${zohoResult.error}`);
    }

    log.info(`[${caseId}] Step 7: Zoho draft created successfully`, {
      salesorderId: zohoResult.salesorder_id,
      salesorderNumber: zohoResult.salesorder_number,
    });

    // -------------------------------------------------------------------------
    // Step 8: Finalize audit bundle
    // -------------------------------------------------------------------------
    updateState('finalizing_audit');
    log.info(`[${caseId}] Step 8: Finalizing audit bundle`);

    let auditManifestPath: string | undefined;
    try {
      const auditResult = await finalizeAudit({
        caseId,
        tenantId,
        userId,
        correlationId,
        zohoOrderId: zohoResult.salesorder_id,
      });

      if (auditResult.success) {
        auditManifestPath = auditResult.manifestPath;
        log.info(`[${caseId}] Step 8: Audit bundle finalized`, {
          manifestPath: auditResult.manifestPath,
          artifactCount: auditResult.artifactCount,
          manifestSha256: auditResult.manifestSha256,
        });
      } else {
        log.warn(`[${caseId}] Step 8: Audit finalization failed (non-blocking)`, {
          error: auditResult.error,
        });
      }
    } catch (auditError) {
      // Don't fail the workflow if audit finalization fails
      const auditErrorMessage = auditError instanceof Error ? auditError.message : String(auditError);
      log.warn(`[${caseId}] Step 8: Audit finalization error (non-blocking)`, {
        error: auditErrorMessage,
      });
    }

    // -------------------------------------------------------------------------
    // Step 9: Notify complete
    // -------------------------------------------------------------------------
    updateState('notifying_complete', 'completed');
    log.info(`[${caseId}] Step 9: Notifying user of completion`);

    await notifyUser({
      caseId,
      type: 'complete',
      zohoOrderId: zohoResult.salesorder_id,
      auditManifestPath,
    });

    await updateCase({
      caseId,
      tenantId,
      correlationId,
      status: 'completed',
      eventType: 'zoho_draft_created',
      updates: {
        completedAt: new Date().toISOString(),
        zohoSalesorderId: zohoResult.salesorder_id,
        zohoSalesorderNumber: zohoResult.salesorder_number,
      },
    });

    log.info(`[${caseId}] Workflow completed successfully`);

    return {
      status: 'completed',
      zohoOrderId: zohoResult.salesorder_id,
      zohoOrderNumber: zohoResult.salesorder_number,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`[${caseId}] Workflow failed with error`, { error: errorMessage });

    state.errors.push(errorMessage);
    updateState('failed', 'failed');

    // Notify user of failure
    await notifyUser({
      caseId,
      type: 'failed',
      reason: errorMessage,
    });

    await updateCase({
      caseId,
      tenantId,
      correlationId,
      status: 'failed',
      eventType: 'workflow_failed',
      updates: {
        failedAt: new Date().toISOString(),
        error: errorMessage,
      },
    });

    return {
      status: 'failed',
      error: errorMessage,
    };
  }
}

// ============================================================================
// Workflow Export
// ============================================================================

export default orderProcessingWorkflow;
