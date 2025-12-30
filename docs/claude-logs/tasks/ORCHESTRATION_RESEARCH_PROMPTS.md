# Orchestration Architecture Research Prompts

**Created**: 2025-12-30T09:00:00Z
**Purpose**: Deep research into optimal orchestration architecture for order processing system

---

## Prompt 1: Claude Code CTO Orchestration (Ultrathink)

Copy this entire prompt into a new Claude Code session:

```markdown
# CTO Orchestration: Order Processing Architecture Research

You are the CTO orchestrator for a critical architecture decision. Your task is to conduct the deepest possible research into whether the current Temporal-based architecture is optimal, or whether Azure AI Foundry Agents/Workflows would be superior.

## Your Role

- **Delegate ALL research to Task agents** (claude-opus-4-5, ultrathink mode)
- **Spawn parallel agents** for independent research tracks
- **Synthesize findings** into actionable recommendations
- **Save all findings** to `docs/claude-logs/tasks/` for context preservation
- **Use Zen MCP consensus** for final validation with 5+ models

## Context Preservation Protocol

After EVERY major research phase, save a checkpoint file:
```
docs/claude-logs/tasks/ARCH_RESEARCH_CHECKPOINT_{N}.md
```

Include:
- Findings so far
- Open questions
- Next research directions
- Key decisions made

This ensures any future CTO session can resume with full context.

---

## System Under Analysis

### Current Architecture (Temporal-based)

**Production System**: Order processing for Pippa of London (fashion brand)
- **URL**: https://processing.pippaoflondon.co.uk
- **Users**: 13 salespeople via Microsoft Teams
- **Volume**: ~50-200 orders/day expected

**Technology Stack**:
- **Orchestration**: Temporal Server (self-hosted on Azure VM)
- **Bot Interface**: Microsoft Teams Bot (Bot Framework SDK)
- **Storage**: Azure Cosmos DB (state), Azure Blob Storage (files/audit)
- **AI**: Multi-model committee via Zen MCP (GPT-5.x, Claude, DeepSeek, Gemini)
- **ERP**: Zoho Books (draft sales orders)
- **Hosting**: Single Azure VM (Ubuntu 22.04), PM2 process manager, nginx

**Workflow Steps** (8-step Temporal workflow):
1. `storeFile` - Copy Excel from OneDrive to Blob, compute SHA-256
2. `parseExcel` - Extract data with formula blocking, create evidence packs
3. `runCommittee` - 3-of-5 AI model consensus on field mappings
4. `resolveCustomer` - Match against Zoho customer database
5. `resolveItems` - Match SKU/GTIN/name against Zoho items
6. `awaitApproval` - Human approval via Teams adaptive card
7. `createZohoDraft` - Create draft sales order in Zoho Books
8. `notifyComplete` - Send success card with order link

**Human-in-the-Loop Signals**:
- `FileReuploaded` - User uploads corrected file (triggers continueAsNew)
- `CorrectionsSubmitted` - User submits field corrections
- `SelectionsSubmitted` - User selects from ambiguous matches
- `ApprovalReceived` - User approves/rejects draft

**Current Status**: ~75% complete, infrastructure 100% operational

### Business Requirements

1. **Reliability**: Orders must not be lost or duplicated
2. **Auditability**: 5-year audit trail for compliance
3. **Human Review**: Salespeople must approve before ERP submission
4. **Multi-Modal**: Future support for images, PDFs, voice notes
5. **Idempotency**: Temporal retries must not create duplicate orders
6. **Long-Running**: Workflows may wait days for human approval

### Azure Resources Available

- **Azure AI Foundry**: Project exists (`pippai-ai-project`)
- **Azure OpenAI**: GPT-4o, GPT-4o-mini deployed
- **Cosmos DB**: `cosmos-visionarylab` (order-processing database)
- **Blob Storage**: `pippaistoragedev`
- **Key Vault**: `pippai-keyvault-dev`
- **Managed Identity**: Configured with RBAC

---

## Research Questions

### Track 1: Azure AI Foundry Agents Deep Dive

Spawn Task agent to research:

1. **Capability Assessment**
   - Can Azure Agents handle 8-step business workflows?
   - How do Agents handle long-running processes (days)?
   - What's the state persistence model?
   - How are human-in-the-loop approvals handled?

2. **Capability Hosts**
   - What are capability hosts?
   - How do they affect thread/file/vector storage?
   - Can we use our own Cosmos DB?
   - What happens if we don't configure them?

3. **Structured Output**
   - Can Agents produce strict JSON schemas?
   - How does this compare to direct model calls?
   - What's the reliability for business-critical extraction?

4. **Integration Patterns**
   - How would Agents integrate with Teams Bot?
   - Can Agents call Zoho APIs directly?
   - How do we maintain audit trail?

5. **Limitations**
   - What CAN'T Azure Agents do?
   - Are there workflow patterns they don't support?
   - What's the failure/retry model?

### Track 2: Azure Durable Functions Comparison

Spawn Task agent to research:

1. **Feature Parity with Temporal**
   - Signals/events?
   - Long-running orchestrations?
   - Workflow versioning?
   - Replay debugging?

2. **Migration Effort**
   - How much code would need rewriting?
   - Can we keep the same activity structure?
   - What's the testing strategy?

3. **Operational Differences**
   - Self-hosted vs serverless
   - Cost model comparison
   - Monitoring/observability

### Track 3: Temporal Strengths/Weaknesses

Spawn Task agent to research:

1. **Current Pain Points**
   - Self-hosting complexity
   - VM single point of failure
   - Scaling considerations

2. **Temporal Cloud Option**
   - Managed Temporal service
   - Cost comparison
   - Migration path

3. **Best Practices Validation**
   - Is our current design following Temporal best practices?
   - Are there patterns we're missing?
   - What would a Temporal expert change?

### Track 4: Hybrid Architecture Exploration

Spawn Task agent to research:

1. **Temporal + Azure Agents**
   - Use Temporal for orchestration
   - Use Azure Agents for AI reasoning steps
   - Best of both worlds?

2. **Implementation Pattern**
   - Agent as Temporal activity
   - Structured output extraction
   - Error handling

3. **Cost/Complexity Analysis**
   - Does hybrid add unnecessary complexity?
   - What's the operational overhead?

### Track 5: Industry Patterns Research

Spawn Task agent to research:

1. **Similar Systems**
   - How do other companies build document→order systems?
   - What orchestration do they use?
   - What AI patterns do they follow?

2. **Microsoft Recommendations**
   - What does Microsoft recommend for this use case?
   - Are there reference architectures?
   - Case studies?

3. **Temporal vs Alternatives**
   - Real-world comparisons
   - Migration stories
   - Failure cases

---

## Research Execution Plan

### Phase 1: Parallel Deep Dives (5 Task agents)

Spawn ALL five research tracks simultaneously:

```
Task 1: "Research Azure AI Foundry Agents capabilities, capability hosts,
        structured output, Teams integration, and limitations for business
        workflow orchestration. Search official docs, GitHub issues, and
        real-world examples. Return comprehensive analysis."

