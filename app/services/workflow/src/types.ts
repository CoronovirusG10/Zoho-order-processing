/**
 * Workflow Orchestrator Types
 */

export interface OrderWorkflowInput {
  caseId: string;
  blobUrl: string;
  tenantId: string;
  userId: string;
  correlationId: string;
  teams: {
    chatId: string;
    messageId: string;
    activityId: string;
  };
}

export interface WorkflowState {
  caseId: string;
  status: WorkflowStatus;
  currentStep: WorkflowStep;
  retryCount: number;
  errors: WorkflowError[];
  metadata: Record<string, unknown>;
}

export type WorkflowStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_user_input'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowStep =
  | 'file_received'
  | 'storing_file'
  | 'parsing_excel'
  | 'running_committee'
  | 'resolving_customer'
  | 'resolving_items'
  | 'awaiting_approval'
  | 'creating_zoho_draft'
  | 'notifying_complete';

export interface WorkflowError {
  step: WorkflowStep;
  timestamp: string;
  message: string;
  code?: string;
  retryable: boolean;
  details?: unknown;
}

// Activity function inputs/outputs

export interface StoreFileInput {
  caseId: string;
  blobUrl: string;
}

export interface StoreFileOutput {
  success: boolean;
  storedPath: string;
  sha256: string;
}

export interface ParseExcelInput {
  caseId: string;
}

export interface ParseExcelOutput {
  success: boolean;
  blocked: boolean;
  blockReason?: string;
  containsFormulas?: boolean;
  canonicalData?: unknown;
  issues?: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
}

export interface RunCommitteeInput {
  caseId: string;
}

export interface RunCommitteeOutput {
  success: boolean;
  needsHuman: boolean;
  consensus: 'unanimous' | 'majority' | 'split' | 'no_consensus';
  disagreements?: Array<{
    field: string;
    votes: Record<string, string>;
  }>;
}

export interface ResolveCustomerInput {
  caseId: string;
}

export interface ResolveCustomerOutput {
  success: boolean;
  resolved: boolean;
  needsHuman: boolean;
  zohoCustomerId?: string;
  zohoCustomerName?: string;
  candidates?: Array<{
    zohoCustomerId: string;
    zohoCustomerName: string;
    score: number;
  }>;
}

export interface ResolveItemsInput {
  caseId: string;
}

export interface ResolveItemsOutput {
  success: boolean;
  allResolved: boolean;
  needsHuman: boolean;
  unresolvedLines?: number[];
  candidates?: Record<number, Array<{
    zohoItemId: string;
    sku?: string;
    name: string;
    gtin?: string;
    score: number;
  }>>;
}

export interface CreateZohoDraftInput {
  caseId: string;
}

export interface CreateZohoDraftOutput {
  success: boolean;
  salesorder_id?: string;
  salesorder_number?: string;
  status?: string;
  error?: string;
  queued?: boolean;
}

export interface NotifyUserInput {
  caseId: string;
  type: NotificationType;
  reason?: string;
  issues?: unknown[];
  candidates?: unknown;
  zohoOrderId?: string;
}

export type NotificationType =
  | 'blocked'
  | 'issues'
  | 'selection_needed'
  | 'ready_for_approval'
  | 'complete'
  | 'failed';

export interface NotifyUserOutput {
  success: boolean;
  messageId?: string;
}

export interface UpdateCaseInput {
  caseId: string;
  status: string;
  updates?: Record<string, unknown>;
}

export interface UpdateCaseOutput {
  success: boolean;
}

export interface ApplyCorrectionsInput {
  caseId: string;
  corrections: unknown;
}

export interface ApplyCorrectionsOutput {
  success: boolean;
}

export interface ApplySelectionsInput {
  caseId: string;
  selections: {
    customer?: {
      zohoCustomerId: string;
    };
    items?: Record<number, {
      zohoItemId: string;
    }>;
  };
}

export interface ApplySelectionsOutput {
  success: boolean;
}

// External events

export interface FileReuploadedEvent {
  caseId: string;
  blobUrl: string;
  correlationId: string;
}

export interface CorrectionsSubmittedEvent {
  caseId: string;
  corrections: unknown;
  submittedBy: string;
  submittedAt: string;
}

export interface SelectionsSubmittedEvent {
  caseId: string;
  selections: {
    customer?: {
      zohoCustomerId: string;
    };
    items?: Record<number, {
      zohoItemId: string;
    }>;
  };
  submittedBy: string;
  submittedAt: string;
}

export interface ApprovalReceivedEvent {
  caseId: string;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
  comments?: string;
}

// Workflow result

export interface WorkflowResult {
  status: 'completed' | 'cancelled' | 'failed';
  zohoOrderId?: string;
  error?: string;
  finalState?: WorkflowState;
}
