# Claude Code Prompt: Post-Test Issue Remediation

**Created:** 2025-12-30
**Prerequisite:** CLAUDE_CODE_TEST_EXECUTION.md completed
**Priority:** HIGH - Blocking Teams deployment
**Run ID:** 20251230_POST_TEST_FIX

---

## Context

The post-Temporal-fix test suite completed with **CONDITIONAL PASS**. Three issues require remediation before Teams app deployment can proceed:

| Issue | Severity | Phase | Impact |
|-------|----------|-------|--------|
| Cosmos DB database missing | **CRITICAL** | 3 | Workflow data persistence will fail |
| Workflow worker no pollers | **HIGH** | 2 | Workflows won't process |
| Workflow worker instability | **MEDIUM** | 1 | 15 restarts indicate crash loop |

---

## CTO Orchestration Instructions

You are a CTO orchestrator. Delegate execution to Task agents with `claude-opus-4-5` (ultrathink mode).

### Execution Rules

| Rule | Requirement |
|------|-------------|
| Model | `claude-opus-4-5` for all Task agents |
| Parallel Limit | Max 3 concurrent agents |
| Output Directory | `/data/order-processing/_codex_predeploy/20251229_195114/fix_results/` |
| Tasks spawning Tasks | FORBIDDEN |

---

## Phase 0: Setup and Diagnostics

**Execute directly (CTO):**

```bash
# Create output directory
mkdir -p /data/order-processing/_codex_predeploy/20251229_195114/fix_results/

# Capture current state
echo "=== Pre-Fix State Capture ===" > /data/order-processing/_codex_predeploy/20251229_195114/fix_results/00_PRE_FIX_STATE.log
date -Iseconds >> /data/order-processing/_codex_predeploy/20251229_195114/fix_results/00_PRE_FIX_STATE.log
pm2 jlist | jq '.' >> /data/order-processing/_codex_predeploy/20251229_195114/fix_results/00_PRE_FIX_STATE.log
```

---

## Phase 1: Parallel Issue Investigation

**Launch 3 Task agents IN PARALLEL in a single message:**

### Agent 1: Cosmos DB Investigation
```
Instructions:
"Investigate and fix the missing Cosmos DB database issue.

Working directory: /data/order-processing
Output: /data/order-processing/_codex_predeploy/20251229_195114/fix_results/01_COSMOS_FIX.md

Tasks:

1. List existing Cosmos DB accounts and databases:
   az cosmosdb list --resource-group pippai-rg --query '[].name' -o tsv
   az cosmosdb sql database list --account-name cosmos-visionarylab --resource-group pippai-rg --query '[].name' -o tsv

2. Check if database exists under different name:
   az cosmosdb sql database list --account-name cosmos-visionarylab --resource-group pippai-rg -o table

3. Create the order-processing database if missing:
   az cosmosdb sql database create \
     --account-name cosmos-visionarylab \
     --resource-group pippai-rg \
     --name order-processing

4. Create required containers (if database was just created):
   - orders (partition key: /orderId)
   - cases (partition key: /caseId)
   - workflows (partition key: /workflowId)
   - audit (partition key: /timestamp)
   - users (partition key: /userId)
   - settings (partition key: /key)

   For each container:
   az cosmosdb sql container create \
     --account-name cosmos-visionarylab \
     --resource-group pippai-rg \
     --database-name order-processing \
     --name <container_name> \
     --partition-key-path <partition_key>

5. Verify final state:
   az cosmosdb sql container list \
     --account-name cosmos-visionarylab \
     --resource-group pippai-rg \
     --database-name order-processing \
     --query '[].name' -o tsv

Return: Database status, containers created, any errors"
```