Task 2: "Compare Azure Durable Functions to Temporal for the order processing
        use case. Analyze feature parity, migration effort, operational
        differences. Include code examples where relevant."

Task 3: "Analyze Temporal strengths and weaknesses for our use case. Research
        Temporal Cloud as alternative to self-hosting. Validate our current
        design against best practices."

Task 4: "Research hybrid Temporal + Azure Agents architecture. How would
        Agents be used as Temporal activities? What's the implementation
        pattern? Cost/complexity analysis."

Task 5: "Research industry patterns for document→order processing systems.
        Find similar systems, Microsoft recommendations, reference architectures,
        and real-world case studies."
```

### Phase 2: Synthesis

After Task agents return:
1. Create comparison matrix
2. Identify consensus points
3. Flag disagreements for deeper research

### Phase 3: Zen Consensus Validation

Use `mcp__zen__consensus` with 5+ models:
- GPT-5.2 (neutral)
- DeepSeek-V3.2-Speciale (against current approach)
- Claude-opus-4-5 (for current approach)
- Gemini-2.5-pro (neutral, large context)
- o3 (deep reasoning)

### Phase 4: Final Recommendation

Create final document:
```
docs/claude-logs/tasks/ARCHITECTURE_DECISION_RECORD.md
```

Include:
- Decision
- Rationale
- Alternatives considered
- Migration path (if changing)
- Risk assessment

---

## Output Requirements

1. **Save ALL research** to `docs/claude-logs/tasks/`
2. **Create checkpoint files** after each phase
3. **Final ADR** with clear recommendation
4. **Updated completion plan** if architecture changes

## Start Command

Begin by spawning the 5 parallel research Task agents. Use model `opus` for all agents.

Remember: You are the CTO orchestrator. DELEGATE everything. Preserve context in files.
```

---

## Prompt 2: ChatGPT Pro Deep Research

Copy this entire prompt into ChatGPT Pro (with Deep Research enabled):

