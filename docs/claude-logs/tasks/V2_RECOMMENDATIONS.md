# V2 Recommendations: Order Processing System Improvements

**Date**: 2025-12-30
**System**: Pippa of London Order Processing
**Status**: Production Deployed (v1.0)
**Purpose**: Prioritized improvements based on architecture validation

---

## Executive Summary

The architecture validation confirmed Temporal.io as the optimal choice (8.67/10 consensus). This document outlines recommended improvements for v2, organized by priority and effort.

**Key Principle**: Focus on hardening and observability, not platform changes.

---

## Priority 1: Critical Hardening (Week 1)

### 1.1 Add Activity Heartbeats to `runCommittee`

**Problem**: The `runCommittee` activity has a 5-minute timeout but no heartbeat, risking false timeout failures during AI model calls.

**Solution**: Add heartbeat reporting every 30 seconds.

**File**: [run-committee.ts](app/services/workflow/src/activities/run-committee.ts)

```typescript
import { log, heartbeat } from '@temporalio/activity';

export async function runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  // Add heartbeat interval
  const heartbeatInterval = setInterval(() => {
    heartbeat(`Processing committee for case ${input.caseId}`);
  }, 30000); // 30 seconds

  try {
    const result = await engine.runCommittee(task);
    return result;
  } finally {
    clearInterval(heartbeatInterval);
  }
}
```

**Effort**: 2 hours
**Impact**: Prevents false timeouts, improves observability

---

### 1.2 Document Workflow Versioning Strategy

**Problem**: No documented strategy for deploying workflow changes while workflows are in-flight.

**Solution**: Create versioning guide using Temporal's patching API.

**Deliverable**: `docs/operations/WORKFLOW_VERSIONING.md`

**Content**:
1. When to use `patched()` vs `deprecatePatch()`
2. Example patterns for each workflow step
3. Rollback procedures
4. Testing checklist for version changes

**Effort**: 4 hours
**Impact**: Safe deployments without workflow corruption

---

## Priority 2: Operational Improvements (Week 2)

### 2.1 Externalize Timeout Configuration

**Problem**: Timeout values (24h/48h/7d) are hardcoded in workflow.

**Solution**: Move to environment configuration.

**File**: [types.ts](app/services/workflow/src/workflows/types.ts)

```typescript
export const TimeoutConfig = {
  REMINDER_HOURS: parseInt(process.env.TIMEOUT_REMINDER_HOURS || '24', 10),
  ESCALATION_HOURS: parseInt(process.env.TIMEOUT_ESCALATION_HOURS || '48', 10),
  MAX_WAIT_DAYS: parseInt(process.env.TIMEOUT_MAX_WAIT_DAYS || '7', 10),
};
```

**Effort**: 2 hours
**Impact**: Runtime tuning without code deployment

---

### 2.2 Add Structured Tracing (OpenTelemetry)

**Problem**: Limited visibility into workflow execution across activities.

**Solution**: Integrate OpenTelemetry tracing.

**Components**:
1. Install `@opentelemetry/sdk-node`
2. Configure exporter (Azure Monitor / Jaeger)
3. Add trace context propagation through activities
4. Create custom spans for business logic

**Effort**: 1 day
**Impact**: End-to-end request tracing, debugging improvement

---

### 2.3 Add Workflow Health Alerts

**Problem**: No alerting on stuck or failed workflows.

**Solution**: Configure alerts for:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Workflow pending > 4h | Warning | Notify team |
| Workflow pending > 24h | Critical | Page on-call |
| Activity failure rate > 5% | Warning | Investigate |
| Signal timeout rate > 10% | Warning | Review escalation |

**Integration**: Azure Monitor / Grafana

**Effort**: 4 hours
**Impact**: Proactive issue detection

---

## Priority 3: Future Planning (Month 1-2)

### 3.1 Create Operational Runbooks

**Problem**: No documented procedures for common operations.

