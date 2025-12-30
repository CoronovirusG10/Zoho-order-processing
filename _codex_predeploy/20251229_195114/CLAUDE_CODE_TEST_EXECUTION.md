# Claude Code Prompt: Post-Fix Test Execution

**Run ID:** 20251229_TEST_EXEC
**Created:** 2025-12-29
**Prerequisite:** CLAUDE_CODE_DEVOPS_TEMPORAL_FIX.md completed successfully
**Test Suite:** ORDER_PROCESSING_TEST_SUITE_v2.md (Multi-Model Validated)

---

## CTO Orchestration Instructions

You are a CTO orchestrator. Delegate test execution to Task agents with `claude-opus-4-5` (ultrathink mode).

### Execution Rules

| Rule | Requirement |
|------|-------------|
| Model | `claude-opus-4-5` for all Task agents |
| Parallel Limit | Max 3 concurrent test agents |
| Logging | Write all outputs to `${OUTPUT_DIR}/test_results/` |
| Tasks spawning Tasks | FORBIDDEN |

---

## Context

This prompt executes the multi-model validated test suite after the Temporal infrastructure fix has been applied. The test suite was validated by:

- GPT-5.2 (8/10 confidence)
- Gemini-3-Pro (9/10 confidence)
- DeepSeek-V3.2 (8/10 confidence)

Key improvements from validation:
1. Uses `temporal task-queue describe` instead of log scraping
2. Checks specific containers individually
3. Tests port 8088 for Temporal UI
4. Uses `pm2 jlist | jq` for robust parsing
5. Validates workflow response structure
6. Tests Cosmos DB containers (not just databases)

---

## Pre-Execution Verification

**Delegate to Task Agent:**

```
Instructions:
"Verify test execution prerequisites.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/test_results/

Execute:

1. Verify Temporal fix was applied:
   docker exec temporal-server nslookup postgresql
   docker inspect temporal-server --format '{{.State.Health.Status}}'

2. Verify test suite exists:
   ls -la /data/order-processing/_codex_predeploy/20251229_195114/ORDER_PROCESSING_TEST_SUITE_v2.md

3. Create test results directory:
   mkdir -p /data/order-processing/_codex_predeploy/20251229_195114/test_results/

4. Verify required tools:
   which jq nc curl openssl az docker pm2

5. Verify Azure authentication:
   az account show --query 'name' -o tsv

Write verification results to: 00_PRE_EXECUTION_CHECK.md

Return: Prerequisites status (PASS/FAIL)"
```

---

## Phase 1: Infrastructure Tests

**Delegate to Task Agent:**

```
Instructions:
"Execute infrastructure tests from the v2 test suite.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/test_results/

Execute infrastructure tests:

### Container Health (specific containers)
for container in temporal-postgresql temporal-server temporal-ui; do
  echo "=== $container ==="
  STATUS=$(docker inspect $container --format '{{.State.Status}}' 2>/dev/null || echo 'not_found')
  HEALTH=$(docker inspect $container --format '{{.State.Health.Status}}' 2>/dev/null || echo 'no-healthcheck')
  echo "Status: $STATUS, Health: $HEALTH"
done

### Docker DNS Resolution
docker exec temporal-server nslookup postgresql

### Docker TCP Connectivity
docker exec temporal-server nc -zv postgresql 5432

### Port Availability (including 8088)
for port in 3005 3978 7233 8088; do
  nc -zv localhost $port 2>&1
done

### PM2 Status (using jlist)
pm2 jlist | jq '.[] | {name, status: .pm2_env.status, restarts: .pm2_env.restart_time}'

Write results to: 01_INFRASTRUCTURE_TESTS.md

Return: Test results with pass/fail counts"
```

---

## Phase 2: Temporal Tests

**Delegate to Task Agent:**

```
Instructions:
"Execute Temporal-specific tests from the v2 test suite.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/test_results/

Execute Temporal tests:

### Server Health
docker inspect temporal-server --format '{{.State.Health.Status}}'

### Namespace Registration
docker exec temporal-server temporal operator namespace describe order-processing

### Worker Registration (using Temporal CLI - critical improvement)
docker exec temporal-server temporal task-queue describe \
  --task-queue order-processing \
  --namespace order-processing

### Temporal UI Accessibility
curl -s -o /dev/null -w '%{http_code}' http://localhost:8088

Write results to: 02_TEMPORAL_TESTS.md

Return: Temporal status with worker verification"
```

---

## Phase 3: Service & Integration Tests

**Delegate to Task Agent:**

