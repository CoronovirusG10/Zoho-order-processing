# PROMPT: VM-Only Architecture Migration

**Version:** 1.0
**Created:** 2025-12-26
**Mode:** ULTRATHINK with Multi-Model Validation
**Estimated Sessions:** 3-5 (with context preservation)

---

## Executive Directive

Migrate the Order Processing application from Azure Functions/Container Apps architecture to **VM-only deployment** in the existing `pippai-rg` resource group. All resources must be properly tagged for cost allocation to the Order Processing project.

---

## CTO Orchestration Protocol

### Context Window Management

You are a CTO orchestrator. Your context window is finite (~200K tokens). Preserve it for high-level decisions.

**MANDATORY DELEGATION RULES:**
- File reads of 3+ files → Delegate to Task agent
- Any codebase exploration → Delegate to Task agent with `subagent_type=Explore`
- All MCP tool calls → Delegate to Task agent
- Past 50% context → Delegate EVERYTHING
- Past 70% context → Emergency checkpoint and handoff

**PARALLEL EXECUTION:**
- Launch up to 10 Task agents per message
- Use `run_in_background: true` for long-running tasks
- Collect results with `TaskOutput` tool

### Session Continuity

**Log Location:** `/data/order-processing/app/_build_logs/2025-12-26/`

**Required Logs:**
1. `VM_MIGRATION_PROGRESS.md` - Main progress tracker
2. `VM_MIGRATION_DAILY_LOG.md` - Detailed session log
3. `VM_MIGRATION_DECISIONS.md` - Architecture decisions
4. `VM_MIGRATION_ISSUES.md` - Issues and resolutions

**Checkpoint Protocol:**
- Write checkpoint after each major phase
- Include: completed tasks, pending tasks, blockers, context consumed
- On session break: Write emergency checkpoint with full state

---

## Phase 1: Research & Analysis (Parallel Agents)

### 1.1 Launch Research Agents (10 concurrent)

```
Agent 1: Temporal.io self-hosted requirements
- PostgreSQL setup on Azure
- Temporal server deployment options
- Worker configuration for Node.js
- Return: Setup guide summary

Agent 2: Existing pippai-vm analysis
- Current services running
- Available resources (CPU, RAM, disk)
- Existing infrastructure (Docker, systemd, nginx)
- Return: VM readiness assessment

Agent 3: Workflow service feature analysis
- All Durable Functions features used
- External event patterns
- Retry policies
- Return: Feature-by-feature migration map

Agent 4: Bicep module dependency analysis
- What depends on Function Apps
- What can be reused
- What needs new modules
- Return: Module change matrix

Agent 5: Documentation inventory
- All files mentioning Azure Functions
- All architecture diagrams
- All deployment guides
- Return: File list with change scope

Agent 6: Cost comparison research
- VM costs (D4s_v5, D8s_v5)
- PostgreSQL (Flexible Server) costs
- Temporal Cloud vs self-hosted
- Return: Cost comparison table

Agent 7: Security implications
- RBAC changes for VM identity
- Network security for VM
- Key Vault access patterns
- Return: Security change checklist

Agent 8: Deployment automation research
- PM2 vs systemd for Node.js
- Azure DevOps/GitHub Actions for VM
- Blue-green deployment on VM
- Return: Deployment strategy recommendation

Agent 9: Monitoring strategy
- Azure Monitor Agent for VMs
- Application Insights from VM
- Log Analytics integration
- Return: Monitoring setup guide

Agent 10: Existing cosmos/storage reuse
- Current Cosmos containers
- Current Storage containers
- Cross-RG access patterns
- Return: Data layer assessment
```

### 1.2 Synthesize Research Results

After all agents complete:
1. Compile findings into `VM_MIGRATION_RESEARCH.md`
2. Identify blockers or risks
3. Update progress log
4. Create decision document for architecture choices

---

## Phase 2: Architecture Design

### 2.1 Create New Architecture Document

Write `VM_ONLY_ARCHITECTURE.md` with:

```markdown
# VM-Only Architecture

## Resource Placement

### pippai-rg (Existing)
| Resource | Name | Purpose | Tags |
|----------|------|---------|------|
| VM | pippai-vm | All Order Processing services | Project=order-processing, CostCenter=zoho |
| PostgreSQL | order-processing-temporal-db | Temporal workflow state | Project=order-processing |
| Cosmos DB | order-processing-cosmos | Application data | Project=order-processing |
| Storage | orderprocXXXX | Blobs and queues | Project=order-processing |

### Services on VM
| Service | Port | Process Manager | Purpose |
|---------|------|-----------------|---------|
| Temporal Server | 7233 | Docker Compose | Workflow orchestration |
| Temporal Worker | - | PM2 | Workflow execution |
| Teams Bot | 3978 | PM2 | Teams webhook |
| API Service | 3000 | PM2 | REST API |
| nginx | 80/443 | systemd | Reverse proxy, SSL |

## Tagging Strategy
All resources tagged with:
- `Project`: order-processing
- `CostCenter`: zoho
- `Environment`: dev/prod
- `ManagedBy`: claude-code
```

