# Subagent D: Azure AI Foundry Readiness Audit

**Generated**: 2025-12-26
**Status**: NEEDS_ACTION

---

## Executive Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| Overall Status | **NEEDS_ACTION** | AI Search missing; minor config gaps |
| Model Deployments | PASS | All required models deployed |
| Agent Architecture | PASS | Prompt-based agents with tools (not Hosted Agents) |
| Capability Host | **PARTIAL** | Cosmos DB & Storage OK; AI Search NOT configured |
| Workflows | **PARTIAL** | Durable Functions workflow exists; no Foundry Workflows |
| Hosted Agents Risk | N/A | Not using Hosted Agents (preview) |

---

## 1. Model Deployments (PASS)

### Required Models
| Model | Required For | Status | Evidence |
|-------|--------------|--------|----------|
| gpt-5.1 | Orchestrator/AgentAI | **DEPLOYED** | Capacity 5,177 in Sweden Central |
| o3 | Committee voting | **DEPLOYED** | Capacity 1,000 (quota increase recommended) |
| claude-opus-4-5 | Committee voting | **DEPLOYED** | Capacity 1,912 (quota increase recommended) |
| mistral-document-ai | OCR processing | **DEPLOYED** | mistral-document-ai-2505 |
| Cohere-embed-v3-multilingual | Embeddings | **DEPLOYED** | Available in catalog |

### STT Model
| Model | Required | Status |
|-------|----------|--------|
| gpt-4o-transcribe | OPTIONAL | NOT FOUND |

**Note**: STT not required for current workflow (Excel file upload, not voice input).

### Committee Model Pool (5+ models)
1. azure-gpt-5.1 (Azure OpenAI)
2. azure-claude-opus-4.5 (Azure Anthropic)
3. azure-deepseek-v3.2 (Azure DeepSeek)
4. gemini-2.5-pro (Google Direct API)
5. xai-grok-4-reasoning (xAI)

**Verdict**: Model deployments are sufficient for production.

---

## 2. Agent Architecture (PASS)

### Implementation Type
- **Architecture**: Prompt-based agents with tool calling
- **NOT using**: Hosted Agents (preview service)

### Evidence
- File: `/data/order-processing/app/services/agent/src/client/foundry-agent-client.ts`
- Uses Azure AI Foundry Assistants API (OpenAI-compatible)
- Custom FoundryAgentClient class with:
  - Assistant initialization
  - Thread management
  - Tool calling (submit_tool_outputs pattern)
  - Managed credential (DefaultAzureCredential)

### System Prompt Principles
1. Validator assistant, not extractor
2. Never invents values
3. Evidence-based corrections with JSON Patch
4. Strict output format

### Hosted Agents Risk Assessment
| Risk | Status |
|------|--------|
| Using Hosted Agents (preview) | NO |
| Production suitability | OK (using prompt-based approach) |

---

## 3. Capability Host Configuration (PARTIAL)

### BYO Storage Requirements
| Resource | Required | Status | Location |
|----------|----------|--------|----------|
| Cosmos DB | YES (thread storage) | **CONFIGURED** | Sweden Central |
| AI Search | YES (vector store) | **NOT CONFIGURED** | N/A |
| Storage Account | YES (files) | **CONFIGURED** | Sweden Central |

### Cosmos DB Details
- **Database**: order-processing
- **Agent Thread Container**: `agentThreads` (partition: threadId, TTL: 30 days)
- **Additional Containers**: cases, fingerprints, events, committeeVotes, cache

### Storage Account Details
- **Account**: orderstor${uniqueSuffix}
- **Retention**: 5 years (1825 days)
- **Immutable Storage**: Enabled for orders-audit container

### AI Search Gap
**MISSING**: Azure Cognitive Search resource not defined in infrastructure.

Required for:
- Vector embeddings storage
- Semantic search over order history
- Capability host vector store integration

**Recommendation**: Add Azure Cognitive Search module to `/data/order-processing/app/infra/modules/`

---

## 4. Workflows Assessment (PARTIAL)

### Current Implementation
- **Using**: Azure Durable Functions (TypeScript)
- **Orchestration**: `/data/order-processing/app/services/workflow/src/orchestrations/order-processing.ts`

