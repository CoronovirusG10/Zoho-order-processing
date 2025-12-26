# VM-Only Migration Research Synthesis

**Generated:** 2025-12-26
**Phase:** 1.2 Research Synthesis
**Agents:** 10 parallel research agents completed

---

## Executive Summary

Research across 10 parallel agents confirms that **migration from Azure Functions to VM-only architecture is technically feasible** but comes with significant **cost implications** (+$340/mo). The existing pippai-vm has ample capacity (31GB RAM free, Docker 29.0.2 ready) to host all Order Processing services.

### Key Findings

| Area | Assessment | Risk Level |
|------|------------|------------|
| VM Capacity | ✅ Ample resources (E8s_v5, 64GB RAM) | Low |
| Temporal.io | ✅ Self-hosted viable with PostgreSQL 12+ | Medium |
| Workflow Migration | ⚠️ CaseEntity conversion is complex | Medium-High |
| Infrastructure | ✅ Bicep modules can be adapted | Low |
| Documentation | ⚠️ 26 files require updates | Medium |
| Cost | ❌ +$340/mo over Functions/Container Apps | High |
| Security | ✅ Clear migration path with 23 checkpoints | Low |
| Deployment | ✅ PM2 + GitHub Actions recommended | Low |
| Monitoring | ✅ AMA + App Insights + Prometheus viable | Low |
| Data Layer | ✅ All Cosmos/Storage reusable as-is | Low |

---

## 1. Temporal.io Self-Hosted Requirements

### PostgreSQL Database
- **Minimum Version:** PostgreSQL 12+ (required for Advanced Visibility)
- **Sizing:** 4 vCores, 8GB+ RAM recommended
- **Azure Option:** PostgreSQL Flexible Server ($260/mo for General Purpose)
- **Ports:** 5432 (PostgreSQL)

### Temporal Server
- **Deployment:** Docker Compose with `temporalio/server` image
- **Services:** Frontend, History, Matching, Worker (4 containers)
- **Ports:** 7233 (gRPC), 8080 (Web UI)
- **Storage:** Premium SSD recommended for database volume

### Node.js Workers
- **Version:** Node.js 18+ required
- **Limitation:** Alpine Linux NOT supported (musl incompatible)
- **Packages:** `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`

---

## 2. pippai-vm Readiness Assessment

### Hardware Specifications
| Resource | Value | Status |
|----------|-------|--------|
| VM Size | Standard_E8s_v5 | ✅ Memory-optimized |
| vCPUs | 8 cores | ✅ Ample |
| RAM | 64 GB (31 GB free) | ✅ Significant headroom |
| OS Disk | 256 GB (77 GB free) | ⚠️ 30% free - monitor growth |
| Location | Sweden Central | ✅ Low-latency EU |

### Existing Infrastructure
| Component | Version | Status |
|-----------|---------|--------|
| Docker | 29.0.2 | ✅ Production-ready |
| nginx | 1.28.0 | ✅ Active, healthy |
| Prometheus/Grafana | Running | ✅ Built-in observability |
| Redis | Running | ✅ Available for caching |

### Current Services (23 containers)
VM currently runs: librechat, chatwoot, pippa-integrations, visionlab, mongodb, redis, and monitoring stack. **31GB RAM available** for Order Processing services.

**Verdict:** VM is **READY** for Order Processing deployment.

---

## 3. Workflow Service Feature Migration Map

### Orchestration Patterns

| Durable Functions Pattern | Temporal Equivalent | Complexity |
|---------------------------|---------------------|------------|
| Orchestrator Handler | Temporal Workflow class | Simple |
| callActivityWithRetry | proxyActivities() + RetryPolicy | Medium |
| waitForExternalEvent | WorkflowSignal + condition | Medium |
| continueAsNew | ContinueAsNewOptions | Simple |
| isReplaying | Built-in replay detection | Simple |

### Activities (10 files)
1. store-file.ts → @activity decorator
2. parse-excel.ts → @activity decorator
3. run-committee.ts → @activity decorator
4. resolve-customer.ts → @activity decorator
5. resolve-items.ts → @activity decorator
6. apply-corrections.ts → @activity decorator
7. apply-selections.ts → @activity decorator
8. create-zoho-draft.ts → @activity decorator
9. notify-user.ts → @activity decorator
10. update-case.ts → @activity decorator

### Critical Migration Challenge: CaseEntity