### 2.2 Multi-Model Validation (Zen)

Launch Zen sessions to validate architecture:

```
Session 1: o3-pro
Prompt: "Review this VM-only architecture for Order Processing.
Context: [Full architecture document]
Evaluate: Security, scalability, cost-effectiveness, operational complexity.
Return: Approval/concerns with specific recommendations."

Session 2: deepseek-3.2
Prompt: "Analyze the Temporal.io self-hosted deployment on Azure VM.
Context: [Architecture + Temporal setup details]
Evaluate: Reliability, PostgreSQL sizing, worker configuration.
Return: Technical validation with risk assessment."

Session 3: gpt-5.2
Prompt: "Review the migration plan from Azure Functions to VM-hosted Temporal.
Context: [Current workflow code + proposed Temporal migration]
Evaluate: Migration complexity, rollback strategy, testing approach.
Return: Implementation recommendations."
```

### 2.3 Consensus Check

If all 3 models approve → Proceed to Phase 3
If any model has CRITICAL concerns → Address before proceeding
Log all feedback in `VM_MIGRATION_DECISIONS.md`

---

## Phase 3: Code Migration

### 3.1 Workflow Service Rewrite (Largest Change)

**Delegate to Task agents:**

```
Agent: Rewrite orchestration to Temporal
Files: /data/order-processing/app/services/workflow/src/orchestrations/
Task: Convert Durable Functions orchestration to Temporal workflow
Output: New workflow code + migration notes

Agent: Rewrite activities to Temporal
Files: /data/order-processing/app/services/workflow/src/activities/
Task: Convert Azure Functions activities to Temporal activities
Output: New activity code + dependency changes

Agent: Create Temporal worker
Task: Create new worker.ts with activity registration
Output: worker.ts + package.json updates

Agent: Rewrite triggers to Express
Files: /data/order-processing/app/services/workflow/src/triggers/
Task: Convert Function triggers to Express.js routes
Output: New routes + server.ts
```

### 3.2 Infrastructure Changes

**Delegate to Task agents:**

```
Agent: Update vnet.bicep
Task: Add VM subnet, remove Functions subnet
Output: Modified vnet.bicep

Agent: Create vm.bicep
Task: New module for VM deployment with managed identity
Output: New vm.bicep module

Agent: Update rbac.bicep
Task: Replace Function App principals with VM principal
Output: Modified rbac.bicep

Agent: Update main.bicep
Task: Remove Function/Container modules, add VM modules
Output: Modified main.bicep

Agent: Create deployment scripts
Task: Create scripts/deploy-to-vm.sh for application deployment
Output: Deployment scripts
```

### 3.3 Validation Gates

After each major component:
1. Run `npm run build` to verify TypeScript compiles
2. Run `npm run test` to verify tests pass
3. Log results to progress file

---

## Phase 4: Documentation Updates

### 4.1 Priority 1 - Critical Updates (8 files)

```
Files to update:
1. /data/order-processing/app/services/workflow/README.md
2. /data/order-processing/app/services/workflow/DEPLOYMENT.md
3. /data/order-processing/app/infra/README.md
4. /data/order-processing/app/infra/INFRASTRUCTURE_OVERVIEW.md
5. /data/order-processing/README.md
6. /data/order-processing/app/docs/architecture/overview.md
7. /data/order-processing/app/docs/architecture/data-flow.md
8. /data/order-processing/docs/cost-analysis-2025-12-26.md
```

**Delegate per file:** One Task agent per file with specific update instructions

### 4.2 Priority 2 - High Updates (12 files)

Update after Priority 1 complete.

### 4.3 Generate New Documents

```
New documents to create:
1. VM_DEPLOYMENT_GUIDE.md - How to deploy to VM
2. TEMPORAL_OPERATIONS.md - Temporal management runbook
3. PM2_CONFIGURATION.md - PM2 setup and management
4. NGINX_CONFIGURATION.md - Reverse proxy setup
```

---

## Phase 5: Multi-Model Final Validation

### 5.1 Full Plan Review

Launch Zen sessions with complete context:

```
All models (o3-pro, deepseek-3.2, gpt-5.2):

Context:
- Updated architecture documents
- Modified Bicep templates
- Migrated workflow code
- Updated documentation

Validation checklist:
1. Is the architecture sound?
2. Are all Durable Functions features properly replaced?
3. Is the deployment process documented?
4. Are there any security gaps?
5. Is cost tracking properly configured?
6. Is disaster recovery addressed?
7. Are there any missing components?

Return: APPROVE/REJECT with detailed feedback
```

### 5.2 Consensus Requirement

- 3/3 APPROVE → Generate final deployment plan
- 2/3 APPROVE with minor concerns → Address and proceed
- Any REJECT → Stop, fix issues, re-validate

---

## Phase 6: Final Deliverables

