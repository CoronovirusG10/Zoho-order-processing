# PROMPT: VM-Only Migration Verification Test

**Version:** 1.0
**Created:** 2025-12-26
**Purpose:** Comprehensive verification that all migration work was completed correctly
**Execution Mode:** Parallel verification agents for speed

---

## Executive Directive

This prompt verifies that the VM-Only Migration (PROMPT_3) was executed correctly. Launch multiple concurrent verification agents to check all deliverables, documentation consistency, and code completeness.

**CRITICAL:** This is a READ-ONLY verification. Do NOT modify any files. Report discrepancies only.

---

## Verification Protocol

### Agent Orchestration

Launch **15 concurrent verification agents** in a single message. Each agent checks a specific aspect of the migration.

```
IMPORTANT:
- All agents run in parallel (run_in_background: true)
- Each agent returns: PASS, FAIL, or WARN with specific findings
- Collect all results with TaskOutput
- Generate consolidated report at the end
```

---

## Phase 1: Launch All Verification Agents

### Agent 1: Workflow Code Verification
```
Task: Verify Temporal workflow code exists and is complete
Check:
1. File exists: app/services/workflow/src/workflows/order-processing.workflow.ts
2. File contains: proxyActivities, defineSignal, defineQuery, setHandler, condition, continueAsNew
3. File defines 4 signals: FileReuploaded, CorrectionsSubmitted, SelectionsSubmitted, ApprovalReceived
4. File has 8 workflow steps: storeFile, parseExcel, runCommittee, resolveCustomer, resolveItems, awaitApproval, createZohoDraft, notifyComplete
5. File has 2 retry policies: standardRetry (3 attempts), aggressiveRetry (5 attempts)
6. NO Azure Durable Functions imports (no @azure/durable-functions)

Return: PASS/FAIL with specific line numbers for any issues
```

### Agent 2: Activities Verification
```
Task: Verify all 10 activity files exist and are properly structured
Check files in app/services/workflow/src/activities/:
1. store-file.ts - storeFile activity
2. parse-excel.ts - parseExcel activity
3. run-committee.ts - runCommittee activity
4. resolve-customer.ts - resolveCustomer activity
5. resolve-items.ts - resolveItems activity
6. apply-corrections.ts - applyCorrections activity
7. apply-selections.ts - applySelections activity
8. create-zoho-draft.ts - createZohoDraft activity
9. notify-user.ts - notifyUser activity
10. update-case.ts - updateCase activity
11. index.ts - exports all activities

Verify each file:
- Has proper async function signature
- Uses DefaultAzureCredential (not Function-specific auth)
- NO Azure Functions decorators or imports

Return: PASS/FAIL with list of missing or incorrect files
```

### Agent 3: Worker Verification
```
Task: Verify Temporal worker configuration
Check file: app/services/workflow/src/worker.ts
1. Imports from @temporalio/worker
2. Connects to Temporal server (NativeConnection.connect)
3. Creates Worker with taskQueue: 'order-processing'
4. Registers workflows and activities
5. Has graceful shutdown handlers (SIGTERM, SIGINT)
6. Has PM2 ready signal (process.send('ready'))
7. Concurrency settings exist (maxConcurrentWorkflowTaskExecutions, maxConcurrentActivityTaskExecutions)

Return: PASS/FAIL with specific missing elements
```

### Agent 4: Express Server Verification
```
Task: Verify Express API server configuration
Check file: app/services/workflow/src/server.ts
1. Express app with required endpoints:
   - POST /api/workflow/start
   - GET /api/workflow/:id/status
   - POST /api/workflow/:id/signal/:name
   - GET /health, /ready, /live
2. Uses Temporal client for workflow operations
3. NO Azure Functions HTTP trigger patterns
4. Has graceful shutdown handling
5. Uses helmet and cors middleware

Return: PASS/FAIL with missing endpoints or issues
```