The Durable Entity pattern (`case-entity.ts`) with 11 operations is the **most complex** migration item. Options:
- **Option A (Recommended):** External service with Cosmos DB
- **Option B:** Inline workflow state variables
- **Option C:** Activities for state reads/writes

### Triggers to Convert (4 files)
- HTTP triggers → Express.js routes
- Queue trigger → Queue polling + client.signalWorkflow()

**Estimated Migration Effort:** 3-4 weeks including testing.

---

## 4. Bicep Module Change Matrix

| Module | Action | Changes Needed |
|--------|--------|----------------|
| loganalytics.bicep | KEEP | No changes |
| appinsights.bicep | KEEP | No changes |
| keyvault.bicep | KEEP | No changes |
| storage.bicep | KEEP | No changes |
| cosmos.bicep | KEEP | No changes |
| vnet.bicep | MODIFY | Add VM subnet (10.0.4.0/24) |
| functionapp.bicep | DELETE | Remove completely |
| containerapp.bicep | DELETE/KEEP | Optional for bot runtime |
| bot.bicep | MODIFY | Update endpoint to VM |
| staticwebapp.bicep | KEEP | No changes |
| rbac.bicep | MODIFY | Replace Function principals with VM MI |
| secrets.bicep | KEEP | No changes |
| aifoundry.bicep | KEEP | No changes |
| **vm.bicep** | CREATE | New module for VM deployment |
| **loadbalancer.bicep** | CREATE | New module for traffic routing |

### Modification Order
1. Create vnet.bicep modifications (add VM subnet)
2. Create vm.bicep and loadbalancer.bicep modules
3. Deploy VMs with managed identity
4. Update rbac.bicep with VM principal IDs
5. Update bot.bicep endpoint
6. Remove functionapp.bicep references

---

## 5. Documentation Inventory

### Priority 1 - Critical (11 files)
| File | Change Scope |
|------|--------------|
| README.md | Major rewrite |
| app/docs/architecture/overview.md | Major rewrite |
| app/docs/architecture/data-flow.md | Major rewrite |
| app/infra/INFRASTRUCTURE_OVERVIEW.md | Major rewrite |
| app/infra/README.md | Major rewrite |
| app/services/workflow/README.md | Major rewrite |
| app/services/workflow/DEPLOYMENT.md | Major rewrite |
| app/docs/setup/azure-deployment.md | Major rewrite |
| _predeploy/DEPLOYMENT_RUNBOOK.md | Major rewrite |
| _predeploy/PREDEPLOYMENT_READINESS_REPORT.md | Major rewrite |
| app/_build_logs/TWO_RG_DEPLOYMENT_PLAN_FINAL.md | Major rewrite |

### Priority 2 - High (12 files)
- Various service READMEs, architecture docs, deployment checklists

### New Documents to Create (4 files)
1. VM_DEPLOYMENT_GUIDE.md
2. TEMPORAL_OPERATIONS.md
3. PM2_CONFIGURATION.md
4. NGINX_CONFIGURATION.md

**Total Files:** 26 documentation updates required.

---

## 6. Cost Comparison

### Monthly Cost Analysis

| Resource | VM-Only | Functions/Container Apps | Difference |
|----------|---------|--------------------------|------------|
| Compute | $140 (D4s_v5) | $70 (Functions + Container Apps) | +$70 |
| PostgreSQL (Temporal) | $260 | $0 (Durable Functions) | +$260 |
| Cosmos DB | $25 | $25 | $0 |
| Storage | $10 | $10 | $0 |
| Networking | $20 | $10 | +$10 |
| **Total** | **$455/mo** | **$115/mo** | **+$340/mo** |

### Annual Impact
- **Additional Cost:** $4,080/year
- **3-Year Cost:** $12,240

### When VM-Only Makes Sense
- Very high sustained workloads (>1M orders/month)
- Strict latency requirements (<100ms cold start)
- Existing Temporal expertise
- Complex long-running workflows beyond Durable Functions

---

## 7. Security Change Checklist (23 Checkpoints)

### RBAC Changes
- [ ] Create VM System-Assigned Managed Identity
- [ ] Cosmos DB Data Contributor role
- [ ] Storage Blob Data Contributor role
- [ ] Storage Queue Data Contributor role
- [ ] Key Vault Secrets User role
- [ ] Remove obsolete Function App assignments