### Agent 2: Workflow Worker Crash Analysis
```
Instructions:
"Investigate workflow-worker instability (15 restarts detected).

Working directory: /data/order-processing
Output: /data/order-processing/_codex_predeploy/20251229_195114/fix_results/02_WORKER_CRASH_ANALYSIS.md

Tasks:

1. Get PM2 detailed status:
   pm2 describe workflow-worker

2. Capture recent crash logs:
   pm2 logs workflow-worker --lines 200 --nostream 2>&1

3. Check for error patterns in logs:
   pm2 logs workflow-worker --lines 500 --nostream 2>&1 | grep -i -E '(error|exception|failed|crash|fatal|ECONNREFUSED|timeout)' | tail -50

4. Check worker source for Temporal connection config:
   - Find the worker entry point
   - Check environment variables used
   - Verify Temporal host/port configuration

5. Check if worker can reach Temporal:
   # From host
   curl -s http://localhost:7233/health

   # Check worker env
   cat /data/order-processing/app/services/workflow-worker/.env 2>/dev/null || echo 'No .env file'

6. Identify root cause from logs:
   - Connection refused to Temporal?
   - Authentication issues?
   - Missing environment variables?
   - Namespace not found?

Return: Root cause analysis, recommended fix, crash log excerpts"
```

### Agent 3: Temporal Worker Registration Fix
```
Instructions:
"Fix the workflow worker to register pollers with Temporal.

Working directory: /data/order-processing
Output: /data/order-processing/_codex_predeploy/20251229_195114/fix_results/03_WORKER_REGISTRATION_FIX.md

Tasks:

1. Check current worker status:
   pm2 jlist | jq '.[] | select(.name == "workflow-worker")'

2. Verify Temporal server is accepting connections:
   docker exec temporal-server temporal operator cluster health

3. Check namespace exists:
   docker exec temporal-server temporal operator namespace describe order-processing

4. Get current task queue state:
   docker exec temporal-server temporal task-queue describe \
     --task-queue order-processing \
     --namespace order-processing

5. Restart workflow-worker with fresh state:
   pm2 delete workflow-worker 2>/dev/null || true
   cd /data/order-processing/app/services/workflow-worker
   pm2 start ecosystem.config.cjs --only workflow-worker

6. Wait for worker to initialize (10 seconds):
   sleep 10

7. Verify pollers registered:
   docker exec temporal-server temporal task-queue describe \
     --task-queue order-processing \
     --namespace order-processing

8. Check PM2 status after restart:
   pm2 jlist | jq '.[] | select(.name == "workflow-worker") | {name, status: .pm2_env.status, restarts: .pm2_env.restart_time}'

Return: Worker registration status, poller count, any errors"
```

---

## Phase 2: Fix Validation

**After Phase 1 agents complete, delegate validation:**

### Validation Agent
```
Instructions:
"Validate all post-test fixes were applied successfully.

Working directory: /data/order-processing
Output: /data/order-processing/_codex_predeploy/20251229_195114/fix_results/04_FIX_VALIDATION.md

Execute validation tests:

1. Cosmos DB Validation:
   # Database exists
   az cosmosdb sql database show \
     --account-name cosmos-visionarylab \
     --resource-group pippai-rg \
     --name order-processing \
     --query 'name' -o tsv

   # Container count (expect 6)
   CONTAINER_COUNT=$(az cosmosdb sql container list \
     --account-name cosmos-visionarylab \
     --resource-group pippai-rg \
     --database-name order-processing \
     --query 'length(@)')
   echo "Container count: $CONTAINER_COUNT"

2. Worker Registration Validation:
   # Check pollers are active
   docker exec temporal-server temporal task-queue describe \
     --task-queue order-processing \
     --namespace order-processing 2>&1 | grep -i poller

   # Worker PM2 status
   pm2 jlist | jq '.[] | select(.name == "workflow-worker") | {status: .pm2_env.status, restarts: .pm2_env.restart_time}'

3. Integration Test:
   # Workflow API still healthy
   curl -s http://localhost:3005/health | jq '.'

   # Temporal still connected
   docker exec temporal-server temporal operator cluster health

4. Generate validation summary:
   - Cosmos DB: PASS/FAIL
   - Worker Registration: PASS/FAIL
   - Integration: PASS/FAIL

Return: Validation results with PASS/FAIL for each fix"
```

---

## Phase 3: Generate Fix Report

**Execute directly (CTO) after validation:**

