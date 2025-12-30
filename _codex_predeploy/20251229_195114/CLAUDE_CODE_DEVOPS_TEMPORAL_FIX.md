# Claude Code DevOps Prompt: Temporal Infrastructure Fix

**Run ID:** 20251229_TEMPORAL_FIX
**Created:** 2025-12-29
**Priority:** CRITICAL
**Estimated Time:** 2-4 hours

---

## CTO Orchestration Instructions

You are a CTO orchestrator. Delegate execution to Task agents with `claude-opus-4-5` (ultrathink mode).

### Execution Rules

| Rule | Requirement |
|------|-------------|
| Model | `claude-opus-4-5` for all Task agents |
| Parallel Limit | Max 5 concurrent agents |
| Logging | Write all outputs to `${OUTPUT_DIR}` |
| Tasks spawning Tasks | FORBIDDEN |

---

## Context

The Order Processing system is 80% deployed. The critical blocker is **Temporal Docker DNS resolution failure**.

### Current State

| Component | Status | Issue |
|-----------|--------|-------|
| temporal-postgresql | HEALTHY | Running on port 5432 |
| temporal-server | UNHEALTHY | Cannot resolve `postgresql` hostname |
| temporal-ui | BLOCKED | Port 8080 conflict with pippai-help |
| workflow-api | PARTIAL | Online but cannot reach Temporal |
| workflow-worker | ERRORED | Cannot connect to Temporal server |

### Production Domain

- **URL:** `https://processing.pippaoflondon.co.uk`
- **SSL:** Valid and operational
- **Bot Endpoint:** `https://processing.pippaoflondon.co.uk/api/messages`

---

## Phase 1: Diagnostic Analysis

**Delegate to Task Agent:**

```
Instructions:
"Diagnose Temporal Docker infrastructure issues.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Execute diagnostic commands:

1. Docker Network Analysis:
   docker network ls
   docker network inspect $(docker network ls -q --filter name=temporal)
   docker inspect temporal-server --format '{{json .NetworkSettings.Networks}}'
   docker inspect temporal-postgresql --format '{{json .NetworkSettings.Networks}}'

2. DNS Resolution Test:
   docker exec temporal-server nslookup postgresql
   docker exec temporal-server cat /etc/resolv.conf
   docker exec temporal-server ping -c 3 postgresql || echo 'ping failed'

3. Container Connectivity:
   docker exec temporal-server nc -zv postgresql 5432 || echo 'connection failed'
   docker logs temporal-server --tail 100

4. Docker Compose Configuration:
   cat /data/order-processing/app/infra/temporal/docker-compose.yml

5. Port Conflict Analysis:
   sudo lsof -i :8080
   docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep 8080

Write findings to: 01_DIAGNOSTIC_ANALYSIS.md

Return: Root cause identification and recommended fix approach"
```

---

## Phase 2: Fix Temporal Docker DNS

**Delegate to Task Agent (after Phase 1):**

```
Instructions:
"Fix Temporal Docker DNS resolution issue.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Based on diagnostic findings, implement fix:

OPTION A - If containers are on different networks:
1. Stop Temporal stack:
   cd /data/order-processing/app/infra/temporal
   docker compose down

2. Edit docker-compose.yml to ensure all containers use same network:
   - Add explicit network configuration
   - Ensure 'postgresql' service has network alias
   - Add 'depends_on' with health check

3. Restart stack:
   docker compose up -d

OPTION B - If DNS resolver issue:
1. Add explicit 'dns' configuration to docker-compose.yml
2. Or add 'links' directive for backward compatibility
3. Or use explicit IP in POSTGRES_HOST environment variable

OPTION C - If container name mismatch:
1. Verify service name matches what temporal-server expects
2. Update POSTGRES_HOST env var if needed

After fix:
1. Wait 30 seconds for services to stabilize
2. Verify: docker exec temporal-server nc -zv postgresql 5432
3. Check health: docker inspect temporal-server --format '{{.State.Health.Status}}'

Write changes to: 02_DNS_FIX_APPLIED.md

Return: Fix applied, verification results"
```

