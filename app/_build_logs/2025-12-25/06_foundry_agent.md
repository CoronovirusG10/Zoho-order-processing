# Agent 6: Foundry Agent Integration - Build Summary

**Date:** 2025-12-25
**Agent:** Foundry Agent Integration
**Status:** COMPLETED

## Overview

Implemented Azure AI Foundry Agent Service integration for conversation-based order validation. The agent acts as a **validator assistant** (not extractor) that helps users correct parsed order data before creating draft sales orders in Zoho Books.

## Key Principles

1. **Validator, not Extractor** - Works with already-parsed data from the parser service
2. **Never Invent Values** - Only selects from provided candidates (customers, items)
3. **Evidence-Based** - All corrections use JSON Patch for auditable changes
4. **Human-in-the-Loop** - All decisions require explicit user confirmation

## Files Created

### Directory Structure
```
/data/order-processing/app/services/agent/
  src/
    types.ts                    # Type definitions
    index.ts                    # Main exports
    client/
      foundry-agent-client.ts   # Azure AI Foundry client
    tools/
      tool-definitions.ts       # OpenAPI-style tool definitions
      tool-executor.ts          # Tool execution logic
    conversation/
      conversation-handler.ts   # Conversation flow management
    tracing/
      agent-tracer.ts          # Distributed tracing
    state/
      agent-state-manager.ts   # Cosmos DB state management
  package.json
  tsconfig.json
```

## Component Details

### 1. Agent Client (`foundry-agent-client.ts`)

- Azure AI Foundry Agent client with Azure AD authentication
- System prompt emphasizing validator role
- Thread management (create, send messages, delete)
- Tool call handling with status polling
- Configurable model deployment, tokens, temperature

**System Prompt Key Points:**
- VALIDATOR, not EXTRACTOR
- NEVER invent or guess values
- All corrections via JSON Patch
- Present candidates for user selection

### 2. Tool Definitions (`tool-definitions.ts`)

Five OpenAPI-style tools for agent function calling:

| Tool | Purpose |
|------|---------|
| `get_case` | Retrieve case data (canonical order, issues) |
| `revalidate_case` | Apply JSON Patch corrections and re-validate |
| `create_zoho_draft` | Create draft sales order in Zoho (idempotent) |
| `lookup_candidates` | Search for customers/items in Zoho |
| `committee_map_fields` | Invoke AI committee for field mapping review |

Each tool includes:
- OpenAPI parameter schema
- Comprehensive description with usage guidance
- Required/optional parameter definitions

### 3. Tool Executor (`tool-executor.ts`)

- Executes tool calls from the agent
- Validates arguments against tool definitions
- Interfaces with external services:
  - CaseService for case operations
  - ZohoService for draft creation
  - CustomerMatcher/ItemMatcher for lookups
  - CommitteeEngine for field mapping
- Full tracing integration

### 4. Conversation Handler (`conversation-handler.ts`)

Manages the conversation flow:
- **Start Conversation**: Creates thread, sends context, generates initial questions
- **Process Answers**: Formats responses, handles tool calls, extracts next questions
- **Apply Corrections**: JSON Patch application with re-validation
- **Draft Creation**: Triggers Zoho draft when all issues resolved

Features:
- Issue-to-question conversion
- Auto-proceed option when no blocking issues
- Thread state management
- Turn tracking and limits

### 5. Agent Tracer (`agent-tracer.ts`)

Distributed tracing with:
- Correlation ID propagation from shared context
- Span creation/management for operations
- Event recording for audit
- Application Insights export (stub for integration)
- Traced function wrapper utility

### 6. State Manager (`agent-state-manager.ts`)

Cosmos DB persistence for:
- **Thread State**: Status, pending issues, message count, TTL
- **Case Context**: Cached canonical order, conversation turns

Features:
- Thread lookup by case ID
- Active thread listing per user
- Automatic expiration and cleanup
- Partition by tenant ID

## Configuration

### Environment Variables
```
COSMOS_ENDPOINT          # Cosmos DB endpoint
COSMOS_DATABASE          # Database name (default: order-processing)
AGENT_MODEL_DEPLOYMENT   # Model deployment name (default: gpt-4o)
```

### Agent Configuration
```typescript
{
  endpoint: string,           // Azure AI Foundry endpoint
  deploymentName: 'gpt-4o',   // Model deployment
  apiVersion: '2024-05-01-preview',
  maxTokens: 4096,
  temperature: 0.1,           // Low for consistency
  timeoutMs: 60000
}
```

## Integration Points

### Input
- Parse output from parser service (canonical JSON + issues)
- User answers/selections from Teams bot/tab

### Output
- User-facing questions for issue resolution
- JSON Patch operations for corrections
- Draft sales order creation trigger

### Dependencies
- `@order-processing/shared` - Logging, correlation, errors
- `@order-processing/types` - CanonicalSalesOrder, Issue types
- `@azure/cosmos` - State persistence
- `@azure/identity` - Azure AD authentication

## Type Exports

Key types available from the package:
- `AgentConfig`, `AgentThreadState`, `CaseContext`
- `ToolCall`, `ToolResult`, `ToolName`
- `JsonPatchOperation` (RFC 6902)
- `UserQuestion`, `UserAnswer`, `QuestionType`
- `ConversationTurn`, `ConversationResult`
- `AgentSpan`, `AgentEvent`, `AgentEventType`

## Usage Example

```typescript
import {
  createAgentClient,
  createAgentTracer,
  createAgentStateManager,
  ConversationHandler,
  ToolExecutor,
} from '@order-processing/agent';

// Initialize components
const logger = new Logger({ component: 'agent' });
const tracer = createAgentTracer(logger);
const stateManager = createAgentStateManager(logger);
await stateManager.initialize();

const client = createAgentClient(endpoint, logger, tracer);
await client.initialize();

const executor = new ToolExecutor(deps, stateManager, logger, tracer);
const handler = new ConversationHandler(
  client, executor, stateManager, tracer, logger
);

// Start conversation for a case
const { threadId, questions } = await handler.startConversation(caseContext);

// Process user answers
const { questions: nextQuestions, isComplete } =
  await handler.processUserAnswers(threadId, answers, tenantId);

// Apply a correction
const { remainingIssues, questions } =
  await handler.applyCorrection(threadId, patch, tenantId);
```

## Notes

1. **Thread TTL**: Threads expire after 24 hours of inactivity
2. **Idempotency**: Draft creation is idempotent via fingerprint tracking
3. **Tracing**: All operations create spans for distributed tracing
4. **Security**: No secrets are logged (inherited from shared logger)

## Future Enhancements

- Application Insights telemetry export implementation
- Streaming response support for real-time feedback
- Multi-language question generation
- Adaptive Card template generation for Teams
