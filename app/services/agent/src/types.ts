/**
 * Azure AI Foundry Agent Service Types
 *
 * Types for the agent integration that handles conversation and tool calling
 * for validating and correcting parsed order data.
 */

import type { CanonicalSalesOrder, Issue } from '@order-processing/types';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Azure AI Foundry endpoint */
  endpoint: string;
  /** Model deployment name */
  deploymentName: string;
  /** API version */
  apiVersion: string;
  /** Max tokens for responses */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Agent thread state stored in Cosmos
 */
export interface AgentThreadState {
  /** Thread ID from Azure AI Foundry */
  threadId: string;
  /** Associated case ID */
  caseId: string;
  /** Tenant ID for partitioning */
  tenantId: string;
  /** User ID who owns the thread */
  userId: string;
  /** Current conversation status */
  status: AgentThreadStatus;
  /** Thread creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Current issues being addressed */
  pendingIssues: string[];
  /** Number of messages in thread */
  messageCount: number;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Cosmos partition key */
  _partitionKey?: string;
}

/**
 * Agent thread status
 */
export type AgentThreadStatus =
  | 'active'
  | 'awaiting_user'
  | 'awaiting_tool'
  | 'completed'
  | 'failed'
  | 'expired';

/**
 * Case context passed to the agent
 */
export interface CaseContext {
  /** Case ID */
  caseId: string;
  /** Tenant ID */
  tenantId: string;
  /** User ID */
  userId: string;
  /** Canonical order data */
  canonicalOrder: CanonicalSalesOrder;
  /** Current issues requiring resolution */
  issues: Issue[];
  /** File name for reference */
  fileName: string;
  /** Correlation ID */
  correlationId: string;
}

/**
 * Tool call request from the agent
 */
export interface ToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Tool name */
  name: ToolName;
  /** Tool arguments as JSON */
  arguments: Record<string, unknown>;
}

/**
 * Available tool names
 */
export type ToolName =
  | 'get_case'
  | 'revalidate_case'
  | 'create_zoho_draft'
  | 'lookup_candidates'
  | 'committee_map_fields';

/**
 * Tool result returned to the agent
 */