### Network Security
- [ ] Create VM subnet (10.0.4.0/24)
- [ ] NSG rules: HTTPS (443), HTTP (80), SSH (22 restricted)
- [ ] Service endpoints for Azure services
- [ ] Private endpoints for production

### SSL/TLS
- [ ] Let's Encrypt via Certbot
- [ ] nginx HTTPS configuration
- [ ] Certificate renewal automation

### Key Vault
- [ ] Managed Identity access (no shared keys)
- [ ] Secret retrieval at startup
- [ ] Rotation policies

---

## 8. Deployment Strategy Recommendation

### Process Management: PM2

| Feature | PM2 Advantage |
|---------|---------------|
| Cluster mode | Built-in, auto-scaling |
| Zero-downtime | `pm2 reload` with cluster mode |
| Monitoring | Built-in dashboard |
| Environment | `--update-env` on reload |

### CI/CD: GitHub Actions
- SSH-based deployment via `easingthemes/ssh-deploy`
- Free tier sufficient for most workloads
- Tighter GitHub integration

### Deployment Flow
```bash
1. git pull origin main
2. npm ci --production
3. docker compose up -d --wait (Temporal)
4. pm2 reload ecosystem.config.js
5. pm2 wait-ready order-worker
6. curl /health (verify)
```

### Rollback Strategy
- Keep previous deployment in `/opt/order-processing.prev`
- On failure: `pm2 restart --env previous`

---

## 9. Monitoring Strategy

### Azure Monitor Agent (AMA)
- Install via `az vm extension set --name AzureMonitorLinuxAgent`
- Collect: Performance counters, syslog, custom logs
- Data Collection Rules (DCR) for configuration

### Application Insights
- Use `@azure/monitor-opentelemetry` SDK
- Connection string (not instrumentation key)
- Track requests, dependencies, exceptions

### Temporal Monitoring
- Built-in Web UI at port 8080
- Prometheus metrics at port 9090
- Grafana dashboards (community templates available)

### Log Analytics Alerts
- VM heartbeat/availability
- High CPU (>85% for 10 min)
- Application errors (critical syslog)
- Workflow failures

---

## 10. Data Layer Assessment

### Cosmos DB (6 containers - all reusable)
| Container | Partition Key | Reusable |
|-----------|---------------|----------|
| cases | /tenantId | ✅ Yes |
| fingerprints | /fingerprint | ✅ Yes |
| events | /caseId | ✅ Yes |
| agentThreads | /threadId | ✅ Yes |
| committeeVotes | /caseId | ✅ Yes |
| cache | /cacheKey | ✅ Yes |

### Storage Account (3 containers, 2 queues - all reusable)
| Resource | Purpose | Reusable |
|----------|---------|----------|
| orders-incoming | Raw Excel files | ✅ Yes |
| orders-audit | Immutable audit (WORM) | ✅ Yes |
| logs-archive | Diagnostic logs | ✅ Yes |
| case-processing queue | Workflow trigger | ✅ Yes |
| zoho-retry queue | Failed API retry | ✅ Yes |

### Access Pattern
- VM uses System-Assigned Managed Identity
- DefaultAzureCredential for authentication
- No connection strings needed
- Grant RBAC roles to VM identity

---

## Risks & Blockers

### High Risk
1. **Cost Premium:** +$340/mo ongoing expense needs business justification

### Medium Risk
2. **CaseEntity Migration:** Complex stateful actor pattern requires careful redesign
3. **Documentation Burden:** 26 files need updates

### Low Risk
4. **VM Capacity:** Ample resources available
5. **Security:** Clear migration path defined
6. **Data Layer:** Full compatibility confirmed

---

## Recommendations

### Proceed with Migration IF:
1. Business accepts +$340/mo cost premium
2. Temporal expertise available for operations
3. Cold start latency is a critical concern
4. Future workflow complexity anticipated

### Reconsider Migration IF:
1. Cost optimization is primary goal
2. Current Durable Functions meet requirements
3. Team unfamiliar with Temporal operations
4. Workload is variable/bursty (Functions scale-to-zero)

---

## Next Steps (Phase 2)

1. **Decision Point:** Confirm migration proceeds despite cost concerns
2. **Create VM_ONLY_ARCHITECTURE.md:** Detailed architecture document
3. **Zen Validation:** Multi-model review of architecture
4. **Proceed to Phase 3:** Code migration if consensus achieved

---

*Generated from 10 parallel research agents. Full agent outputs available on request.*
