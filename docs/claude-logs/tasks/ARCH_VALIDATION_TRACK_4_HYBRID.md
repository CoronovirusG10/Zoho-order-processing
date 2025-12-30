# Hybrid Architecture Analysis: Temporal + Azure AI Foundry Agents

**Track**: Architecture Validation - Track 4
**Date**: 2025-12-30
**Author**: Claude Code (Research Analysis)
**Status**: Complete

---

## Executive Summary

This analysis evaluates whether replacing the current Zen MCP multi-model committee calls with Azure AI Foundry Agents would provide benefits for the Pippa order processing system. After comprehensive research, the recommendation is **not to adopt the hybrid architecture at this time**, but to revisit when specific conditions change.

The current Temporal + direct model API calls (via Zen MCP) architecture is well-suited for the bounded committee task. Azure AI Agents would add complexity without proportional benefit for our specific use case.

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Hybrid Architecture Diagram](#2-hybrid-architecture-diagram)
3. [Implementation Code Pattern](#3-implementation-code-pattern)
4. [Detailed Analysis by Question](#4-detailed-analysis-by-question)
5. [Pros/Cons Matrix](#5-proscons-matrix)
6. [Recommendation](#6-recommendation)
7. [Migration Steps (If Needed)](#7-migration-steps-if-needed)
8. [What Would Change Our Recommendation](#8-what-would-change-our-recommendation)
9. [Research Sources](#9-research-sources)

---

## 1. Current Architecture Overview

### Workflow Structure

```
orderProcessingWorkflow (Temporal)
    |
    +-- Step 1: storeFile (Activity)
    |
    +-- Step 2: parseExcel (Activity)
    |
    +-- Step 3: runCommittee (Activity) <-- AI Committee here
    |       |
    |       +-- CommitteeEngine.runCommittee()
    |       |       |
    |       |       +-- Select 3 random providers from pool of 5
    |       |       +-- Execute parallel calls to:
    |       |       |       - azure-gpt-5.1
    |       |       |       - azure-claude-opus-4.5
    |       |       |       - azure-deepseek-v3.2
    |       |       |       - gemini-2.5-pro
    |       |       |       - xai-grok-4-reasoning
    |       |       +-- Aggregate votes (weighted voting)
    |       |       +-- Check consensus (2/3 majority threshold)
    |       |       +-- Store audit trail to blob
    |       |
    |       +-- If needsHuman: await CorrectionsSubmitted signal
    |
    +-- Step 4: resolveCustomer (Activity)
    +-- Step 5: resolveItems (Activity)
    +-- Step 6: await approval signal
    +-- Step 7: createZohoDraft (Activity)
    +-- Step 8: finalizeAudit (Activity)
    +-- Step 9: notifyUser (Activity)
```

### Key Characteristics of Current Committee

| Aspect | Current Implementation |
|--------|----------------------|
| **Model Selection** | 3 random from pool of 5 |
| **Consensus Threshold** | 66% (2/3 majority) |
| **Confidence Threshold** | 75% |
| **Timeout per Provider** | 30 seconds |
| **Minimum Successful** | 2 out of 3 |
| **Diversity Enforcement** | Yes (no same-family models) |
| **Audit Trail** | Blob storage (evidence pack + raw outputs) |
| **Human Loop** | Temporal signals for corrections |

---

## 2. Hybrid Architecture Diagram

If we adopted Azure AI Agents, the architecture would look like:

```
                    +------------------------------------------+
                    |           Temporal Workflow              |
                    |      (Order Processing Orchestrator)     |
                    +------------------------------------------+
                                       |
           +---------------------------+---------------------------+
           |                           |                           |
    +------v------+           +--------v-------+           +-------v------+
    |  storeFile  |           |   parseExcel   |           |  notifyUser  |
    |  (Activity) |           |   (Activity)   |           |  (Activity)  |
    +-------------+           +----------------+           +--------------+
                                       |
                    +------------------v-------------------+
                    |    runCommittee (Activity)           |
                    |                                      |
                    |  +--------------------------------+  |
                    |  | Azure AI Foundry Agent Service |  |
                    |  |                                |  |
                    |  |  +---------------------------+ |  |
                    |  |  | Committee Orchestrator    | |  |
                    |  |  | Agent                     | |  |
                    |  |  |                           | |  |
                    |  |  | Tools:                    | |  |
                    |  |  | - call_gpt5_model         | |  |
                    |  |  | - call_claude_model       | |  |
                    |  |  | - call_deepseek_model     | |  |
                    |  |  | - aggregate_votes         | |  |
                    |  |  | - store_audit_trail       | |  |
                    |  |  +---------------------------+ |  |
                    |  |                                |  |
                    |  | Thread: {caseId}-committee     |  |
                    |  +--------------------------------+  |
                    +--------------------------------------+
                                       |
                                       v
                    +--------------------------------------+
                    |    Zoho Integration (MCP optional)   |
                    |                                      |
                    |  Option A: Direct Zoho API calls     |
                    |  Option B: Zoho MCP Server           |
                    +--------------------------------------+
```

### Alternative: Multi-Agent Architecture

```
+------------------------+     +------------------------+     +------------------------+
|   GPT-5 Analyst Agent  |     | Claude Analyst Agent   |     | DeepSeek Analyst Agent |
|                        |     |                        |     |                        |
| Instructions:          |     | Instructions:          |     | Instructions:          |
| "Analyze Excel columns |     | "Analyze Excel columns |     | "Analyze Excel columns |
|  and map to canonical  |     |  and map to canonical  |     |  and map to canonical  |
|  fields with confidence|     |  fields with confidence|     |  fields with confidence|
|  scores"               |     |  scores"               |     |  scores"               |
+------------------------+     +------------------------+     +------------------------+
            |                            |                            |
            +----------------------------+----------------------------+
                                         |
                              +----------v-----------+
                              | Consensus Judge Agent |
                              |                       |
                              | Instructions:         |
                              | "Given 3 analyst      |
                              |  opinions, determine  |
                              |  consensus or flag    |
                              |  for human review"    |
                              +-----------------------+
```

---

## 3. Implementation Code Pattern

### Current Implementation (Direct Model Calls)

```typescript
// app/services/workflow/src/activities/run-committee.ts
export async function runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  const engine = getCommitteeEngine();

  // Direct parallel calls to model APIs
  const result: CommitteeResult = await engine.runCommittee(task);

  return {
    success: true,
    needsHuman: result.requiresHumanReview,
    consensus: result.aggregatedResult.consensus,
    mappings,
    finalMappings: result.finalMappings,
  };
}
```

### Hybrid Implementation Pattern (Azure AI Agent)

```typescript
// HYPOTHETICAL: app/services/workflow/src/activities/run-committee-agent.ts
import { AIProjectsClient, AgentsClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export async function runCommitteeAgent(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  const { caseId, evidencePack } = input;

  // Initialize Azure AI Foundry client
  const endpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT;
  const client = new AIProjectsClient(endpoint, new DefaultAzureCredential());
  const agentsClient = client.agents;

  // Option 1: Use pre-created agent
  const agentId = process.env.COMMITTEE_AGENT_ID;

  // Option 2: Create agent on-the-fly (not recommended for production)
  // const agent = await agentsClient.createAgent("gpt-5.1", {
  //   name: `committee-${caseId}`,
  //   instructions: COMMITTEE_ORCHESTRATOR_INSTRUCTIONS,
  //   tools: [
  //     { type: "function", function: callModelFunctionDef },
  //     { type: "function", function: aggregateVotesFunctionDef },
  //   ],
  // });

  // Create a thread for this committee session
  const thread = await agentsClient.createThread();

  // Add the evidence pack as a message
  await agentsClient.createMessage(thread.id, {
    role: "user",
    content: JSON.stringify({
      task: "schema-mapping",
      evidencePack,
      expectedFields: DEFAULT_EXPECTED_FIELDS,
    }),
  });

  // Run the agent (this handles tool calling internally)
  const run = await agentsClient.createRun(thread.id, {
    assistant_id: agentId,
  });

  // Poll for completion (or use streaming)
  let runStatus = run;
  while (runStatus.status === "queued" || runStatus.status === "in_progress") {
    await sleep(1000);
    runStatus = await agentsClient.getRun(thread.id, run.id);

    // Handle tool calls if agent requests them
    if (runStatus.status === "requires_action") {
      const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
      const toolOutputs = await handleToolCalls(toolCalls);
      await agentsClient.submitToolOutputs(thread.id, run.id, toolOutputs);
    }
  }

  // Get final response
  const messages = await agentsClient.listMessages(thread.id);
  const assistantMessage = messages.data.find(m => m.role === "assistant");

  // Parse structured output
  const result = parseAgentResponse(assistantMessage?.content);

  // Clean up thread (optional - could keep for audit)
  await agentsClient.deleteThread(thread.id);

  return {
    success: result.success,
    needsHuman: result.requiresHumanReview,
    consensus: result.consensus,
    mappings: result.mappings,
    finalMappings: result.finalMappings,
  };
}

async function handleToolCalls(toolCalls: ToolCall[]): Promise<ToolOutput[]> {
  const outputs: ToolOutput[] = [];

  for (const call of toolCalls) {
    switch (call.function.name) {
      case "call_gpt5_model":
        const gptResult = await callGPT5(JSON.parse(call.function.arguments));
        outputs.push({ tool_call_id: call.id, output: JSON.stringify(gptResult) });
        break;
      case "call_claude_model":
        const claudeResult = await callClaude(JSON.parse(call.function.arguments));
        outputs.push({ tool_call_id: call.id, output: JSON.stringify(claudeResult) });
        break;
      // ... other models
    }
  }

  return outputs;
}
```

### Error Handling Pattern

```typescript
async function runCommitteeAgentWithRetry(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await runCommitteeAgent(input);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      if (isNonRetryableError(error)) {
        throw error;
      }

      // Log and continue
      log.warn(`Committee agent attempt ${attempt} failed`, {
        caseId: input.caseId,
        error: lastError.message,
        attempt,
      });

      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }

  // Fallback to needs human if all retries exhausted
  return {
    success: false,
    needsHuman: true,
    consensus: 'no_consensus',
    mappings: [],
    finalMappings: {},
    disagreements: [{
      field: 'all',
      votes: {},
      reason: `Committee agent failed after ${maxRetries} attempts: ${lastError?.message}`,
    }],
  };
}
```

---

## 4. Detailed Analysis by Question

### 4.1 How would we invoke an Azure AI Agent from a Temporal activity?

**Answer**: The invocation follows the standard Temporal activity pattern:

1. **Activity wraps Agent call**: The Temporal activity creates an `AIProjectsClient`, submits a message to a thread, creates a run, and polls for completion.

2. **Thread lifecycle**: Options include:
   - **Throwaway threads**: Create/delete per invocation (our use case)
   - **Persistent threads**: Reuse threads for multi-turn conversations

3. **Timeout handling**: Set `startToCloseTimeout` on the activity proxy to account for agent thinking time (recommend 5-10 minutes for complex reasoning).

**Code Reference**: See Section 3 above.

### 4.2 Would the Agent replace our current Zen MCP multi-model calls?

**Answer**: It could, but with tradeoffs.

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Single Orchestrator Agent** | One agent that calls multiple models as tools | Unified interface, Agent handles retry logic | Less transparent, harder to debug |
| **Multi-Agent Committee** | Multiple agents (one per model family) feeding into a judge agent | Cleaner separation, model-native reasoning | More complex, more API calls |
| **Hybrid** | Agent for orchestration, direct API for model calls | Best of both worlds | Increased complexity |

**Recommendation**: For our bounded committee task, direct API calls remain simpler.

### 4.3 What does Azure AI Agent bring that direct model calls don't?

**Key Agent Capabilities**:

| Capability | Direct API | Azure AI Agent | Relevant to Us? |
|------------|-----------|----------------|-----------------|
| **Conversation Memory** | Manual | Built-in threads | No (single-turn) |
| **Tool Calling** | Manual orchestration | Native + retry | Partially (we could use for Zoho) |
| **Multi-step Reasoning** | Manual prompting | Agent decides flow | No (bounded task) |
| **Code Interpreter** | Not available | Built-in | No |
| **File Search/RAG** | Manual setup | Built-in | Possibly (for catalog lookup) |
| **Structured Output** | JSON mode | JSON mode | Same |
| **Human-in-the-Loop** | Temporal signals | No native support | Temporal is better |
| **Observability** | Custom logging | OpenTelemetry built-in | Nice to have |

**Conclusion**: Most Agent benefits don't apply to our bounded committee task.

### 4.4 Would tool-use capabilities of Agents add value to our committee?

**Analysis**:

Our committee does ONE thing: map Excel columns to canonical fields. It doesn't need:
- To query external systems during reasoning
- To execute code
- To search files
- To take actions

**However**, if we expanded the committee's scope to include:
- Querying Zoho catalog during mapping
- Looking up historical order patterns
- Validating customer data in real-time

Then Agents with tools would add value.

**Current Assessment**: No benefit for current scope.

### 4.5 How would we handle Agent "thinking time" in Temporal?

**Pattern**: Increase activity timeout and use heartbeating.

```typescript
const { runCommitteeAgent } = proxyActivities<Activities>({
  startToCloseTimeout: '10m', // Allow 10 minutes for agent reasoning
  heartbeatTimeout: '1m',     // Heartbeat every minute
  retry: {
    maximumAttempts: 3,
    initialInterval: '30s',
    backoffCoefficient: 2,
  },
});
```

**Streaming Alternative**: Use agent streaming to report progress:

```typescript
const stream = await agentsClient.createRunStream(thread.id, { assistant_id: agentId });

for await (const event of stream) {
  // Heartbeat on each event
  Context.current().heartbeat();

  if (event.type === 'thread.run.completed') {
    return parseResult(event.data);
  }
}
```

### 4.6 Determinism and Replay Safety

**Critical Issue**: LLMs are non-deterministic. How does Temporal handle this?

**Answer**: Temporal activities are recorded once. On replay, the recorded result is used.

```
First Execution:
  Workflow starts → Activity runs → LLM returns result → Result recorded

Replay (after crash):
  Workflow starts → Activity "replayed" → Recorded result returned → No LLM call
```

**Key Insight**: Both direct API calls and Agent calls are equally non-deterministic. Temporal handles both the same way.

### 4.7 Idempotency: If Agent is called twice, do we get same result?

**Answer**: No, and that's okay.

| Scenario | Behavior | Mitigation |
|----------|----------|------------|
| **Temporal retry** | New LLM call, possibly different result | Temporal records first successful result |
| **Business retry** | User retries case | Different workflow run, different result is fine |
| **Agent thread reuse** | Same thread, context preserved | Could lead to more consistent results |

**Best Practice**: Use throwaway threads per committee session. Accept that each run may differ, but Temporal ensures exactly-once semantics for the workflow.

### 4.8 Cost Comparison

| Component | Current (Zen MCP) | Hybrid (Agent) |
|-----------|-------------------|----------------|
| **Per-model API calls** | ~$0.02-0.05 per call | Same |
| **Agent Service** | N/A | Additional Azure cost |
| **Thread storage** | N/A | Per-thread storage cost |
| **Compute** | Worker node only | Worker + Agent service |

**Estimated Additional Cost**: 10-20% increase with minimal benefit.

---

## 5. Pros/Cons Matrix

### Current Architecture (Temporal + Direct Model Calls via Zen MCP)

| Pros | Cons |
|------|------|
| Simple, direct control over model calls | Manual orchestration of parallel calls |
| Full transparency of voting logic | No built-in conversation memory |
| Lower latency (no agent overhead) | Custom audit trail implementation |
| Predictable costs | No tool-calling abstraction |
| Easy to test and debug | Must manage provider configs |
| Temporal handles all durability | |

### Hybrid Architecture (Temporal + Azure AI Agents)

| Pros | Cons |
|------|------|
| Built-in conversation threads | Additional Azure service dependency |
| Native tool-calling framework | Increased latency (agent reasoning) |
| OpenTelemetry observability | Higher costs |
| Potential for richer reasoning | Harder to debug (opaque agent decisions) |
| Future-proof for multi-turn scenarios | Must poll for completion |
| Managed infrastructure | Thread management overhead |
| Could integrate Zoho MCP natively | Less control over voting logic |

### Decision Matrix

| Criterion | Weight | Current | Hybrid |
|-----------|--------|---------|--------|
| **Simplicity** | 25% | 9/10 | 5/10 |
| **Debugability** | 20% | 9/10 | 4/10 |
| **Latency** | 15% | 8/10 | 5/10 |
| **Cost** | 15% | 8/10 | 6/10 |
| **Future Extensibility** | 10% | 6/10 | 9/10 |
| **Observability** | 10% | 7/10 | 8/10 |
| **Operational Overhead** | 5% | 8/10 | 4/10 |
| **Weighted Score** | 100% | **7.9/10** | **5.6/10** |

---

## 6. Recommendation

### Primary Recommendation: **Do NOT adopt hybrid architecture now**

**Rationale**:

1. **Task is bounded**: Our committee performs a single, well-defined task (schema mapping). It doesn't benefit from multi-turn conversations or dynamic tool selection.

2. **Complexity cost exceeds benefit**: Adding Azure AI Agents introduces:
   - New Azure service to manage
   - Polling/streaming complexity
   - Thread lifecycle management
   - Additional latency

3. **Current architecture is working**: The Temporal + Zen MCP pattern already provides:
   - Parallel model execution
   - Weighted voting consensus
   - Human-in-the-loop via signals
   - Full audit trail
   - Retry and durability

4. **Testing complexity**: Mocking Agent behavior is harder than mocking direct API calls.

### Secondary Recommendation: **Consider Zoho MCP for catalog integration**

The research revealed that [Zoho MCP](https://www.zoho.com/mcp/) provides a Model Context Protocol server for AI agents to interact with Zoho apps. This could be valuable for:

- Real-time catalog validation during item resolution
- Customer lookup during resolution
- Order status queries

This is a **separate enhancement** that doesn't require switching the committee to Azure Agents.

---

## 7. Migration Steps (If Needed)

If the decision is made to adopt hybrid architecture despite the recommendation, here are the migration steps:

### Phase 1: Azure AI Foundry Setup (1-2 weeks)

```bash
# 1. Create Azure AI Foundry project
az ai foundry project create \
  --name "pippa-order-processing" \
  --resource-group "pippa-rg"

# 2. Deploy models to project
az ai foundry model deploy \
  --project "pippa-order-processing" \
  --model "gpt-5.1" \
  --deployment-name "gpt5-committee"

# 3. Create committee orchestrator agent
az ai foundry agent create \
  --project "pippa-order-processing" \
  --name "committee-orchestrator" \
  --model "gpt-5.1" \
  --instructions-file "./agents/committee-orchestrator.md" \
  --tools-file "./agents/committee-tools.json"
```

### Phase 2: Activity Implementation (1 week)

1. Install SDK: `npm install @azure/ai-projects @azure/identity`
2. Create `run-committee-agent.ts` activity (see Section 3)
3. Add feature flag for gradual rollout
4. Update activity proxy with longer timeout

### Phase 3: Testing (2 weeks)

1. Unit tests for agent invocation
2. Integration tests with real agents
3. Load testing for latency impact
4. Chaos testing for agent failures

### Phase 4: Gradual Rollout (2 weeks)

1. Enable for 5% of cases
2. Monitor latency, success rate, cost
3. Compare consensus quality with baseline
4. Expand to 100% if metrics acceptable

### Total Estimated Effort: 6-8 weeks

---

## 8. What Would Change Our Recommendation

We would recommend adopting Azure AI Agents if:

### Trigger 1: Multi-turn Committee Reasoning

If the committee needs to:
- Ask clarifying questions about the data
- Iterate on mappings with feedback
- Have internal discussion between models

**Current**: Single-turn, no iteration
**Trigger**: Product requirement for iterative refinement

### Trigger 2: Dynamic Tool Integration

If the committee needs to:
- Query Zoho catalog during mapping
- Look up historical patterns
- Validate against external rules

**Current**: All data passed upfront in evidence pack
**Trigger**: Need for real-time external lookups

### Trigger 3: Complex Multi-Agent Workflows

If we need:
- Specialist agents for different domains (clothing, accessories, etc.)
- Manager agents to coordinate specialists
- Dynamic agent selection based on order type

**Current**: Same 3-model committee for all orders
**Trigger**: Need for domain specialization

### Trigger 4: Azure Full Stack Mandate

If organizational decision is made to:
- Consolidate on Azure AI Foundry
- Deprecate Zen MCP
- Standardize on Microsoft Agent Framework

**Current**: Using Zen MCP for model orchestration
**Trigger**: Platform standardization initiative

### Trigger 5: Observability Requirements

If we need:
- Built-in OpenTelemetry tracing for all LLM calls
- Azure-native monitoring and alerting
- Compliance with Azure observability standards

**Current**: Custom logging to blob storage
**Trigger**: Enterprise observability mandate

---

## 9. Research Sources

### Azure AI Foundry & Agents

- [Introducing Microsoft Agent Framework](https://azure.microsoft.com/en-us/blog/introducing-microsoft-agent-framework/) - Open-source SDK and runtime for multi-agent systems
- [Azure AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Sequential, parallel, and group chat patterns
- [Azure AI Foundry SDK Overview](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/sdk-overview?view=foundry-classic) - TypeScript/Node.js SDK usage
- [Azure AI Agents Function Calling](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/function-calling) - Custom tool integration patterns
- [Creating MCP Server with Azure AI Agent Service](https://devblogs.microsoft.com/foundry/integrating-azure-ai-agents-mcp-typescript/) - TypeScript MCP integration

### Temporal + AI Integration

- [Building Dynamic AI Agents with Temporal](https://temporal.io/blog/of-course-you-can-build-dynamic-ai-agents-with-temporal) - Workflow/Activity separation for LLM calls
- [OpenAI Agents SDK + Temporal Integration](https://temporal.io/blog/announcing-openai-agents-sdk-integration) - Public preview of durable agent execution
- [Durable AI Agents with Pydantic](https://temporal.io/blog/build-durable-ai-agents-pydantic-ai-and-temporal) - Non-deterministic activity handling
- [Temporal AI Cookbook](https://docs.temporal.io/ai-cookbook/openai-agents-sdk-python) - Agent-with-tools pattern

### Determinism & Reliability

- [Building Durable and Deterministic Multi-Agent Orchestrations](https://techcommunity.microsoft.com/blog/appsonazureblog/building-durable-and-deterministic-multi-agent-orchestrations-with-durable-execu/4408842) - Azure Durable Functions patterns
- [Reliability for Unreliable LLMs](https://stackoverflow.blog/2025/06/30/reliability-for-unreliable-llms/) - Idempotency and retry patterns
- [10 Best Practices for Building Reliable AI Agents](https://www.uipath.com/blog/ai/agent-builder-best-practices) - Avoiding retry for non-deterministic outputs

### Zoho Integration

- [Zoho MCP](https://www.zoho.com/mcp/) - Model Context Protocol for Zoho apps
- Model-agnostic interface supporting CRM, Mail, Calendar, Desk, and 300+ third-party apps

---

## Appendix A: Alternative Hybrid Patterns Comparison

| Pattern | Orchestration | AI Reasoning | Best For |
|---------|---------------|--------------|----------|
| **Temporal + Zen MCP** | Temporal | Direct API calls | Bounded tasks, full control (current) |
| **Temporal + Azure Agents** | Temporal | Azure Agent Service | Complex reasoning, tool use |
| **Durable Functions + Agents** | Azure | Azure Agent Service | Full Azure stack, serverless |
| **Agent Framework + Temporal** | Agent decides | Agent + tools | Autonomous agents needing durability |

---

## Appendix B: Committee Engine vs Agent Comparison

### Current Committee Engine Flow

```
1. Select 3 random providers (diversity-aware)
2. Build prompt with evidence pack
3. Execute parallel API calls (Promise.all)
4. Parse structured responses
5. Aggregate votes (weighted)
6. Check consensus (66% threshold)
7. Store audit trail
8. Return result + needsHuman flag
```

### Equivalent Agent Flow

```
1. Create thread
2. Add evidence pack as message
3. Create run with orchestrator agent
4. Agent internally:
   a. Decides to call GPT tool
   b. Decides to call Claude tool
   c. Decides to call DeepSeek tool
   d. Receives all results
   e. Synthesizes consensus
5. Poll for run completion
6. Parse agent response
7. Delete thread
8. Return result + needsHuman flag
```

**Key Difference**: With agents, step 4 is a black box. With direct calls, we control every step.

---

## Appendix C: Cost Estimate

### Current Monthly Cost (estimated, 100 orders/day)

| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| GPT-5.1 calls | 100 orders * 30 days * 0.33 prob * $0.03 | ~$30 |
| Claude calls | 100 orders * 30 days * 0.33 prob * $0.04 | ~$40 |
| DeepSeek calls | 100 orders * 30 days * 0.33 prob * $0.01 | ~$10 |
| **Total** | | **~$80/month** |

### Hybrid Monthly Cost (estimated)

| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| Same model calls | (unchanged) | ~$80 |
| Agent Service | 3000 runs * $0.005 | ~$15 |
| Thread storage | Minimal | ~$5 |
| **Total** | | **~$100/month** |

**Increase**: ~25% for minimal benefit in our use case.

---

**Document End**

*Last Updated: 2025-12-30*
*Version: 1.0*