export interface ToolResult {
  /** Tool call ID */
  toolCallId: string;
  /** Result content */
  content: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Get case tool arguments
 */
export interface GetCaseArgs {
  caseId: string;
}

/**
 * Get case tool result
 */
export interface GetCaseResult {
  caseId: string;
  status: string;
  canonicalOrder: CanonicalSalesOrder;
  issues: Issue[];
}

/**
 * Revalidate case tool arguments (JSON Patch style)
 */
export interface RevalidateCaseArgs {
  caseId: string;
  patch: JsonPatchOperation[];
}

/**
 * JSON Patch operation (RFC 6902)
 */
export interface JsonPatchOperation {
  /** Operation type */
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  /** Target path */
  path: string;
  /** Value for add/replace/test operations */
  value?: unknown;
  /** Source path for move/copy operations */
  from?: string;
}

/**
 * Revalidate case tool result
 */
export interface RevalidateCaseResult {
  success: boolean;
  newIssues: Issue[];
  resolvedIssues: string[];
  validationPassed: boolean;
}

/**
 * Create Zoho draft tool arguments
 */
export interface CreateZohoDraftArgs {
  caseId: string;
}

/**
 * Create Zoho draft tool result
 */
export interface CreateZohoDraftResult {
  success: boolean;
  salesorderId?: string;
  salesorderNumber?: string;
  error?: string;
}

/**
 * Lookup candidates tool arguments
 */
export interface LookupCandidatesArgs {
  caseId: string;
  kind: 'customer' | 'item';
  query: string;
  lineIndex?: number; // For item lookups
}

/**
 * Lookup candidates tool result
 */
export interface LookupCandidatesResult {
  kind: 'customer' | 'item';
  candidates: CandidateMatch[];
  totalFound: number;
}

/**
 * Candidate match from lookup
 */
export interface CandidateMatch {
  id: string;
  name: string;
  score: number;
  sku?: string;
  gtin?: string;
  matchReason: string;
}

/**
 * Committee map fields tool arguments
 */
export interface CommitteeMapFieldsArgs {
  caseId: string;
}

/**
 * Committee map fields tool result
 */
export interface CommitteeMapFieldsResult {
  success: boolean;
  consensus: 'unanimous' | 'majority' | 'split' | 'no_consensus';
  mappings: FieldMapping[];
  disagreements?: FieldDisagreement[];
}

/**
 * Field mapping from committee
 */
export interface FieldMapping {
  sourceHeader: string;
  canonicalField: string;
  confidence: number;
  votes: number;
}

/**
 * Field disagreement from committee
 */
export interface FieldDisagreement {
  sourceHeader: string;
  votes: Record<string, string>;
  needsUserDecision: boolean;
}

/**
 * Agent message in conversation
 */
export interface AgentMessage {
  /** Message ID */
  id: string;
  /** Role (user, assistant, system, tool) */
  role: AgentMessageRole;
  /** Message content */
  content: string;
  /** Tool calls if assistant message */
  toolCalls?: ToolCall[];
  /** Tool call ID if tool result message */
  toolCallId?: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Agent message role
 */
export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * User question generated by the agent
 */
export interface UserQuestion {
  /** Question ID */
  id: string;
  /** Question text */
  text: string;
  /** Type of question */
  type: QuestionType;
  /** Related issue code */
  issueCode?: string;
  /** Options for selection questions */
  options?: QuestionOption[];
  /** Field path this question relates to */
  fieldPath?: string;
  /** Line index for line item questions */
  lineIndex?: number;
  /** Whether this question is required */
  required: boolean;
}

/**
 * Question type
 */
export type QuestionType =
  | 'text'
  | 'number'
  | 'selection'
  | 'multi_selection'
  | 'confirmation'
  | 'customer_selection'
  | 'item_selection';

/**
 * Question option for selection questions
 */
export interface QuestionOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Additional info */
  description?: string;
  /** Match score if applicable */
  score?: number;
}

/**
 * User answer to a question
 */
export interface UserAnswer {
  /** Question ID */
  questionId: string;
  /** Answer value */
  value: unknown;
  /** Timestamp */
  timestamp: string;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  /** Turn number */
  turnNumber: number;
  /** User message */
  userMessage?: string;
  /** Assistant message */
  assistantMessage?: string;
  /** Tool calls made */
  toolCalls?: ToolCall[];
  /** Tool results received */
  toolResults?: ToolResult[];
  /** Questions generated */
  questions?: UserQuestion[];
  /** Timestamp */
  timestamp: string;
}

/**
 * Agent span for tracing
 */
export interface AgentSpan {
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Trace ID */
  traceId: string;
  /** Operation name */
  operationName: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Status */
  status: 'running' | 'success' | 'error';
  /** Attributes */
  attributes: Record<string, unknown>;
  /** Events within the span */
  events: SpanEvent[];
}

/**
 * Span event
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Timestamp */
  timestamp: string;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Agent event for logging/audit
 */
export interface AgentEvent {
  /** Event ID */
  id: string;
  /** Case ID */
  caseId: string;
  /** Event type */
  eventType: AgentEventType;
  /** Timestamp */
  timestamp: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Correlation ID */
  correlationId: string;
  /** Span ID */
  spanId?: string;
}

/**
 * Agent event types
 */
export type AgentEventType =
  | 'thread_created'
  | 'message_sent'
  | 'message_received'
  | 'tool_called'
  | 'tool_completed'
  | 'question_generated'
  | 'answer_received'
  | 'patch_applied'
  | 'validation_completed'
  | 'draft_created'
  | 'thread_completed'
  | 'thread_failed'
  | 'error_occurred';