### Workflow Steps
1. StoreFile - Store uploaded Excel
2. ParseExcel - Parse spreadsheet
3. RunCommittee - Multi-model validation
4. ResolveCustomer - Match to Zoho
5. ResolveItems - Match line items
6. (Human approval via waitForExternalEvent)
7. CreateZohoDraft - Create sales order
8. NotifyUser - Completion notification

### Human-in-the-Loop
- **Implemented**: YES
- **Mechanisms**:
  - `waitForExternalEvent('FileReuploaded')`
  - `waitForExternalEvent('CorrectionsSubmitted')`
  - `waitForExternalEvent('SelectionsSubmitted')`
  - `waitForExternalEvent('ApprovalReceived')`

### Azure AI Foundry Workflows
- **Using Native Foundry Workflows**: NO
- **Using Durable Functions**: YES

**Note**: The solution uses Azure Durable Functions for orchestration rather than Azure AI Foundry Workflows. This is a valid architectural choice but means:
- No access to Foundry Workflow templates (Sequential, Group chat, Human-in-loop)
- Custom implementation of human-in-loop patterns
- Self-managed thread/state correlation

---

## 5. Foundry Configuration Analysis

### Infrastructure Files
| File | Purpose | Status |
|------|---------|--------|
| `/data/order-processing/app/infra/modules/aifoundry.bicep` | Hub + Project deployment | CONFIGURED |
| `/data/order-processing/app/infra/main.bicep` | Main infrastructure | CONFIGURED |

### AI Foundry Resources
- **Hub**: order-processing-${environment}-hub
- **Project**: order-processing-${environment}-project
- **AI Services**: order-processing-${environment}-aiservices
- **Connection**: aiservices-connection (ApiKey auth)

### SDK Integration
- **Client**: FoundryAgentClient (custom implementation)
- **API Version**: 2024-05-01-preview
- **Auth**: DefaultAzureCredential (managed identity)
- **Model Default**: gpt-4o (configurable via AGENT_MODEL_DEPLOYMENT env var)

---

## 6. Strict JSON Schema Output

### Implementation Status
- **Agent System Prompt**: Mentions "strict JSON outputs where applicable"
- **JSON Patch**: Used for corrections (evidence-based changes)
- **Schema Validation**: Yes (canonical-sales-order.schema.json exists)

### Evidence
```typescript
// From foundry-agent-client.ts system prompt:
// "All corrections must use JSON Patch format for precise, auditable changes."
```

---

## 7. Action Items

### MUST FIX (Blocking)
1. **Deploy Azure Cognitive Search**
   - Create `/data/order-processing/app/infra/modules/aisearch.bicep`
   - Configure as capability host vector store
   - Region: Sweden Central (data sovereignty)

### SHOULD FIX (Recommended)
2. **Increase Model Quotas**
   - o3: 1,000 -> 5,000
   - claude-opus-4-5: 1,912 -> 5,000
   - gpt-5.1: 5,177 -> 10,000

3. **Update Agent Model Deployment**
   - Current default: gpt-4o
   - Recommended: gpt-5.1 (already deployed)
   - Set `AGENT_MODEL_DEPLOYMENT=gpt-5.1` in config

### OPTIONAL
4. **Consider Foundry Workflows Migration**
   - Migrate from Durable Functions to Azure AI Foundry Workflows
   - Benefits: Built-in human-in-loop templates, managed thread storage

---

## 8. Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Models Deployed** | PASS | All required models available |
| **Models Missing** | NONE | Core models deployed |
| **Capability Host** | **NEEDS_ACTION** | AI Search not configured |
| **Hosted Agents Risk** | N/A | Not using (low risk) |
| **Workflows** | PASS (with notes) | Durable Functions workflow with human-in-loop |

### Final Verdict: **NEEDS_ACTION**

The Azure AI Foundry configuration is largely complete but requires:
1. **Azure Cognitive Search deployment** for capability host vector store
2. **Model quota increases** for production scale

Once AI Search is deployed and connected as a capability host, the solution will be ready for production deployment.

---

## Evidence Files
- `/data/order-processing/_predeploy/evidence/D_foundry/model_status.txt`
- `/data/order-processing/_predeploy/evidence/D_foundry/capability_host.txt`