---

## Phase 3: Resolve Port 8080 Conflict

**Delegate to Task Agent (parallel with Phase 2 if independent):**

```
Instructions:
"Resolve port 8080 conflict between Temporal UI and pippai-help.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Execute:

1. Identify conflicting container:
   docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep 8080

2. Determine which service to relocate:
   - If pippai-help is less critical: stop it temporarily
   - If Temporal UI can use different port: modify docker-compose.yml

3. Recommended approach - Move Temporal UI to port 8088:
   Edit docker-compose.yml:
   temporal-ui:
     ports:
       - '8088:8080'

4. Apply change:
   cd /data/order-processing/app/infra/temporal
   docker compose up -d temporal-ui

5. Verify:
   curl -s http://localhost:8088 | head -20

6. Update nginx if external access needed:
   - Add location block for /temporal-ui proxying to 8088

Write changes to: 03_PORT_CONFLICT_RESOLVED.md

Return: Port conflict resolution status"
```

---

## Phase 4: Register Temporal Namespace

**Delegate to Task Agent (after Phase 2 succeeds):**

```
Instructions:
"Register Temporal namespace for order processing.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Prerequisites:
- temporal-server must be healthy

Execute:

1. Verify Temporal server is healthy:
   docker inspect temporal-server --format '{{.State.Health.Status}}'
   # Must return 'healthy'

2. Check existing namespaces:
   docker exec temporal-server temporal operator namespace list

3. Register order-processing namespace:
   docker exec temporal-server temporal operator namespace create \
     --namespace order-processing \
     --description 'Order Processing Workflows' \
     --retention 30d

4. Verify registration:
   docker exec temporal-server temporal operator namespace describe order-processing

5. Test namespace accessibility from workflow-api:
   curl -s http://localhost:3005/health

Write results to: 04_NAMESPACE_REGISTERED.md

Return: Namespace registration status"
```

---

## Phase 5: Restart Workflow Services

**Delegate to Task Agent (after Phase 4):**

```
Instructions:
"Restart workflow services and verify connectivity.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Execute:

1. Restart workflow-api:
   pm2 restart workflow-api
   sleep 5
   pm2 show workflow-api

2. Restart workflow-worker:
   pm2 restart workflow-worker
   sleep 5
   pm2 show workflow-worker

3. Verify connectivity:
   curl -s http://localhost:3005/health | jq
   pm2 logs workflow-worker --lines 20

4. Check Temporal connection:
   curl -s http://localhost:3005/api/temporal/status || echo 'endpoint may not exist'

5. Full PM2 status:
   pm2 status
   pm2 save

Write results to: 05_WORKFLOW_SERVICES_RESTARTED.md

Return: All services status and health"
```

---

## Phase 6: Comprehensive System Test

**Delegate to Task Agent (after Phase 5):**