**Deliverables**:

| Runbook | Content |
|---------|---------|
| `RUNBOOK_WORKFLOW_STUCK.md` | How to diagnose and unblock stuck workflows |
| `RUNBOOK_ACTIVITY_FAILURE.md` | Debugging activity failures |
| `RUNBOOK_TEMPORAL_RESTART.md` | Safe restart procedures |
| `RUNBOOK_ZOHO_SYNC.md` | Handling Zoho API failures |
| `RUNBOOK_AUDIT_RECOVERY.md` | Reconstructing audit trails |

**Effort**: 2 days
**Impact**: Reduced MTTR, enabled on-call rotation

---

### 3.2 Evaluate Temporal Cloud Migration

**Problem**: Self-hosted Temporal requires VM management.

**Evaluation Criteria**:

| Factor | Self-Hosted | Temporal Cloud |
|--------|-------------|----------------|
| Cost (50-200/day) | ~$165/month (VM) | ~$200-400/month |
| Operational burden | Medium | Low |
| HA setup | Manual | Built-in |
| Scaling | Manual | Automatic |
| Support | Community | Enterprise |

**Decision Point**: If operational burden exceeds 4 hours/month, migrate.

**Effort**: 1 week (evaluation + test migration)
**Impact**: Reduced ops burden, better SLA

---

### 3.3 Implement Workflow Queries for Status

**Problem**: No real-time status API for running workflows.

**Solution**: Add query handlers for workflow state.

```typescript
const statusQuery = defineQuery<WorkflowStatusResponse>('getStatus');

setHandler(statusQuery, () => ({
  currentStep: step,
  waitingForSignal: currentSignalWait,
  lastActivityTime: lastActivityTimestamp,
  errorState: currentError,
}));
```

**Use Cases**:
- Teams bot status card refresh
- Admin dashboard
- Debugging support

**Effort**: 4 hours
**Impact**: Better visibility, user experience improvement

---

## Priority 4: Nice-to-Have (Quarter 1 2026)

### 4.1 Add Workflow Metrics Dashboard

Create Grafana dashboard showing:
- Workflow throughput by day/hour
- Average completion time by step
- Signal wait times distribution
- Error rates by activity
- Human response times

**Effort**: 1 day
**Impact**: Business insights, SLA monitoring

---

### 4.2 Implement Batch Workflow Submission

Allow users to upload multiple order files at once.

**Considerations**:
- Rate limiting for Zoho API
- Progress reporting
- Partial failure handling

**Effort**: 1 week
**Impact**: Improved user efficiency for bulk orders

---

### 4.3 Add Workflow Cancellation UI

Enable users to cancel running workflows from Teams.

**Considerations**:
- Confirmation dialog
- Cleanup activities (draft deletion if exists)
- Audit trail preservation

**Effort**: 2 days
**Impact**: User control, cleaner workflow management

---

## Implementation Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| **1** | Critical Hardening | Heartbeats, versioning docs |
| **2** | Operations | External config, tracing, alerts |
| **3-4** | Runbooks | 5 operational runbooks |
| **5-6** | Temporal Cloud Eval | POC migration, cost analysis |
| **Q1 2026** | Enhancements | Dashboard, batch, cancellation |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| False timeout rate | Unknown | < 1% |
| Mean time to diagnose | ~30 min | < 10 min |
| Operational hours/month | ~8h | < 4h |
| Deployment confidence | Medium | High |
| User satisfaction | Good | Excellent |

---

## Conclusion

The v2 improvements focus on **operational excellence** rather than architectural changes. The Temporal platform is validated as optimal; the work ahead is hardening, observability, and documentation.

**Immediate Actions**:
1. Add heartbeats to `runCommittee` (this week)
2. Document versioning strategy (this week)
3. Set up basic alerting (next week)

---

*Recommendations created: 2025-12-30*
*Based on: Architecture validation ADR*