```bash
OUTPUT_DIR=/data/order-processing/_codex_predeploy/20251229_195114/fix_results

cat > ${OUTPUT_DIR}/FIX_EXECUTION_REPORT.md << 'EOF'
# Post-Test Fix Execution Report

**Run ID:** 20251230_POST_TEST_FIX
**Executed:** $(date -Iseconds)
**Prerequisite:** Test suite CONDITIONAL PASS

---

## Issues Addressed

| Issue | Fix Applied | Status |
|-------|-------------|--------|
| Cosmos DB database missing | Created database + 6 containers | ${COSMOS_STATUS} |
| Worker no active pollers | Restarted with fresh registration | ${WORKER_STATUS} |
| Worker crash loop (15 restarts) | Root cause identified and fixed | ${CRASH_STATUS} |

---

## Fix Details

### 1. Cosmos DB Fix
See: 01_COSMOS_FIX.md

### 2. Worker Crash Analysis
See: 02_WORKER_CRASH_ANALYSIS.md

### 3. Worker Registration Fix
See: 03_WORKER_REGISTRATION_FIX.md

### 4. Validation Results
See: 04_FIX_VALIDATION.md

---

## Next Steps

If all fixes validated:
1. Proceed with Teams app deployment
2. Execute: CLAUDE_CODE_PIPPA_TENANT_ADMIN.md
3. Monitor first workflow execution

If fixes failed:
1. Review specific fix report
2. Check PM2 logs: pm2 logs --lines 100
3. Escalate Cosmos DB issues to Azure support

---

## Post-Fix Test Re-run (Optional)

To verify all original tests now pass:

```bash
# Re-run critical tests only
docker exec temporal-server temporal task-queue describe \
  --task-queue order-processing --namespace order-processing

az cosmosdb sql container list \
  --account-name cosmos-visionarylab \
  --resource-group pippai-rg \
  --database-name order-processing \
  --query '[].name' -o tsv

pm2 jlist | jq '.[] | select(.name == "workflow-worker") | {status: .pm2_env.status, restarts: .pm2_env.restart_time}'
```

EOF

echo "Fix execution complete. Report: ${OUTPUT_DIR}/FIX_EXECUTION_REPORT.md"
```

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 0: Setup (CTO Direct)                                 │
│   - Create output directory                                 │
│   - Capture pre-fix state                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Parallel Investigation & Fix (3 Agents)            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Agent 1     │  │ Agent 2     │  │ Agent 3     │         │
│  │ Cosmos DB   │  │ Crash       │  │ Worker      │         │
│  │ Fix         │  │ Analysis    │  │ Registration│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Validation (1 Agent)                               │
│   - Verify Cosmos DB                                        │
│   - Verify worker registration                              │
│   - Integration test                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Report Generation (CTO Direct)                     │
│   - Aggregate results                                       │
│   - Generate FIX_EXECUTION_REPORT.md                        │
│   - Determine next steps                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Success Criteria

| Criterion | Validation Command | Expected |
|-----------|-------------------|----------|
| Cosmos DB database exists | `az cosmosdb sql database show ...` | order-processing |
| Cosmos DB has 6 containers | `az cosmosdb sql container list ... \| jq 'length'` | 6 |
| Worker pollers active | `temporal task-queue describe ...` | poller count > 0 |
| Worker stable | `pm2 jlist ... restarts` | 0 (after fix) |
| Workflow API healthy | `curl localhost:3005/health` | {"status":"healthy"} |

---

## Rollback Plan

If fixes cause service degradation:

```bash
# Restore workflow-worker to previous state
pm2 delete workflow-worker
cd /data/order-processing/app/services/workflow-worker
pm2 start ecosystem.config.cjs --only workflow-worker

# Cosmos DB containers are additive - no rollback needed
# Database creation is safe - doesn't affect existing data
```

---

## Start Execution

**Begin by:**

1. Initialize TodoWrite with phases 0-3
2. Execute Phase 0 directly (setup)
3. Launch Phase 1 agents IN PARALLEL (3 concurrent)
4. Wait for Phase 1 completion
5. Launch Phase 2 validation agent
6. Execute Phase 3 report generation

**Do not ask for confirmation - start immediately.**

---

*Prompt created: 2025-12-30*
*Fixes identified from: TEST_EXECUTION_REPORT.md*