### Agent 5: Docker Compose Verification
```
Task: Verify Temporal Docker Compose configuration
Check file: app/services/workflow/docker-compose.temporal.yml
1. Has postgresql service with:
   - postgres:15-alpine image
   - Health check
   - Volume mount for persistence
   - Port bound to 127.0.0.1:5432
2. Has temporal service with:
   - temporalio/auto-setup image
   - DB=postgres12 environment variable
   - Depends on postgresql
   - Port bound to 127.0.0.1:7233
3. Has temporal-ui service with:
   - temporalio/ui image
   - Port bound to 127.0.0.1:8080
4. Network configuration exists

Return: PASS/FAIL with specific issues
```

### Agent 6: nginx Configuration Verification
```
Task: Verify nginx reverse proxy configuration
Check file: app/services/workflow/nginx/temporal-proxy.conf
1. SSL configuration (TLS 1.2/1.3)
2. Temporal UI location with basic_auth
3. API location proxying to localhost:3000
4. Security headers (HSTS, X-Frame-Options, etc.)
5. HTTP to HTTPS redirect

Return: PASS/FAIL with missing security features
```

### Agent 7: VM Bicep Verification
```
Task: Verify VM Bicep template
Check file: app/infra/modules/vm.bicep
1. VM resource definition with:
   - Ubuntu 22.04 LTS
   - System-assigned managed identity
   - Premium SSD disk
   - Configurable vmSize parameter
2. Azure Monitor Agent extension
3. Required tags: Project, CostCenter, Environment
4. Cloud-init custom data parameter
5. NO Azure Functions or Container Apps resources

Return: PASS/FAIL with missing infrastructure elements
```

### Agent 8: Cloud-init Verification
```
Task: Verify cloud-init configuration
Check file: app/infra/scripts/cloud-init.yaml
1. Installs Docker and docker-compose
2. Installs nginx
3. Installs Node.js 20 LTS
4. Installs PM2 globally
5. Creates required directories:
   - /opt/order-processing
   - /opt/temporal/postgres-data
6. Configures PM2 systemd service

Return: PASS/FAIL with missing setup steps
```

### Agent 9: Documentation Consistency - README Files
```
Task: Verify main documentation mentions Temporal, not Azure Functions
Check files:
1. README.md (root)
2. app/services/workflow/README.md
3. app/infra/README.md

For each file verify:
- Mentions "Temporal" or "Temporal.io"
- Does NOT mention "Azure Functions" as current architecture (historical references OK)
- Does NOT mention "Durable Functions" as current architecture
- Has updated architecture diagram or description

Return: PASS/FAIL per file with specific inconsistencies
```

### Agent 10: Documentation Consistency - Architecture Docs
```
Task: Verify architecture documentation is updated
Check files:
1. app/docs/architecture/overview.md
2. app/docs/architecture/data-flow.md
3. app/infra/INFRASTRUCTURE_OVERVIEW.md

For each file verify:
- Describes Temporal.io for workflow orchestration
- Describes VM-based deployment
- Has updated diagrams showing VM architecture
- NO outdated Function App references

Return: PASS/FAIL per file with outdated content locations
```

### Agent 11: Documentation Consistency - Deployment Docs
```
Task: Verify deployment documentation is updated
Check files:
1. app/services/workflow/DEPLOYMENT.md

Verify:
- Describes VM deployment process
- Includes Docker Compose setup for Temporal
- Includes PM2 configuration
- Has rollback procedures
- NO Azure Functions deployment instructions as current method

Return: PASS/FAIL with specific gaps
```

### Agent 12: Cost Analysis Verification
```
Task: Verify cost analysis is accurate for existing VM scenario
Check file: docs/cost-analysis-2025-12-26.md

Verify:
1. Has "VM-Only Migration Cost Analysis" section
2. Correctly shows VM compute as $0 (existing VM)
3. Correctly shows PostgreSQL as $0 (Docker, not Azure managed)
4. Shows VM-Only as LOWER cost than Functions (not higher)
5. Recommendation is POSITIVE for VM-Only on existing VM

Check for INCORRECT statements:
- VM compute costs of $140/month (WRONG - existing VM is $0)
- PostgreSQL costs of $260/month (WRONG - Docker is $0)
- Total of $455/month (WRONG - should be ~$55)
- "Not recommended" verdicts (WRONG - should be recommended)

Return: PASS/FAIL with specific incorrect cost figures
```

