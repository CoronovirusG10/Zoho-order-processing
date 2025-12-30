/**
 * Temporal Workflow Types
 *
 * Type definitions for the Order Processing Temporal workflow,
 * including workflow input/output, signal events, and activity interfaces.
 */

// ============================================================================
// Workflow Input/Output Types
// ============================================================================

/**
 * Input for the order processing workflow
 */
export interface OrderProcessingInput {
  /** Unique identifier for this order case */
  caseId: string;
  /** Azure Blob Storage URL for the uploaded Excel file */
  blobUrl: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** User who initiated the order */
  userId: string;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** Microsoft Teams context for notifications */
  teams: TeamsContext;
}

/**
 * Microsoft Teams context for sending notifications back to the user
 */
export interface TeamsContext {
  chatId: string;
  messageId: string;
  activityId: string;
}

/**
 * Output from the order processing workflow
 */
export interface OrderProcessingOutput {
  /** Final status of the workflow */
  status: 'completed' | 'cancelled' | 'failed';
  /** Zoho Sales Order ID if successfully created */
  zohoOrderId?: string;
  /** Zoho Sales Order number if successfully created */
  zohoOrderNumber?: string;
  /** Error message if workflow failed */
  error?: string;
}

// ============================================================================
// Signal Event Types
// ============================================================================

/**
 * Event sent when user re-uploads a file after blocking issue detected
 */
export interface FileReuploadedEvent {
  caseId: string;
  /** New blob URL for the re-uploaded file */
  blobUrl: string;
  /** New correlation ID for the retry */
  correlationId: string;
}

/**
 * Event sent when user submits corrections for committee disagreements
 */
export interface CorrectionsSubmittedEvent {
  caseId: string;
  /** User corrections for disputed mappings */
  corrections: CorrectionData;
  /** User who submitted corrections */
  submittedBy: string;
  /** ISO timestamp of submission */
  submittedAt: string;
}

/**
 * Correction data structure for disputed field mappings
 */
export interface CorrectionData {
  [field: string]: {
    originalValue: unknown;
    correctedValue: unknown;
    notes?: string;
  };
}

/**
 * Event sent when user makes selections for ambiguous matches
 */
export interface SelectionsSubmittedEvent {
  caseId: string;
  /** User selections for customer and/or items */
  selections: SelectionData;
  /** User who made selections */
  submittedBy: string;
  /** ISO timestamp of submission */
  submittedAt: string;
}

/**
 * Selection data for customer and item disambiguation
 */
export interface SelectionData {
  /** Selected customer if disambiguation was needed */
  customer?: {
    zohoCustomerId: string;
  };
  /** Selected items by line number if disambiguation was needed */
  items?: Record<number, {
    zohoItemId: string;
  }>;
}

/**
 * Event sent when user approves or rejects the order
 */
export interface ApprovalReceivedEvent {
  caseId: string;
  /** Whether the order was approved */
  approved: boolean;
  /** User who made the approval decision */
  approvedBy: string;
  /** ISO timestamp of approval */
  approvedAt: string;
  /** Optional comments from approver */
  comments?: string;
}

// ============================================================================
// Activity Input Types
// ============================================================================

/**
 * Input for StoreFile activity
 */
export interface StoreFileInput {
  caseId: string;
  blobUrl: string;
}

/**
 * Output from StoreFile activity
 */
export interface StoreFileOutput {
  success: boolean;
  storedPath: string;
  sha256: string;
  error?: string;
}

/**
 * Input for ParseExcel activity
 */
export interface ParseExcelInput {
  caseId: string;
}

/**
 * Output from ParseExcel activity
 */
export interface ParseExcelOutput {
  success: boolean;
  /** Whether the file is blocked (formulas, protected, etc.) */
  blocked: boolean;
  /** Reason for blocking if blocked is true */
  blockReason?: string;
  /** Whether file contains formulas that were evaluated */
  containsFormulas?: boolean;
  /** Parsed and normalized order data */
  canonicalData?: CanonicalOrderData;
  /** Issues found during parsing */
  issues?: ParseIssue[];
}

/**
 * Canonical order data structure after parsing
 */
export interface CanonicalOrderData {
  customerInfo: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
  };
  lineItems: LineItem[];
  orderMeta: {
    orderDate?: string;
    deliveryDate?: string;
    poNumber?: string;
    notes?: string;
  };
}

/**
 * Line item from parsed Excel
 */
export interface LineItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number;
  sku?: string;
  gtin?: string;
}

