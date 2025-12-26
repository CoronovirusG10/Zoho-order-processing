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
  CaseStatus,
} from './types';

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
} from './types';

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
    await updateCase({ caseId, status: 'storing_file' });

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
    await updateCase({ caseId, status: 'parsing' });

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
    await updateCase({ caseId, status: 'running_committee' });

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

      await updateCase({ caseId, status: 'awaiting_corrections' });
      await notifyUser({
        caseId,
        type: 'issues',
        issues: committeeResult.disagreements,
      });

      // Wait for user corrections
      updateState('awaiting_corrections', 'awaiting_user_input');
      log.info(`[${caseId}] Step 3: Waiting for user corrections`);
      await condition(() => correctionsSubmittedEvent !== null);

      const correctionsEvent = correctionsSubmittedEvent!;
      log.info(`[${caseId}] Step 3: Corrections received, applying`, {
        submittedBy: correctionsEvent.submittedBy,
      });

      await applyCorrections({
        caseId,
        corrections: correctionsEvent.corrections,
      });
    }

    log.info(`[${caseId}] Step 3: Committee validation complete`);

    // -------------------------------------------------------------------------
    // Step 4: Resolve customer
    // -------------------------------------------------------------------------
    updateState('resolving_customer');
    log.info(`[${caseId}] Step 4: Resolving customer against Zoho`);
    await updateCase({ caseId, status: 'resolving_customer' });

    const customerResult: ResolveCustomerOutput = await resolveCustomer({ caseId });

    if (!customerResult.success) {
      throw ApplicationFailure.nonRetryable('Customer resolution failed');
    }

    if (customerResult.needsHuman) {
      log.info(`[${caseId}] Step 4: Customer resolution needs human selection`, {
        candidateCount: customerResult.candidates?.length || 0,
      });

      await updateCase({ caseId, status: 'awaiting_customer_selection' });
      await notifyUser({
        caseId,
        type: 'selection_needed',
        candidates: { customer: customerResult.candidates },
      });

      // Wait for customer selection
      updateState('awaiting_customer_selection', 'awaiting_user_input');
      log.info(`[${caseId}] Step 4: Waiting for customer selection`);

      // Reset selections event to allow fresh selection
      selectionsSubmittedEvent = null;
      await condition(() => selectionsSubmittedEvent !== null);

      const selectionsEvent = selectionsSubmittedEvent!;
      log.info(`[${caseId}] Step 4: Customer selected, applying`, {
        selection: selectionsEvent.selections.customer,
      });

      await applySelections({
        caseId,
        selections: selectionsEvent.selections,
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
    await updateCase({ caseId, status: 'resolving_items' });

    const itemsResult: ResolveItemsOutput = await resolveItems({ caseId });

    if (!itemsResult.success) {
      throw ApplicationFailure.nonRetryable('Item resolution failed');
    }

    if (itemsResult.needsHuman) {
      log.info(`[${caseId}] Step 5: Item resolution needs human selection`, {
        unresolvedLines: itemsResult.unresolvedLines,
      });

      await updateCase({ caseId, status: 'awaiting_item_selection' });
      await notifyUser({
        caseId,
        type: 'selection_needed',
        candidates: { items: itemsResult.candidates },
      });

      // Wait for item selections
      updateState('awaiting_item_selection', 'awaiting_user_input');
      log.info(`[${caseId}] Step 5: Waiting for item selections`);

      // Reset selections event to allow fresh selection
      selectionsSubmittedEvent = null;
      await condition(() => selectionsSubmittedEvent !== null);

      const selectionsEvent = selectionsSubmittedEvent!;
      log.info(`[${caseId}] Step 5: Items selected, applying`, {
        selections: selectionsEvent.selections.items,
      });

      await applySelections({
        caseId,
        selections: selectionsEvent.selections,
      });
    }

    log.info(`[${caseId}] Step 5: All items resolved`);

    // -------------------------------------------------------------------------
    // Step 6: Await human approval
    // -------------------------------------------------------------------------
    updateState('awaiting_approval', 'awaiting_approval');
    log.info(`[${caseId}] Step 6: Ready for approval, notifying user`);
    await updateCase({ caseId, status: 'awaiting_approval' });

    await notifyUser({
      caseId,
      type: 'ready_for_approval',
    });

    log.info(`[${caseId}] Step 6: Waiting for approval`);
    await condition(() => approvalReceivedEvent !== null);

    const approvalEvent = approvalReceivedEvent!;

    if (!approvalEvent.approved) {
      log.info(`[${caseId}] Step 6: Order cancelled by user`, {
        approvedBy: approvalEvent.approvedBy,
        comments: approvalEvent.comments,
      });

      await updateCase({
        caseId,
        status: 'cancelled',
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
    await updateCase({ caseId, status: 'creating_zoho_draft' });

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
          status: 'queued_for_zoho',
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
    // Step 8: Notify complete
    // -------------------------------------------------------------------------
    updateState('notifying_complete', 'completed');
    log.info(`[${caseId}] Step 8: Notifying user of completion`);

    await notifyUser({
      caseId,
      type: 'complete',
      zohoOrderId: zohoResult.salesorder_id,
    });

    await updateCase({
      caseId,
      status: 'completed',
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
      status: 'failed',
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