### Agent 13: Progress Log Verification
```
Task: Verify migration progress log shows completion
Check file: app/_build_logs/2025-12-26/VM_MIGRATION_PROGRESS.md

Verify:
1. Status shows "COMPLETE" or "APPROVED FOR DEPLOYMENT"
2. All 6 phases marked as complete
3. All Priority 1 remediation items (R1, R2, R3) marked complete
4. All Phase 4 documentation updates (8 files) marked complete
5. Final validation shows APPROVED

Return: PASS/FAIL with incomplete items
```

### Agent 14: Final Report Verification
```
Task: Verify final migration report exists and is accurate
Check file: app/_build_logs/2025-12-26/VM_MIGRATION_FINAL_REPORT.md

Verify:
1. File exists
2. Shows APPROVED status
3. Lists all created files
4. Has correct cost analysis (using existing VM)
5. Has deployment checklist
6. Has rollback procedures

Return: PASS/FAIL with missing sections
```

### Agent 15: No Azure Functions Remnants
```
Task: Search for any remaining Azure Functions references in code
Search patterns:
1. Grep for "@azure/durable-functions" in all .ts files under app/services/workflow/
2. Grep for "AzureFunction" in all .ts files
3. Grep for "callActivityWithRetry" in all .ts files (Durable Functions pattern)
4. Grep for "waitForExternalEvent" in all .ts files (should be replaced with signals)
5. Grep for "host.json" in workflow directory (should be deleted or deprecated)

EXCLUDE from search:
- Test files comparing old vs new
- Migration documentation
- Build logs and history

Return: PASS if no active code uses Functions, FAIL with file locations if found
```

---

## Phase 2: Collect Results and Generate Report

After launching all 15 agents, wait for completion and generate a consolidated report:

```markdown
# VM-Only Migration Verification Report

**Date:** 2025-12-26
**Verified By:** Claude Code Verification Suite

## Summary

| Category | Status | Details |
|----------|--------|---------|
| Workflow Code | PASS/FAIL | |
| Activities | PASS/FAIL | |
| Worker | PASS/FAIL | |
| Express Server | PASS/FAIL | |
| Docker Compose | PASS/FAIL | |
| nginx Config | PASS/FAIL | |
| VM Bicep | PASS/FAIL | |
| Cloud-init | PASS/FAIL | |
| README Docs | PASS/FAIL | |
| Architecture Docs | PASS/FAIL | |
| Deployment Docs | PASS/FAIL | |
| Cost Analysis | PASS/FAIL | |
| Progress Log | PASS/FAIL | |
| Final Report | PASS/FAIL | |
| No Functions Remnants | PASS/FAIL | |

## Overall Verdict

**MIGRATION COMPLETE: YES/NO**

## Issues Found

[List any FAIL or WARN items with specific details]

## Recommendations

[Any suggested fixes or follow-up actions]
```

---

## Execution Instructions

1. **Copy this prompt to a new Claude Code session**
2. **Run all 15 verification agents in parallel** (single message with 15 Task tool calls)
3. **Wait for all agents to complete** (use TaskOutput with block=true)
4. **Generate consolidated report**
5. **Save report to:** `app/_build_logs/2025-12-26/VM_MIGRATION_VERIFICATION_REPORT.md`

---

## Special Verification: PostgreSQL Deployment Model

**CLARIFICATION NEEDED:**

The original PROMPT_3 mentions:
- Line 143: `| PostgreSQL | order-processing-temporal-db | Temporal workflow state |`

This could mean:
1. **Azure Database for PostgreSQL Flexible Server** (~$260/month)
2. **PostgreSQL in Docker on the VM** ($0 incremental)

The migration was implemented with **Option 2 (Docker PostgreSQL)**.

Verify which was intended and document if there's a mismatch.

---

## Expected Outcomes

If migration was done correctly:
- All 15 agents should return PASS
- Cost analysis should show VM-Only as ~$55/month (not $455)
- No Azure Functions imports in active code
- All documentation references Temporal, not Functions

If issues found:
- Generate specific remediation tasks
- Identify priority order for fixes
- Estimate effort to resolve

---

*This verification prompt should complete in ~10-15 minutes with parallel execution.*
