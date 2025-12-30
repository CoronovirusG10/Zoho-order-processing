# System Test Suite Results

**Generated:** 2025-12-29T23:16:46Z
**Working Directory:** /data/order-processing
**Output Directory:** /data/order-processing/_codex_predeploy/20251229_195114/temporal_fix/

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | 13 |
| **Passed** | 12 |
| **Warnings** | 1 |
| **Failed** | 0 |
| **Pass Rate** | 92.3% |

---

## Test Results

| # | Test | Status | Details |
|---|------|--------|---------|
| 1 | Docker Health | PASS | temporal-postgresql: healthy, temporal-server: healthy, temporal-ui: running (no healthcheck) |
| 2 | PM2 Services | PASS | workflow-api: online (1 restart), workflow-worker: online (15 restarts), teams-bot: online (0 restarts) |
| 3 | Port Availability | PASS | All ports available: 3005, 3978, 5432, 7233, 8088 |
| 4 | Temporal Server Connectivity | PASS | 3 namespaces listed: order-processing, temporal-system, default |
| 5 | Namespace Exists | PASS | order-processing namespace registered, 720h retention |
| 6 | Worker Registration | WARN | Task queue exists but no active pollers detected - workers may not be polling |
| 7 | Workflow API Health | PASS | status: healthy, temporal: connected |
| 8 | Teams Bot Health | PASS | Bot running on port 3978, uptime 114m, no /api/health endpoint (expected) |
| 9 | Production Domain | PASS | HTTP 404 for GET /api/messages (expected - POST endpoint only) |
| 10 | SSL Certificate | PASS | Valid: Dec 29 2025 - Mar 29 2026, CN=processing.pippaoflondon.co.uk |
| 11 | Azure Managed Identity | PASS | Connected: Azure subscription 1 (5bc1c173-058c-4d81-bed4-5610679d339f) |
| 12 | Key Vault Access | PASS | 92 secrets accessible in pippai-keyvault-dev |
| 13 | Cosmos DB | PASS | Database 'visionarylab' found in cosmos-visionarylab account |

---

## Detailed Results

### Infrastructure Tests

#### Test 1: Docker Health
**Status:** PASS

| Container | Health Status |
|-----------|---------------|
| temporal-postgresql | healthy |
| temporal-server | healthy |
| temporal-ui | running (no healthcheck configured) |

#### Test 2: PM2 Services
**Status:** PASS

| Service | Status | Restarts |
|---------|--------|----------|
| workflow-api | online | 1 |
| workflow-worker | online | 15 |
| teams-bot | online | 0 |

**Note:** workflow-worker has 15 restarts - monitor for instability.

#### Test 3: Port Availability
**Status:** PASS

| Port | Service | Status |
|------|---------|--------|
| 3005 | Workflow API | OK |
| 3978 | Teams Bot | OK |
| 5432 | PostgreSQL | OK |
| 7233 | Temporal gRPC | OK |
| 8088 | Temporal UI | OK |

---

### Temporal Tests

#### Test 4: Temporal Server Connectivity
**Status:** PASS

Successfully connected to Temporal server. Namespaces found:
- `order-processing` - Order Processing Workflows (720h retention)
- `temporal-system` - Temporal internal system namespace
- `default` - Default namespace

#### Test 5: Namespace Exists
**Status:** PASS

```
Namespace: order-processing
ID: 07e67b6d-980c-441e-8351-00304a5ff5e3
Description: Order Processing Workflows
State: Registered
Retention: 720h (30 days)
Cluster: active
```

#### Test 6: Worker Registration
**Status:** WARNING

Task queue `order-processing` exists with no backlog, but **no active pollers** were detected.

| BuildID | TaskQueueType | BacklogCount | TasksAddRate |
|---------|---------------|--------------|--------------|
| UNVERSIONED | activity | 0 | 0 |
| UNVERSIONED | workflow | 0 | 0 |

**Investigation needed:** Workers may not be actively polling. Check workflow-worker logs.

---

### API Tests

#### Test 7: Workflow API Health
**Status:** PASS

```json
{
  "status": "healthy",
  "temporal": "connected",
  "timestamp": "2025-12-29T23:16:51.676Z"
}
```

#### Test 8: Teams Bot Health
**Status:** PASS

The Teams Bot does not expose an `/api/health` endpoint (returns 404), which is expected behavior for the Bot Framework SDK.

**Process verification:**
- PM2 Status: online
- Uptime: 114 minutes
- Restarts: 0
- Listening on: `*:3978`

---

### External Endpoint Tests

#### Test 9: Production Domain
**Status:** PASS

```
URL: https://processing.pippaoflondon.co.uk/api/messages
HTTP Status: 404
```

**Note:** 404 is expected for a GET request. The `/api/messages` endpoint only accepts POST requests from Microsoft Teams.

#### Test 10: SSL Certificate
**Status:** PASS

```
Subject: CN = processing.pippaoflondon.co.uk
Valid From: Dec 29 20:13:45 2025 GMT
Valid Until: Mar 29 20:13:44 2026 GMT
Domain IP: 135.225.31.54
```

Certificate is valid for approximately 90 days.

---

### Azure Connectivity Tests

#### Test 11: Managed Identity
**Status:** PASS

```json
{
  "name": "Azure subscription 1",
  "id": "5bc1c173-058c-4d81-bed4-5610679d339f"
}
```

#### Test 12: Key Vault Access
**Status:** PASS

Successfully accessed Key Vault `pippai-keyvault-dev`.

| Metric | Value |
|--------|-------|
| Secrets accessible | 92 |

#### Test 13: Cosmos DB
**Status:** PASS

```json
["visionarylab"]
```

Database `visionarylab` exists in Cosmos account `cosmos-visionarylab`.

---

## Warnings & Recommendations

### Warning: No Active Pollers on Task Queue

**Issue:** Test 6 shows no active pollers on the `order-processing` task queue.

**Impact:** Workflows may not be processed if workers are not polling.

**Recommended Actions:**
1. Check workflow-worker logs: `pm2 logs workflow-worker --lines 50`
2. Verify worker is connecting to the correct namespace
3. Restart worker if necessary: `pm2 restart workflow-worker`

### Note: workflow-worker Restarts

The workflow-worker service has restarted 15 times. This may indicate:
- Transient Temporal connection issues (resolved)
- Memory pressure
- Application errors

Review logs to determine root cause.

---

## Command Log

Full command outputs available in: `06_SYSTEM_COMMANDS.log`

---

## Test Execution Timestamp

- **Start:** 2025-12-29T23:16:46Z
- **End:** 2025-12-29T23:17:00Z
- **Duration:** ~14 seconds
