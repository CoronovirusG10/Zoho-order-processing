/**
 * Order Processing Orchestration
 *
 * Main durable orchestration for processing Excel orders through the full workflow:
 * 1. Store file
 * 2. Parse Excel
 * 3. Run committee (if needed)
 * 4. Resolve customer
 * 5. Resolve items
 * 6. Await approval
 * 7. Create Zoho draft
 * 8. Notify complete
 */

import * as df from 'durable-functions';
import { RetryPolicies } from '../utils/durable-client';
import {
  OrderWorkflowInput,
  ParseExcelOutput,
  RunCommitteeOutput,
  ResolveCustomerOutput,
  ResolveItemsOutput,
  CreateZohoDraftOutput,
  WorkflowResult,
  FileReuploadedEvent,
  CorrectionsSubmittedEvent,
  SelectionsSubmittedEvent,
  ApprovalReceivedEvent,
} from '../types';

const orderProcessingOrchestrator: df.OrchestrationHandler = function* (
  context: df.OrchestrationContext
) {
  const input = context.df.getInput<OrderWorkflowInput>();
  const { caseId, correlationId } = input;

  // Set up logging context - v3 API uses context.log() directly
  const log = (step: string, message: string, data?: unknown) => {
    if (!context.df.isReplaying) {
      context.log(`[${caseId}] ${step}: ${message}`, data ? JSON.stringify(data) : '');
    }
  };

  try {
    log('orchestration', 'Starting order processing workflow', { input });

    // Step 1: Store file in blob storage
    log('step-1', 'Storing uploaded file');
    const storeResult = yield context.df.callActivityWithRetry(
      'StoreFile',
      RetryPolicies.standard(),
      {
        caseId,
        blobUrl: input.blobUrl,
      }
    );

    if (!storeResult.success) {
      throw new Error(`Failed to store file: ${storeResult.error}`);
    }

    log('step-1', 'File stored successfully', {
      path: storeResult.storedPath,
      sha256: storeResult.sha256,
    });

    // Step 2: Parse Excel
    log('step-2', 'Parsing Excel file');
    const parseResult: ParseExcelOutput = yield context.df.callActivityWithRetry(
      'ParseExcel',
      RetryPolicies.standard(),
      { caseId }
    );

    // Handle blocked scenarios (formulas, protected workbook, etc.)
    if (parseResult.blocked) {
      log('step-2', 'File is blocked', { reason: parseResult.blockReason });

      yield context.df.callActivity('NotifyUser', {
        caseId,
        type: 'blocked',
        reason: parseResult.blockReason,
      });

      // Wait for user to re-upload
      log('step-2', 'Waiting for file reupload');
      const reupload: FileReuploadedEvent = yield context.df.waitForExternalEvent(
        'FileReuploaded'
      );

      // Restart workflow with new file
      log('step-2', 'File reuploaded, restarting workflow', { reupload });
      context.df.continueAsNew({
        ...input,
        blobUrl: reupload.blobUrl,
        correlationId: reupload.correlationId,
      });
      return;
    }

    if (!parseResult.success) {
      throw new Error('Excel parsing failed');
    }

    log('step-2', 'Excel parsed successfully', {
      issueCount: parseResult.issues?.length || 0,
    });

    // Step 3: Run committee (bounded mapping cross-check)
    log('step-3', 'Running committee mapping validation');
    const committeeResult: RunCommitteeOutput = yield context.df.callActivityWithRetry(
      'RunCommittee',
      RetryPolicies.standard(),
      { caseId }
    );

    if (!committeeResult.success) {
      throw new Error('Committee validation failed');
    }

    // Handle committee disagreements
    if (committeeResult.needsHuman) {
      log('step-3', 'Committee needs human intervention', {
        consensus: committeeResult.consensus,
        disagreements: committeeResult.disagreements,
      });

      yield context.df.callActivity('NotifyUser', {
        caseId,
        type: 'issues',
        issues: committeeResult.disagreements,
      });

      // Wait for user corrections
      log('step-3', 'Waiting for user corrections');
      const corrections: CorrectionsSubmittedEvent = yield context.df.waitForExternalEvent(
        'CorrectionsSubmitted'
      );

      log('step-3', 'Corrections received, applying', { corrections });
      yield context.df.callActivity('ApplyCorrections', {
        caseId,
        corrections: corrections.corrections,
      });
    }

    log('step-3', 'Committee validation complete');

    // Step 4: Resolve customer
    log('step-4', 'Resolving customer against Zoho');
    const customerResult: ResolveCustomerOutput = yield context.df.callActivityWithRetry(
      'ResolveCustomer',
      RetryPolicies.standard(),
      { caseId }
    );

    if (!customerResult.success) {
      throw new Error('Customer resolution failed');
    }

    if (customerResult.needsHuman) {
      log('step-4', 'Customer resolution needs human selection', {
        candidateCount: customerResult.candidates?.length || 0,
      });

      yield context.df.callActivity('NotifyUser', {
        caseId,
        type: 'selection_needed',
        candidates: {
          customer: customerResult.candidates,
        },
      });

      // Wait for customer selection
      log('step-4', 'Waiting for customer selection');
      const selections: SelectionsSubmittedEvent = yield context.df.waitForExternalEvent(
        'SelectionsSubmitted'
      );

      log('step-4', 'Customer selected, applying', {
        selection: selections.selections.customer,
      });
      yield context.df.callActivity('ApplySelections', {
        caseId,
        selections: selections.selections,
      });
    }

    log('step-4', 'Customer resolved', {
      customerId: customerResult.zohoCustomerId,
      customerName: customerResult.zohoCustomerName,
    });

    // Step 5: Resolve items
    log('step-5', 'Resolving line items against Zoho catalog');
    const itemsResult: ResolveItemsOutput = yield context.df.callActivityWithRetry(
      'ResolveItems',
      RetryPolicies.standard(),
      { caseId }
    );

    if (!itemsResult.success) {
      throw new Error('Item resolution failed');
    }

    if (itemsResult.needsHuman) {
      log('step-5', 'Item resolution needs human selection', {
        unresolvedLines: itemsResult.unresolvedLines,
      });

      yield context.df.callActivity('NotifyUser', {
        caseId,
        type: 'selection_needed',
        candidates: {
          items: itemsResult.candidates,
        },
      });

      // Wait for item selections
      log('step-5', 'Waiting for item selections');
      const selections: SelectionsSubmittedEvent = yield context.df.waitForExternalEvent(
        'SelectionsSubmitted'
      );

      log('step-5', 'Items selected, applying', {
        selections: selections.selections.items,
      });
      yield context.df.callActivity('ApplySelections', {
        caseId,
        selections: selections.selections,
      });
    }

    log('step-5', 'All items resolved');

    // Step 6: Await human approval
    log('step-6', 'Ready for approval, notifying user');
    yield context.df.callActivity('NotifyUser', {
      caseId,
      type: 'ready_for_approval',
    });

    log('step-6', 'Waiting for approval');
    const approval: ApprovalReceivedEvent = yield context.df.waitForExternalEvent(
      'ApprovalReceived'
    );

    if (!approval.approved) {
      log('step-6', 'Order cancelled by user', {
        approvedBy: approval.approvedBy,
        comments: approval.comments,
      });

      yield context.df.callActivity('UpdateCase', {
        caseId,
        status: 'cancelled',
        updates: {
          cancelledBy: approval.approvedBy,
          cancelledAt: approval.approvedAt,
          cancellationReason: approval.comments,
        },
      });

      const result: WorkflowResult = {
        status: 'cancelled',
      };
      return result;
    }

    log('step-6', 'Order approved', {
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
    });

    // Step 7: Create Zoho draft sales order
    log('step-7', 'Creating Zoho draft sales order');
    const zohoResult: CreateZohoDraftOutput = yield context.df.callActivityWithRetry(
      'CreateZohoDraft',
      RetryPolicies.aggressive(),
      { caseId }
    );

    if (!zohoResult.success) {
      if (zohoResult.queued) {
        // Zoho is down, order queued for later
        log('step-7', 'Zoho unavailable, order queued', { error: zohoResult.error });

        yield context.df.callActivity('NotifyUser', {
          caseId,
          type: 'issues',
          issues: [
            {
              code: 'ZOHO_UNAVAILABLE',
              message: 'Zoho is temporarily unavailable. Order queued for creation.',
            },
          ],
        });

        yield context.df.callActivity('UpdateCase', {
          caseId,
          status: 'queued_for_zoho',
        });

        const queuedResult: WorkflowResult = {
          status: 'completed',
        };
        return queuedResult;
      }

      throw new Error(`Failed to create Zoho draft: ${zohoResult.error}`);
    }

    log('step-7', 'Zoho draft created successfully', {
      salesorderId: zohoResult.salesorder_id,
      salesorderNumber: zohoResult.salesorder_number,
    });

    // Step 8: Notify complete
    log('step-8', 'Notifying user of completion');
    yield context.df.callActivity('NotifyUser', {
      caseId,
      type: 'complete',
      zohoOrderId: zohoResult.salesorder_id,
    });

    yield context.df.callActivity('UpdateCase', {
      caseId,
      status: 'completed',
      updates: {
        completedAt: context.df.currentUtcDateTime,
        zohoSalesorderId: zohoResult.salesorder_id,
        zohoSalesorderNumber: zohoResult.salesorder_number,
      },
    });

    log('orchestration', 'Workflow completed successfully');

    const successResult: WorkflowResult = {
      status: 'completed',
      zohoOrderId: zohoResult.salesorder_id,
    };
    return successResult;
  } catch (error) {
    log('orchestration', 'Workflow failed with error', { error });

    // Notify user of failure
    yield context.df.callActivity('NotifyUser', {
      caseId,
      type: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    });

    yield context.df.callActivity('UpdateCase', {
      caseId,
      status: 'failed',
      updates: {
        failedAt: context.df.currentUtcDateTime,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    const failedResult: WorkflowResult = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
    return failedResult;
  }
};

// Register the orchestrator
df.app.orchestration('OrderProcessingOrchestrator', orderProcessingOrchestrator);

export default orderProcessingOrchestrator;
