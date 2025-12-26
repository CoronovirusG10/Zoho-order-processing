/**
 * Workflow Exports
 *
 * This file exports all workflows for the Temporal worker.
 * The worker's workflowsPath points to this file to register all workflows.
 */

// Main workflow export
export {
  orderProcessingWorkflow,
  default as orderProcessingWorkflowDefault,
} from './order-processing.workflow';

// Signal exports for sending signals to running workflows
export {
  fileReuploadedSignal,
  correctionsSubmittedSignal,
  selectionsSubmittedSignal,
  approvalReceivedSignal,
} from './order-processing.workflow';

// Query exports for querying workflow state
export {
  getStateQuery,
} from './order-processing.workflow';

// Type exports for workflow clients
export type {
  OrderProcessingInput,
  OrderProcessingOutput,
  OrderProcessingResult,
  FileReuploadedEvent,
  CorrectionsSubmittedEvent,
  SelectionsSubmittedEvent,
  ApprovalReceivedEvent,
} from './order-processing.workflow';

// Re-export all types from types.ts for consumers
export type {
  TeamsContext,
  CorrectionData,
  SelectionData,
  StoreFileInput,
  StoreFileOutput,
  ParseExcelInput,
  ParseExcelOutput,
  CanonicalOrderData,
  LineItem,
  ParseIssue,
  RunCommitteeInput,
  RunCommitteeOutput,
  CommitteeDisagreement,
  ResolveCustomerInput,
  ResolveCustomerOutput,
  CustomerCandidate,
  ResolveItemsInput,
  ResolveItemsOutput,
  ItemCandidate,
  CreateZohoDraftInput,
  CreateZohoDraftOutput,
  NotifyUserInput,
  NotifyUserOutput,
  NotificationType,
  UpdateCaseInput,
  UpdateCaseOutput,
  CaseStatus,
  ApplyCorrectionsInput,
  ApplyCorrectionsOutput,
  ApplySelectionsInput,
  ApplySelectionsOutput,
  WorkflowSignalState,
  WorkflowExecutionContext,
} from './types';
