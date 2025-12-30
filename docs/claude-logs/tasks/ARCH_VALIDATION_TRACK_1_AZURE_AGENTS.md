# Architecture Validation Track 1: Azure AI Foundry Agents Assessment

**Date**: 2025-12-30
**Analyst**: Claude Code (Opus 4.5)
**System**: Pippa of London Order Processing
**Comparison**: Azure AI Foundry Agents vs Current Temporal.io Implementation

---

## Executive Summary

**Suitability Rating: 3/10**

Azure AI Foundry Agents is **not designed for our use case**. It is an AI/LLM orchestration platform designed for agentic AI applications, not a deterministic business workflow orchestrator like Temporal.io. While Microsoft has added "Workflow Orchestration" features, these are fundamentally different from what we require.

**Verdict**: Temporal.io was the correct choice. Azure AI Foundry Agents would require significant workarounds and would introduce unnecessary AI/LLM complexity into what is fundamentally a deterministic, state-machine-based business process.

---

## Table of Contents

1. [Azure AI Foundry Agents: What It Actually Is](#1-azure-ai-foundry-agents-what-it-actually-is)
2. [Capability Assessment](#2-capability-assessment)
3. [Capability Hosts Deep Dive](#3-capability-hosts-deep-dive)
4. [Critical Limitations for Our Use Case](#4-critical-limitations-for-our-use-case)
5. [Integration Analysis](#5-integration-analysis)
6. [Honest Assessment](#6-honest-assessment)
7. [Gap Analysis](#7-gap-analysis)
8. [Recommendation](#8-recommendation)
9. [Sources](#9-sources)

---

## 1. Azure AI Foundry Agents: What It Actually Is

### Design Purpose

Azure AI Foundry Agent Service is a **platform for building AI-powered agents** that pair Large Language Models (LLMs) with tools to read data, call functions, and execute logic. It is fundamentally an **AI agent orchestration system**, not a workflow orchestration system.

Key characteristics:
- **LLM-Centric**: Every agent is powered by an LLM (GPT-4, Claude, etc.)
- **Agentic AI**: Designed for AI reasoning, decision-making, and tool use
- **Probabilistic**: LLM responses are inherently non-deterministic
- **Conversation-Based**: State is tied to "threads" (conversation histories)

### What It's Designed For

1. **AI Assistants & Chatbots**: Customer service, knowledge retrieval
2. **Document Processing with AI**: Summarization, extraction, analysis
3. **Multi-Agent Collaboration**: Multiple AI agents working together
4. **Tool-Augmented AI**: AI that can call APIs, search databases, execute code

### What It's NOT Designed For

1. **Deterministic Business Workflows**: Fixed-step processes with no AI decision-making
2. **Long-Running Stateful Processes**: Multi-day workflows waiting for human input
3. **High-Volume Transaction Processing**: Order processing, financial transactions
4. **Strict Schema Enforcement**: Exact JSON field mappings without AI interpretation

> "Microsoft Agent Framework supports both Agent Orchestration (LLM-driven, creative reasoning and decision-making) and Workflow Orchestration (business-logic driven, deterministic multi-agent workflows)."
> - [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/workflow?view=foundry)

**Critical Insight**: Even the "Workflow Orchestration" mode is designed for **multi-agent** coordination, not traditional business process automation.

---

## 2. Capability Assessment

### 2.1 Can It Handle 9-Step Deterministic Business Workflows?

**Partially, but not ideally.**

Azure AI Foundry Workflows can define sequential steps, but:
- Each step is expected to involve an **AI agent**
- The system is optimized for **AI-driven decision making**
- Deterministic steps require disabling the LLM reasoning

> "Multi-agent development styles often conflict with real business environments, where users expect to preserve their existing workflows exactly as is and require agents to behave in a declarative and deterministic manner."
> - [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/orchestrating-multi-agent-conversations-with-microsoft-foundry-workflows/4472329)

### 2.2 How Does It Handle Workflows Waiting Days for Human Input?

**Partially supported, with significant caveats.**

Human-in-the-loop is supported:
- Workflows can "pause" and wait for human approval
- Checkpointing preserves state during pauses
- Resume from checkpoint is automatic

**However, there are serious limitations:**

1. **Timeout Constraints**: "While the timeout limit is usually around 30 seconds in Azure AI Foundry..."
2. **Async Pattern Required**: Long-running operations require implementing async callback patterns
3. **No Native Multi-Day Timers**: Unlike Temporal's native `workflow.sleep()` for days/weeks
4. **Thread Expiration**: Unclear retention periods for paused threads

> "If your sub-agent or OpenAPI tool needs to perform a long-running process, Microsoft recommends implementing an asynchronous pattern."
> - [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5523387/azure-ai-agent-service-connected-agent-timeout)

### 2.3 State Persistence Model

**Thread-based, not durable replay.**

| Aspect | Azure AI Foundry | Temporal.io |
|--------|------------------|-------------|
| State Model | Thread (conversation history) | Event-sourced replay |
| Persistence | Cosmos DB (BYO optional) | PostgreSQL/Cassandra/MySQL |
| Recovery | Checkpoint restore | Deterministic replay |
| Durability | Depends on storage config | Guaranteed by design |

Azure AI Foundry uses a **conversation thread** model:
- State is stored as messages in a thread
- Checkpoints serialize execution context
- No deterministic replay capability

> "In Azure AI Foundry, agent sessions are generally stateless, meaning each new thread or conversation does not automatically inherit memory from previous ones."
> - [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5542041/azure-ai-foundry-how-to-persist-memory-across-thre)

---

## 3. Capability Hosts Deep Dive

### What Are Capability Hosts?

Capability hosts are configuration resources that specify **where agent data is stored and processed**:
- Thread storage (conversation history)
- File storage (uploaded documents)
- Vector search indices

### BYO Cosmos DB Support

**Yes, you can bring your own Cosmos DB:**

> "The Bring-Your-Own (BYO) thread storage feature in Azure AI Agent Service lets developers persist and retrieve multi-turn threads directly within their own Azure Cosmos DB resource."
> - [Azure Cosmos DB Blog](https://devblogs.microsoft.com/cosmosdb/azure-ai-foundry-connection-for-azure-cosmos-db-and-byo-thread-storage-in-azure-ai-agent-service/)

Configuration creates three containers in an `enterprise_memory` database:
1. Thread data
2. Message data
3. Run data

### Data Residency / UK Compliance

**Supported with proper configuration:**
- BYO storage keeps data in your Azure subscription
- UK South/UK West regions available
- Full control over encryption keys (BYOK)
- Cosmos DB geo-replication for DR

**However:**
- Default (managed) storage is Microsoft-controlled
- Must explicitly configure capability hosts for data sovereignty

### File Management

Files can be uploaded to agents:
- Stored in Azure Blob Storage (BYO or managed)
- Accessible via file search tools
- Limited to specific file types and sizes

**Our Excel file workflow would work**, but with added complexity of AI file parsing vs. our deterministic ExcelJS parsing.

---

## 4. Critical Limitations for Our Use Case

### 4.1 Structured JSON Output

**CRITICAL GAP: Structured outputs are NOT supported with Assistants/Agents**

> "Structured outputs are not currently supported with Assistants or Azure AI Agents Service."
> - [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs)

This is a **deal-breaker** for our use case. We require:
- Exact field mappings (SKU, quantity, customer info)
- Schema validation for Zoho Books API compatibility
- Deterministic output (same input = same output)

The AI would need to "interpret" the schema, introducing non-determinism.

### 4.2 Retry/Idempotency

**Not built-in; requires manual implementation.**

> "Consider whether the operation is idempotent. If so, it's inherently safe to retry. Otherwise, retries could cause the operation to be executed more than once, with unintended side effects."
> - [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)

Azure AI Foundry relies on:
- Standard Azure retry patterns (Polly, Resilience4j)
- SDK-level retry configuration
- No built-in idempotency guarantees

**Our SHA-256 fingerprinting** would need to be implemented as a custom middleware.

### 4.3 Failure Recovery vs Temporal Replay

| Recovery Aspect | Azure AI Foundry | Temporal.io |
|-----------------|------------------|-------------|
| Mechanism | Checkpoint restore | Event replay |
| Determinism | No guarantee | Guaranteed |
| Partial failures | May lose progress | Never loses progress |
| Code changes | May break checkpoints | Versioned workflows |

Temporal's replay is **fundamentally different**:
- Re-executes workflow code from history
- Guaranteed same result for same history
- Supports workflow versioning during updates

Azure AI Foundry checkpoints:
- Serialize state at specific points
- No replay capability
- Vulnerable to code changes

### 4.4 Signals/Queries

**Not directly supported.**

Temporal provides:
- **Signals**: Asynchronous inputs to running workflows
- **Queries**: Synchronous reads of workflow state

Azure AI Foundry equivalent:
- Human-in-the-loop "approval" pattern
- No query capability for running workflows
- Must poll for status

**Our 4 human-in-the-loop signals** would require custom implementation.

### 4.5 Multi-Day Workflow Pauses

**Theoretically possible, but not a core design feature.**

Concerns:
- Thread/run expiration policies unclear
- No native timer events (like Temporal's `workflow.sleep()`)
- Timeout escalation (24h/48h/7d) would need external scheduling

### 4.6 ETag-Based Optimistic Concurrency

**Not a feature of Azure AI Foundry itself.**

ETag concurrency is available in:
- Azure Cosmos DB (for thread storage)
- Azure AI Search (for indices)
- Azure Blob Storage (for files)

But the **Agent Service** doesn't expose ETag-based concurrency for workflow operations. We would implement this at the storage layer, losing the abstraction benefits.

---

## 5. Integration Analysis

### 5.1 Microsoft Teams Bot Integration

**Supported with one-click publishing.**

> "Developers can now take an AI agent built in Microsoft Foundry and publish it directly to Microsoft 365 Copilot and Microsoft Teams in just a few clicks."
> - [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/publishing-agents-from-microsoft-foundry-to-microsoft-365-copilot--teams/4471184)

**However:**
- Designed for **chat-based** interaction
- Our adaptive card workflow would need reimplementation
- Teams Bot Framework SDK still needed for custom experiences

### 5.2 External API Integration (Zoho Books)

**Supported via OpenAPI specification tools.**

> "You can now connect your Azure AI Agent to an external API using an OpenAPI 3.0 specified tool."
> - [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/openapi?view=foundry)

Authentication types:
- Anonymous
- API key
- Managed identity

**Zoho integration would work**, but:
- Each API call goes through AI reasoning layer
- No built-in retry queue like our implementation
- Rate limiting handling unclear

### 5.3 Audit Trail Requirements (5-Year Compliance)

**Possible but requires custom implementation.**

> "Foundry can capture logs, traces, and evaluations at every step. With full conversation-level visibility and Application Insights integration..."
> - [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview?view=foundry-classic)

For 5-year retention:
- Configure Azure Monitor for long-term storage
- Export to Azure Data Explorer or similar
- BYO Cosmos DB with retention policies

**Our blob-based audit bundles** are more comprehensive and self-contained.

### 5.4 Deployment on Azure VM

**Not the recommended deployment model.**

Azure AI Foundry is a **managed service**:
- Agents run on Microsoft infrastructure
- You don't control the compute
- SDK-based interaction from your apps

For VM deployment, you'd use:
- Azure App Service with Agent Framework SDK
- Azure Functions with Durable Functions
- Container Apps for long-running processes

---

## 6. Honest Assessment

### What Is Azure AI Foundry Agents REALLY For?

1. **AI-Powered Customer Service**: Chatbots with knowledge retrieval
2. **Document Intelligence**: Summarization, extraction, Q&A
3. **Multi-Agent AI Systems**: Complex AI reasoning with specialized agents
4. **Copilot Extensions**: Adding AI capabilities to Microsoft 365
5. **RAG Applications**: Retrieval-Augmented Generation with enterprise data

### Are We Comparing Apples to Oranges?

**Yes, absolutely.**

| Aspect | Azure AI Foundry Agents | Temporal.io |
|--------|-------------------------|-------------|
| Primary Purpose | AI/LLM orchestration | Workflow orchestration |
| Core Abstraction | Agent + Tools | Workflow + Activities |
| State Model | Conversation thread | Event-sourced history |
| Determinism | Probabilistic (LLM) | Guaranteed |
| Human Input | Approval prompts | Signals |
| Long-Running | Supported (async pattern) | Native design |
| Recovery | Checkpoint | Replay |

**Azure AI Foundry Agents** = Build AI that thinks and acts
**Temporal.io** = Build workflows that execute reliably

### The Right Use Case for Azure AI Foundry

If we were building:
- An AI assistant that helps users create orders via natural language
- A document parser that uses AI to extract order information
- A chatbot that answers questions about order status

Then Azure AI Foundry Agents would be excellent.

But we're building:
- A deterministic 9-step workflow
- With exact JSON schemas
- That waits days for human input
- With guaranteed-once execution
- And 5-year audit compliance

**This is a workflow orchestration problem, not an AI agent problem.**

---

## 7. Gap Analysis

### Critical Gaps (Would Block Implementation)

| Gap | Severity | Impact |
|-----|----------|--------|
| No structured outputs for Agents | CRITICAL | Cannot guarantee schema compliance |
| Thread-based state (not event-sourced) | CRITICAL | No deterministic replay |
| No native signals/queries | HIGH | Human-in-the-loop reimplementation |
| Timeout limitations (30s default) | HIGH | Long-running steps problematic |
| No native multi-day timers | HIGH | Escalation logic external |

### Significant Gaps (Would Require Workarounds)

| Gap | Severity | Workaround |
|-----|----------|------------|
| No ETag concurrency at workflow level | MEDIUM | Implement at storage layer |
| Retry/idempotency not built-in | MEDIUM | Custom middleware |
| Audit trail not self-contained | MEDIUM | Export to external storage |
| AI overhead for deterministic tasks | MEDIUM | Disable LLM reasoning (defeats purpose) |

### Features That Would Work

| Feature | Compatibility |
|---------|---------------|
| Teams integration | Good (one-click publish) |
| Zoho API via OpenAPI | Good (with limitations) |
| BYO Cosmos DB | Good (full control) |
| UK data residency | Good (with BYO config) |
| File upload (Excel) | Good (standard feature) |

---

## 8. Recommendation

### Final Verdict: NOT VIABLE

**Suitability Score: 3/10**

Azure AI Foundry Agents is the **wrong tool** for our order processing system. It would introduce:

1. **Unnecessary complexity**: LLM layer for deterministic operations
2. **Non-determinism risk**: AI interpretation where none is needed
3. **Architecture mismatch**: Conversation model vs. workflow model
4. **Missing primitives**: No signals, no replay, no structured outputs

### When Would Azure AI Foundry Make Sense?

If we wanted to **add AI capabilities** to our existing system:
- AI-powered order parsing (handwritten orders, natural language)
- Intelligent routing based on order patterns
- Customer service chatbot for order inquiries
- Anomaly detection in order data

Then we could use Azure AI Foundry **alongside** Temporal, not instead of it.

### Validation of Current Architecture

Our Temporal.io implementation was the correct choice because:

1. **Purpose-Built**: Temporal is designed for exactly our use case
2. **Deterministic**: Guaranteed workflow execution
3. **Long-Running**: Native support for days/weeks of waiting
4. **Signals**: First-class human-in-the-loop support
5. **Replay**: Guaranteed recovery from any failure
6. **Proven**: Battle-tested at Uber, Netflix, Stripe scale

### Alternative Azure Options (If We Had to Stay Pure Azure)

If we couldn't use Temporal.io:

1. **Azure Durable Functions**: Closer match, but less mature
2. **Azure Logic Apps**: Visual workflow designer, good for simple flows
3. **Azure Service Bus + Azure Functions**: Manual orchestration

None of these match Temporal's capabilities for our specific requirements.

---

## 9. Sources

### Official Microsoft Documentation

1. [What Is Foundry Agent Service?](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview?view=foundry-classic) - Microsoft Learn
2. [Build a Workflow in Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/workflow?view=foundry) - Microsoft Learn
3. [How to use structured outputs with Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs) - Microsoft Learn
4. [Learn what is a capability host](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/capability-hosts) - Microsoft Learn
5. [Connect OpenAPI tools to Microsoft Foundry agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/openapi?view=foundry) - Microsoft Learn
6. [Using function tools with human in the loop approvals](https://learn.microsoft.com/en-us/agent-framework/tutorials/agents/function-tools-approvals) - Microsoft Learn
7. [Governance and security for AI agents](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization) - Cloud Adoption Framework
8. [Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) - Azure Architecture Center

### Microsoft Blog Posts & Announcements

9. [Foundry Agent Service at Ignite 2025](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/foundry-agent-service-at-ignite-2025-simple-to-build-powerful-to-deploy-trusted-/4469788) - Tech Community
10. [Building Human-in-the-loop AI Workflows with Microsoft Agent Framework](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/building-human-in-the-loop-ai-workflows-with-microsoft-agent-framework/4460342) - Tech Community
11. [Multi-agent Workflow with Human Approval using Agent Framework](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/multi-agent-workflow-with-human-approval-using-agent-framework/4465927) - Tech Community
12. [Introducing Microsoft Agent Framework](https://azure.microsoft.com/en-us/blog/introducing-microsoft-agent-framework/) - Azure Blog
13. [Azure AI Foundry Connection for Azure Cosmos DB and BYO Thread Storage](https://devblogs.microsoft.com/cosmosdb/azure-ai-foundry-connection-for-azure-cosmos-db-and-byo-thread-storage-in-azure-ai-agent-service/) - Cosmos DB Blog
14. [Publishing Agents from Microsoft Foundry to Microsoft 365 Copilot & Teams](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/publishing-agents-from-microsoft-foundry-to-microsoft-365-copilot--teams/4471184) - Tech Community

### GitHub & Community

15. [Azure AI Foundry GitHub Discussions](https://github.com/orgs/azure-ai-foundry/discussions) - GitHub
16. [Build Long-Running AI Agents on Azure App Service](https://azure.github.io/AppService/2025/10/21/app-service-agent-framework.html) - Azure App Service Blog
17. [azure-ai-docs capability-hosts.md](https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/ai-foundry/agents/concepts/capability-hosts.md) - GitHub

### Temporal.io References

18. [Durable Execution meets AI: Why Temporal is ideal for AI agents](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai) - Temporal Blog
19. [Durable Execution Solutions](https://temporal.io/) - Temporal Homepage

### Third-Party Analysis

20. [Building Reliable AI Agents with Azure Functions, Foundry and the MCP](https://visualstudiomagazine.com/articles/2025/12/01/building-reliable-ai-agents-with-azure-functions-foundry-and-mcp.aspx) - Visual Studio Magazine
21. [Comparing Azure Durable Functions and Temporal.IO](https://medium.com/@mareks-082/i-actually-had-a-paragraph-comparing-azure-durable-functions-and-temporal-io-63f5372d9a62) - Medium

---

## Appendix: Our Current Implementation (Reference)

### Temporal Workflow Structure

```
1. storeFile       - Store uploaded Excel to blob storage
2. parseFile       - Deterministic ExcelJS parsing
3. aiCommittee     - 3-of-5 LLM consensus (Claude/GPT)
4. resolveCustomer - Zoho customer matching
5. resolveItems    - Zoho item matching
6. awaitApproval   - Human signal (days)
7. createZohoDraft - Zoho API with retry queue
8. finalizeAudit   - Create audit bundle
9. notifyUser      - Teams notification
```

### Human-in-the-Loop Signals

```typescript
FileReuploaded: { fileUrl: string }
CorrectionsSubmitted: { corrections: CorrectionData }
SelectionsSubmitted: { selections: SelectionData }
ApprovalReceived: { approved: boolean }
```

### Why This Works with Temporal

- **Event-sourced**: Every step recorded, replayable
- **Signals**: Native async human input
- **Timers**: `workflow.sleep('24h')` for escalation
- **Replay**: Crash recovery without state loss
- **Versioning**: Update workflow code safely

---

*Document generated by Claude Code (Opus 4.5) for architecture validation purposes.*
