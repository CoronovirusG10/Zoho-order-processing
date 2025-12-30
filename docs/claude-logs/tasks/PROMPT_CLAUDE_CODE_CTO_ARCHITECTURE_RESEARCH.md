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