/**
 * Issue found during Excel parsing
 */
export interface ParseIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    sheet?: string;
    row?: number;
    column?: string;
  };
}

/**
 * Input for RunCommittee activity
 */
export interface RunCommitteeInput {
  caseId: string;
}

/**
 * Output from RunCommittee activity
 */
export interface RunCommitteeOutput {
  success: boolean;
  /** Whether human intervention is needed */
  needsHuman: boolean;
  /** Level of consensus achieved */
  consensus: 'unanimous' | 'majority' | 'split' | 'no_consensus';
  /** Details of disagreements requiring resolution */
  disagreements?: CommitteeDisagreement[];
}

/**
 * Committee disagreement requiring human resolution
 */
export interface CommitteeDisagreement {
  field: string;
  votes: Record<string, string>;
  confidence: Record<string, number>;
}

/**
 * Input for ResolveCustomer activity
 */
export interface ResolveCustomerInput {
  caseId: string;
  tenantId: string;
}

/**
 * Output from ResolveCustomer activity
 */
export interface ResolveCustomerOutput {
  success: boolean;
  /** Whether customer was definitively resolved */
  resolved: boolean;
  /** Whether human selection is needed */
  needsHuman: boolean;
  /** Resolved Zoho customer ID */
  zohoCustomerId?: string;
  /** Resolved Zoho customer name */
  zohoCustomerName?: string;
  /** Candidate matches if disambiguation needed */
  candidates?: CustomerCandidate[];
}

/**
 * Customer candidate for disambiguation
 */
export interface CustomerCandidate {
  zohoCustomerId: string;
  zohoCustomerName: string;
  score: number;
  matchReasons?: string[];
}

/**
 * Input for ResolveItems activity
 */
export interface ResolveItemsInput {
  caseId: string;
  tenantId: string;
}

/**
 * Output from ResolveItems activity
 */
export interface ResolveItemsOutput {
  success: boolean;
  /** Whether all items were resolved */
  allResolved: boolean;
  /** Whether human selection is needed */
  needsHuman: boolean;
  /** Line numbers that couldn't be resolved */
  unresolvedLines?: number[];
  /** Candidate matches by line number */
  candidates?: Record<number, ItemCandidate[]>;
}

/**
 * Item candidate for disambiguation
 */
export interface ItemCandidate {
  zohoItemId: string;
  sku?: string;
  name: string;
  gtin?: string;
  score: number;
  matchReasons?: string[];
}

/**
 * Input for CreateZohoDraft activity
 */
export interface CreateZohoDraftInput {
  caseId: string;
}

/**
 * Output from CreateZohoDraft activity
 */
export interface CreateZohoDraftOutput {
  success: boolean;
  /** Zoho Sales Order ID */
  salesorder_id?: string;
  /** Zoho Sales Order number */
  salesorder_number?: string;
  /** Status from Zoho API */
  status?: string;
  /** Error message if failed */
  error?: string;
  /** Whether order was queued for later (Zoho unavailable) */
  queued?: boolean;
  /** Whether the order was a duplicate (idempotency check) */
  is_duplicate?: boolean;
}

/**
 * Input for NotifyUser activity
 */
export interface NotifyUserInput {
  caseId: string;
  type: NotificationType;
  reason?: string;
  issues?: unknown[];
  candidates?: unknown;
  zohoOrderId?: string;
  /** Path to audit manifest in blob storage (for completion notifications) */
  auditManifestPath?: string;
  /** Wait context for reminder/escalation/timeout notifications */
  waitContext?: HumanWaitContext;
}

/**
 * Context for human wait scenarios (reminders, escalations, timeouts)
 */
export interface HumanWaitContext {
  /** Type of wait (what action is being awaited) */
  waitType: 'corrections' | 'customer_selection' | 'item_selection' | 'approval';
  /** How long the workflow has been waiting */
  waitDuration: string;
  /** User who should respond */
  userId?: string;
  /** Manager to escalate to (if configured) */
  managerUserId?: string;
  /** Time until auto-cancel (for timeout_warning) */
  timeUntilCancel?: string;
}

/**
 * Duration string type compatible with Temporal.io Duration
 * Examples: '24h', '48h', '1d', '7d', '5m', '30s'
 */