```
Instructions:
"Execute service and Azure integration tests from the v2 test suite.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/test_results/

Execute service tests:

### Workflow API Health (validate JSON)
RESPONSE=$(curl -s http://localhost:3005/health)
echo "Response: $RESPONSE"
echo "$RESPONSE" | jq '.'

### Teams Bot
curl -s -o /dev/null -w '%{http_code}' http://localhost:3978/

### External HTTPS
curl -s -o /dev/null -w '%{http_code}' https://processing.pippaoflondon.co.uk/api/messages

### SSL Certificate
echo | openssl s_client -servername processing.pippaoflondon.co.uk \
  -connect processing.pippaoflondon.co.uk:443 2>/dev/null | \
  openssl x509 -noout -dates

Execute Azure tests:

### MI Authentication
az account show --query '{name:name, id:id}' -o json

### Key Vault Access
az keyvault secret list --vault-name pippai-keyvault-dev --query 'length(@)'

### Cosmos DB Containers (not just databases)
az cosmosdb sql container list \
  --account-name cosmos-visionarylab \
  --resource-group pippai-rg \
  --database-name order-processing \
  --query '[].name' -o tsv

### Blob Storage
az storage container show \
  --account-name pippaistoragedev \
  --name orders-incoming \
  --auth-mode login \
  --query 'name'

Write results to: 03_SERVICE_INTEGRATION_TESTS.md

Return: Service health status"
```

---

## Phase 4: End-to-End Tests

**Delegate to Task Agent:**

```
Instructions:
"Execute end-to-end tests from the v2 test suite.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/test_results/

Execute E2E tests:

### Workflow Trigger (validate response structure)
RESPONSE=$(curl -s -X POST http://localhost:3005/api/workflows/test \
  -H 'Content-Type: application/json' \
  -d '{"test": true}')
echo "Response: $RESPONSE"
# Check for workflowId
echo "$RESPONSE" | jq '.workflowId'

### Bot Message Processing
curl -s -X POST http://localhost:3978/api/messages \
  -H 'Content-Type: application/json' \
  -d '{"type": "message", "text": "test"}'

Write results to: 04_E2E_TESTS.md

Return: E2E test results"
```

---

## Phase 5: Generate Test Report

**Direct Execution (CTO):**

After all phases complete, aggregate results:

```bash
OUTPUT_DIR=/data/order-processing/_codex_predeploy/20251229_195114/test_results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cat > ${OUTPUT_DIR}/TEST_EXECUTION_REPORT.md << EOF
# Test Execution Report

**Run ID:** 20251229_TEST_EXEC
**Executed:** $(date -Iseconds)
**Test Suite:** v2.0 (Multi-Model Validated)

## Phase Results

| Phase | Report | Status |
|-------|--------|--------|
| Pre-Execution | 00_PRE_EXECUTION_CHECK.md | ${PHASE0_STATUS} |
| Infrastructure | 01_INFRASTRUCTURE_TESTS.md | ${PHASE1_STATUS} |
| Temporal | 02_TEMPORAL_TESTS.md | ${PHASE2_STATUS} |
| Services | 03_SERVICE_INTEGRATION_TESTS.md | ${PHASE3_STATUS} |
| E2E | 04_E2E_TESTS.md | ${PHASE4_STATUS} |

## Summary

- Total Tests: ${TOTAL_TESTS}
- Passed: ${PASSED_TESTS}
- Failed: ${FAILED_TESTS}
- Pass Rate: ${PASS_RATE}%

## Validation

This test suite was validated by:
- GPT-5.2 (8/10 confidence)
- Gemini-3-Pro (9/10 confidence)
- DeepSeek-V3.2 (8/10 confidence)

## Next Steps

If all tests pass:
1. Proceed with Teams app deployment (CLAUDE_CODE_PIPPA_TENANT_ADMIN.md)
2. Monitor first user interactions

If any tests fail:
1. Review specific phase report
2. Re-run Temporal fix if needed
3. Check PM2 logs for errors
EOF

echo "Test execution complete. Report: ${OUTPUT_DIR}/TEST_EXECUTION_REPORT.md"
```

---

## Logging Requirements

All Task agents must:

1. **Write timestamped outputs:**
   ```
   [2025-12-29T23:00:00Z] Test: Container Health
   [2025-12-29T23:00:01Z] Result: PASS - temporal-server healthy
   ```

2. **Create structured logs:**
   ```
   ${OUTPUT_DIR}/${PHASE}_COMMANDS.log
   ${OUTPUT_DIR}/${PHASE}_OUTPUT.log
   ```

3. **Use exit codes:**
   - 0 = All tests passed
   - 1+ = Number of failed tests

---

## Start Execution

**Begin by:**

1. Initialize TodoWrite with all 5 phases
2. Delegate Phase 0 (Pre-Execution Verification)
3. If Phase 0 passes, execute Phases 1-4 in sequence
4. Generate final report

**Do not ask for confirmation - start immediately.**

---

## Critical Success Criteria

| Test | Must Pass |
|------|-----------|
| Docker DNS Resolution | YES |
| Temporal Server Health | YES |
| Worker Registration | YES |
| Workflow API Health | YES |
| Teams Bot Response | YES |
| External HTTPS | YES |
| Azure MI Auth | YES |
| Key Vault Access | YES |

If any critical test fails, STOP and investigate before proceeding.