```
Instructions:
"Run comprehensive system test suite.

Working directory: /data/order-processing
Output directory: /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

Execute test suite:

### Infrastructure Tests
1. Docker health:
   for c in temporal-postgresql temporal-server temporal-ui; do
     echo "$c: $(docker inspect $c --format '{{.State.Health.Status}}' 2>/dev/null || echo 'no-healthcheck')"
   done

2. PM2 services:
   pm2 jlist | jq '.[] | {name, status: .pm2_env.status, restarts: .pm2_env.restart_time}'

3. Port availability:
   for port in 3005 3978 5432 7233 8088; do
     nc -zv localhost $port 2>&1 | grep -q 'succeeded' && echo "Port $port: OK" || echo "Port $port: FAILED"
   done

### Temporal Tests
4. Temporal server connectivity:
   docker exec temporal-server temporal operator namespace list

5. Namespace exists:
   docker exec temporal-server temporal operator namespace describe order-processing

6. Worker registration (check logs):
   pm2 logs workflow-worker --lines 50 | grep -i 'registered\|connected\|started'

### API Tests
7. Workflow API health:
   curl -s http://localhost:3005/health | jq

8. Teams Bot health:
   curl -s http://localhost:3978/api/health || curl -s http://localhost:3978/

### External Endpoint Tests
9. Production domain:
   curl -s -o /dev/null -w '%{http_code}' https://processing.pippaoflondon.co.uk/api/messages

### Azure Connectivity Tests
10. Managed Identity:
    az account show --query '{name:name, id:id}' -o json

11. Key Vault access:
    az keyvault secret list --vault-name pippai-keyvault-dev --query 'length(@)'

12. Cosmos DB:
    az cosmosdb sql database list --account-name cosmos-visionarylab --resource-group pippai-rg --query '[].name' -o json

Write comprehensive results to: 06_SYSTEM_TEST_RESULTS.md

Format as:
| Test | Status | Details |
|------|--------|---------|

Return: Test summary with pass/fail counts"
```

---

## Phase 7: Generate Test Report

**Direct Execution (CTO):**

After all phases complete, aggregate results:

```bash
OUTPUT_DIR=/data/order-processing/_codex_predeploy/20251229_195114/temporal_fix

cat > ${OUTPUT_DIR}/TEMPORAL_FIX_FINAL_REPORT.md << 'EOF'
# Temporal Infrastructure Fix Report

**Run ID:** 20251229_TEMPORAL_FIX
**Completed:** $(date -Iseconds)

## Summary

| Phase | Status | Report |
|-------|--------|--------|
| 1. Diagnostic Analysis | ${PHASE1_STATUS} | 01_DIAGNOSTIC_ANALYSIS.md |
| 2. DNS Fix | ${PHASE2_STATUS} | 02_DNS_FIX_APPLIED.md |
| 3. Port Conflict | ${PHASE3_STATUS} | 03_PORT_CONFLICT_RESOLVED.md |
| 4. Namespace | ${PHASE4_STATUS} | 04_NAMESPACE_REGISTERED.md |
| 5. Services Restart | ${PHASE5_STATUS} | 05_WORKFLOW_SERVICES_RESTARTED.md |
| 6. System Test | ${PHASE6_STATUS} | 06_SYSTEM_TEST_RESULTS.md |

## Critical Checks

- [ ] temporal-server healthy
- [ ] temporal-postgresql healthy
- [ ] order-processing namespace registered
- [ ] workflow-worker connected
- [ ] workflow-api healthy
- [ ] External endpoint responding

## Next Steps

If all checks pass:
1. Proceed with Teams app upload
2. Run end-to-end bot test

If any checks fail:
1. Review specific phase report
2. Re-run failed phase
3. Escalate if persistent
EOF
```

---

## Logging Requirements

All Task agents must:

1. **Write timestamped logs:**
   ```
   [2025-12-29T22:15:00Z] Phase 2: Starting DNS fix
   [2025-12-29T22:15:05Z] Phase 2: Stopped Temporal stack
   [2025-12-29T22:15:10Z] Phase 2: Modified docker-compose.yml
   ```

2. **Create command logs:**
   ```
   ${OUTPUT_DIR}/${PHASE}_COMMANDS.log
   ```

3. **Capture all command outputs:**
   ```
   ${OUTPUT_DIR}/${PHASE}_OUTPUT.log
   ```

---

## Start Execution

**Begin by:**

1. Create output directory:
   ```bash
   mkdir -p /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix
   ```

2. Initialize TodoWrite with all 7 phases

3. Delegate Phase 1 to first Task agent

4. Update daily log at `/data/order-processing/docs/claude-logs/daily/2025-12-29.md`

**Do not ask for confirmation - start immediately.**