```markdown
# Deep Research: Optimal Orchestration Architecture for Order Processing System

## Research Request

I need comprehensive research comparing orchestration approaches for a production order processing system. Please conduct deep research across academic papers, Microsoft documentation, Temporal documentation, real-world case studies, and industry best practices.

## System Context

### Current Production System

**Business**: Pippa of London (fashion brand)
**Function**: Automated order processing from Excel uploads to ERP (Zoho Books)
**Users**: 13 salespeople via Microsoft Teams
**Volume**: 50-200 orders/day

**Current Stack**:
- **Orchestration**: Temporal Server (self-hosted on Azure VM)
- **Interface**: Microsoft Teams Bot (Bot Framework SDK)
- **AI**: Multi-model committee (GPT-5.x, Claude, DeepSeek, Gemini)
- **Storage**: Azure Cosmos DB + Azure Blob Storage
- **ERP**: Zoho Books API

**Workflow** (8 steps):
1. Receive Excel file upload in Teams
2. Store file to Azure Blob with SHA-256 hash
3. Parse Excel with formula blocking, create evidence packs
4. AI committee validates field mappings (3-of-5 consensus)
5. Resolve customer against Zoho database
6. Resolve items (SKU/GTIN/name matching)
7. Human approval via Teams adaptive card
8. Create draft sales order in Zoho

**Human-in-the-Loop Requirements**:
- Users can submit corrections
- Users can select from ambiguous matches
- Users must approve before ERP submission
- Workflows may wait days for human response

### Azure Resources Available

- Azure AI Foundry project
- Azure OpenAI (GPT-4o deployed)
- Azure Cosmos DB
- Azure Blob Storage
- Azure Key Vault
- Managed Identity with RBAC

## Research Questions

### 1. Azure AI Foundry Agents vs Temporal

**Question**: Should we replace Temporal with Azure AI Foundry Agents for workflow orchestration?

Research needed:
- What are Azure AI Foundry Agents designed for?
- Can they handle multi-step business workflows?
- How do they handle long-running processes (waiting days for human input)?
- What are "capability hosts" and how do they affect architecture?
- What are the limitations of Azure Agents for business process orchestration?
- Are there documented cases of Agents being used for similar workflows?

### 2. Azure Durable Functions vs Temporal

**Question**: Should we migrate from self-hosted Temporal to Azure Durable Functions?

Research needed:
- Feature comparison (signals, long-running, versioning, replay)
- Migration complexity from Temporal to Durable Functions
- Operational differences (self-hosted vs serverless)
- Cost comparison for our scale (50-200 workflows/day)
- Real-world migration case studies

### 3. Temporal Best Practices

**Question**: Is our current Temporal implementation optimal?

Research needed:
- Temporal best practices for human-in-the-loop workflows
- Self-hosted vs Temporal Cloud comparison
- Scaling patterns for Temporal
- Common anti-patterns to avoid

### 4. Hybrid Architectures

**Question**: Could we use Temporal for orchestration + Azure Agents for AI reasoning?

Research needed:
- Patterns for using AI agents as workflow activities
- Examples of Temporal + AI agent integration
- Complexity and operational overhead analysis

### 5. Industry Patterns

**Question**: How do similar systems architect document→order pipelines?

Research needed:
- Reference architectures for document processing to ERP
- Microsoft recommended patterns for this use case
- Real-world case studies of similar systems
- Comparison of orchestration choices (Temporal, Durable Functions, Step Functions, etc.)

## Specific Technical Questions

1. **Azure Agents State Model**: How does Azure AI Foundry Agent Service persist state between interactions? Is it suitable for multi-day workflows?

2. **Capability Hosts**: What exactly are capability hosts in Azure AI Foundry? How do they affect where threads, files, and vectors are stored?

3. **Structured Output**: Can Azure Agents produce strict JSON schemas reliably enough for business-critical data extraction?

4. **Teams Integration**: What's the recommended pattern for integrating Azure Agents with Microsoft Teams bots?

5. **Temporal Signals vs Agent Threads**: How do Temporal signals (for human input) compare to Azure Agent thread-based conversations?

6. **Audit Trail**: Which approach provides better audit trail capabilities for 5-year compliance requirements?

7. **Idempotency**: How does each platform handle retry scenarios to prevent duplicate order creation?

## Output Format

Please provide:

1. **Executive Summary** (1 page)
   - Clear recommendation
   - Key factors driving recommendation
   - Risk assessment

2. **Detailed Comparison Matrix**
   - Feature-by-feature comparison
   - Scores for each criterion
   - Weighted recommendation

3. **Architecture Options** (with diagrams if possible)
   - Option A: Keep Temporal (current)
   - Option B: Migrate to Azure Agents
   - Option C: Migrate to Durable Functions
   - Option D: Hybrid Temporal + Agents

4. **Migration Analysis** (if recommending change)
   - Effort estimate
   - Risk factors
   - Phased approach

5. **Sources**
   - All documentation referenced
   - Case studies cited
   - Expert opinions included

## Context Files

The system codebase is at `/data/order-processing/` with:
- `app/services/workflow/` - Temporal workflow and activities
- `app/services/teams-bot/` - Teams bot service
- `app/services/zoho/` - Zoho integration library
- `app/services/parser/` - Excel parsing service
- `app/services/committee/` - AI consensus service

Current completion status: ~75% complete
Infrastructure: 100% operational
Remaining work: Activity persistence, selection cards, signal handlers
```

---

## Prompt 3: Completion Plan Update

See the updated file below.