### 6.1 Updated Files Checklist

```
Infrastructure:
[ ] infra/modules/vnet.bicep (modified)
[ ] infra/modules/vm.bicep (new)
[ ] infra/modules/rbac.bicep (modified)
[ ] infra/main.bicep (modified)
[ ] infra/main.parameters.dev.json (modified)
[ ] infra/main.parameters.prod.json (modified)

Workflow Service:
[ ] services/workflow/src/workflows/ (new directory)
[ ] services/workflow/src/activities/ (modified)
[ ] services/workflow/src/worker.ts (new)
[ ] services/workflow/src/server.ts (new)
[ ] services/workflow/package.json (modified)
[ ] services/workflow/host.json (deleted)

Documentation:
[ ] All Priority 1 files updated
[ ] All Priority 2 files updated
[ ] New deployment guides created
[ ] Architecture diagrams updated
```

### 6.2 Final Report

Generate `VM_MIGRATION_FINAL_REPORT.md`:

```markdown
# VM-Only Migration Final Report

## Summary
- Migration Status: COMPLETE/IN PROGRESS
- Files Modified: X
- Files Created: X
- Files Deleted: X

## Architecture Changes
[Summary of changes]

## Validation Results
- o3-pro: APPROVED
- deepseek-3.2: APPROVED
- gpt-5.2: APPROVED

## Deployment Instructions
[Step-by-step deployment guide]

## Rollback Plan
[How to rollback if needed]

## Outstanding Items
[Any remaining work]
```

---

## Appendix: File Locations Reference

### Code to Modify

```
/data/order-processing/app/services/workflow/
├── src/
│   ├── orchestrations/order-processing.ts  → Convert to Temporal workflow
│   ├── activities/*.ts                      → Convert to Temporal activities
│   ├── triggers/*.ts                        → Convert to Express routes
│   ├── entities/case-entity.ts              → Convert to workflow queries
│   └── utils/durable-client.ts              → Replace with Temporal client
├── package.json                             → Update dependencies
└── host.json                                → DELETE
```

### Infrastructure to Modify

```
/data/order-processing/app/infra/
├── main.bicep                               → Remove Functions, add VM
├── modules/
│   ├── functionapp.bicep                    → DELETE
│   ├── containerapp.bicep                   → DELETE
│   ├── staticwebapp.bicep                   → DELETE or keep for Tab
│   ├── vnet.bicep                           → Modify subnets
│   ├── rbac.bicep                           → Rewrite for VM identity
│   ├── vm.bicep                             → NEW
│   └── [others]                             → Keep, minor updates
```

### Documentation to Update

```
Priority 1 (CRITICAL - 8 files):
- /data/order-processing/app/services/workflow/README.md
- /data/order-processing/app/services/workflow/DEPLOYMENT.md
- /data/order-processing/app/infra/README.md
- /data/order-processing/app/infra/INFRASTRUCTURE_OVERVIEW.md
- /data/order-processing/README.md
- /data/order-processing/app/docs/architecture/overview.md
- /data/order-processing/app/docs/architecture/data-flow.md
- /data/order-processing/docs/cost-analysis-2025-12-26.md

Priority 2 (HIGH - 12 files):
- /data/order-processing/SOLUTION_DESIGN.md
- /data/order-processing/MVP_AND_HOWTO.md
- /data/order-processing/app/docs/README.md
- /data/order-processing/app/CHANGELOG.md
- /data/order-processing/app/infra/DEPLOYMENT_CHECKLIST.md
- /data/order-processing/app/infra/QUICK_REFERENCE.md
- /data/order-processing/app/docs/setup/azure-deployment.md
- /data/order-processing/app/docs/setup/development.md
- /data/order-processing/app/services/workflow/QUICK_START.md
- /data/order-processing/app/services/workflow/IMPLEMENTATION_SUMMARY.md
- /data/order-processing/v7/prompts/CLAUDE_CODE_MASTER_PROMPT.md
- /data/order-processing/_predeploy/PREDEPLOYMENT_READINESS_REPORT.md
```

---

## Execution Instructions

1. **Start by reading this prompt completely**
2. **Create progress log immediately** at `_build_logs/2025-12-26/VM_MIGRATION_PROGRESS.md`
3. **Execute Phase 1** with 10 parallel agents
4. **Checkpoint after each phase** - write state to progress log
5. **If context > 70%** - write emergency checkpoint and summarize for next session
6. **Use TodoWrite** to track all tasks
7. **Validate with Zen** before finalizing any major component

---

## Success Criteria

- [ ] All services run on pippai-vm
- [ ] Temporal.io handles workflow orchestration
- [ ] All resources tagged for cost allocation
- [ ] No Azure Functions dependencies remain
- [ ] All documentation updated
- [ ] 3/3 multi-model validation passed
- [ ] Deployment guide tested and verified

---

*This prompt is designed for multi-session execution with context preservation.*
*Expected total effort: 6-8 hours across 3-5 sessions.*