export type DurationString = `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

/**
 * Configuration for human wait timeouts
 */
export interface HumanWaitTimeoutConfig {
  /** Time until first reminder (e.g., '24h') */
  reminderAfter: DurationString;
  /** Time until escalation (e.g., '48h') */
  escalationAfter: DurationString;
  /** Maximum wait time before auto-cancel (e.g., '7d') */
  maxWait: DurationString;
}

/**
 * Default timeout configuration for human waits
 */
export const DEFAULT_HUMAN_WAIT_TIMEOUT: HumanWaitTimeoutConfig = {
  reminderAfter: '24h',
  escalationAfter: '48h',
  maxWait: '7d',
};

/**
 * Types of notifications that can be sent to users
 */
export type NotificationType =
  | 'blocked'
  | 'issues'
  | 'selection_needed'
  | 'ready_for_approval'
  | 'complete'
  | 'failed'
  | 'reminder'           // Reminder after waiting too long
  | 'escalation'         // Escalation notification (manager included)
  | 'timeout_warning';   // Final warning before auto-cancel

/**
 * Output from NotifyUser activity
 */
export interface NotifyUserOutput {
  success: boolean;
  messageId?: string;
}

/**
 * Event types for case updates
 */
export type UpdateCaseEventType =
  | 'case_created'
  | 'status_changed'
  | 'file_stored'
  | 'file_parsed'
  | 'committee_completed'
  | 'corrections_submitted'
  | 'customer_resolved'
  | 'customer_selection_submitted'
  | 'items_resolved'
  | 'item_selection_submitted'
  | 'approval_received'
  | 'zoho_draft_created'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled';

/**
 * Input for UpdateCase activity
 */
export interface UpdateCaseInput {
  caseId: string;
  tenantId: string;
  status: CaseStatus;
  updates?: Record<string, unknown>;
  eventType?: UpdateCaseEventType;
  userId?: string;
  correlationId?: string;
}

/**
 * Valid case statuses
 */
export type CaseStatus =
  | 'storing_file'
  | 'parsing'
  | 'running_committee'
  | 'awaiting_corrections'
  | 'resolving_customer'
  | 'awaiting_customer_selection'
  | 'resolving_items'
  | 'awaiting_item_selection'
  | 'awaiting_approval'
  | 'creating_zoho_draft'
  | 'queued_for_zoho'
  | 'completed'
  | 'cancelled'
  | 'failed';

/**
 * Output from UpdateCase activity
 */
export interface UpdateCaseOutput {
  success: boolean;
}

/**
 * Input for ApplyCorrections activity
 */
export interface ApplyCorrectionsInput {
  caseId: string;
  tenantId: string;
  corrections: CorrectionData;
  submittedBy: string;
  correlationId: string;
}

/**
 * Output from ApplyCorrections activity
 */
export interface ApplyCorrectionsOutput {
  success: boolean;
  appliedCount?: number;
  validationPassed?: boolean;
  newVersion?: string;
  errors?: string[];
}

/**
 * Input for ApplySelections activity
 */
export interface ApplySelectionsInput {
  caseId: string;
  tenantId: string;
  selections: SelectionData;
  submittedBy: string;
  correlationId: string;
}

/**
 * Output from ApplySelections activity
 */
export interface ApplySelectionsOutput {
  success: boolean;
  customerApplied?: boolean;
  itemsApplied?: number;
  newVersion?: string;
  errors?: string[];
}

// ============================================================================
// Workflow State Types
// ============================================================================

/**
 * Internal workflow state for tracking signal events
 */
export interface WorkflowSignalState {
  fileReuploadEvent: FileReuploadedEvent | null;
  correctionsEvent: CorrectionsSubmittedEvent | null;
  selectionsEvent: SelectionsSubmittedEvent | null;
  approvalEvent: ApprovalReceivedEvent | null;
}

/**
 * Workflow execution metadata for logging and debugging
 */
export interface WorkflowExecutionContext {
  caseId: string;
  correlationId: string;
  tenantId: string;
  userId: string;
  startedAt: string;
  currentStep: string;
}

// ============================================================================
// Finalize Audit Types
// ============================================================================

/**
 * Input for FinalizeAudit activity
 */
export interface FinalizeAuditInput {
  caseId: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
  /** Zoho order ID to include in audit manifest */
  zohoOrderId?: string;
}

/**
 * Output from FinalizeAudit activity
 */
export interface FinalizeAuditOutput {
  success: boolean;
  /** Path to the audit manifest in blob storage */
  manifestPath?: string;
  /** SHA-256 hash of the manifest */
  manifestSha256?: string;
  /** Number of artifacts collected */
  artifactCount?: number;
  /** Error message if failed */
  error?: string;
}
