/**
 * Azure AI Foundry Agent Service
 *
 * Integration for conversation-based order validation using Azure AI Foundry Agent Service.
 *
 * Key features:
 * - Validator assistant (not extractor) for order data correction
 * - Tool calling for case operations, lookups, and draft creation
 * - Conversation handling with user question generation
 * - Distributed tracing with correlation ID propagation
 * - State management in Cosmos DB
 *
 * System prompt principles:
 * - Never invent values, only select from candidates
 * - Evidence-based corrections with JSON Patch
 * - Human-in-the-loop for all decisions
 */

// Client
export {
  FoundryAgentClient,
  createAgentClient,
} from './client/foundry-agent-client.js';

// Tools
export {
  getToolDefinitions,
  getToolDefinition,
  validateToolArgs,
} from './tools/tool-definitions.js';

export {
  ToolExecutor,
  type ToolDependencies,
  type CaseServiceInterface,
  type ZohoServiceInterface,
  type CustomerMatcherInterface,
  type ItemMatcherInterface,
  type CommitteeEngineInterface,
} from './tools/tool-executor.js';

// Conversation
export {
  ConversationHandler,
  type ConversationHandlerConfig,
  type ConversationResult,
} from './conversation/conversation-handler.js';

// Tracing
export {
  AgentTracer,
  createAgentTracer,
  type ActiveSpan,
  type AgentTracerConfig,
} from './tracing/agent-tracer.js';

// State
export {
  AgentStateManager,
  createAgentStateManager,
  type AgentStateManagerConfig,
} from './state/agent-state-manager.js';

// Types
export * from './types.js';
