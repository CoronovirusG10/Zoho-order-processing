# Temporal Implementation Best Practices Audit

**Date**: 2025-12-30
**Scope**: Order Processing System - Temporal Workflow Implementation
**Status**: COMPLETE

---

## Executive Summary

The Pippa of London order processing system implements a 9-step Temporal workflow with human-in-the-loop patterns for order validation, customer/item resolution, and approval workflows. This audit evaluates the implementation against Temporal best practices, identifies anti-patterns, and provides recommendations for improvement and scaling.

**Overall Assessment**: The implementation follows most Temporal best practices with a few areas for optimization. The architecture is well-suited for the current scale (50-200 workflows/day) with a clear path to scaling.

---

## 1. Best Practices Compliance Checklist

### Workflow Design

| Practice | Status | Notes |
|----------|--------|-------|
| Activities for side effects only | :white_check_mark: PASS | All I/O operations (Zoho API, notifications, storage) are in activities |
| Deterministic workflow code | :white_check_mark: PASS | No non-deterministic operations in workflow code |
| Signal handlers set state only | :white_check_mark: PASS | Signal handlers just update state variables, don't perform I/O |
| Query handlers return state only | :white_check_mark: PASS | `getStateQuery` returns readonly state snapshot |
| Workflow decomposition | :white_check_mark: PASS | Complex logic broken into 11 distinct activities |
| Type safety | :white_check_mark: PASS | Full TypeScript typing for all inputs/outputs |
| Retry policies defined | :white_check_mark: PASS | Standard (3 attempts) and aggressive (5 attempts) policies |
| Non-retryable errors specified | :white_check_mark: PASS | `ValidationError`, `BlockedFileError` marked non-retryable |

### Human-in-the-Loop Pattern

| Practice | Status | Notes |
|----------|--------|-------|
| Signal-based user input | :white_check_mark: PASS | Using `defineSignal` for all 4 user input types |
| Condition-based waiting | :white_check_mark: PASS | Using `condition()` with proper timeout handling |
| Timeout escalation | :white_check_mark: PASS | Reminder (24h) -> Escalation (48h) -> Cancel (7d) |
| State preserved across waits | :white_check_mark: PASS | State stored in workflow variables, survives replay |

### Activity Configuration

| Practice | Status | Notes |
|----------|--------|-------|
| Start-to-Close timeout set | :white_check_mark: PASS | 5m for standard, 10m for Zoho, 60s for audit |
| Retry backoff configured | :white_check_mark: PASS | Exponential backoff (coefficient 2.0) |
| Maximum interval set | :white_check_mark: PASS | 30s standard, 60s aggressive |
| Activities are idempotent | :yellow_square: PARTIAL | Zoho uses `external_order_key` for idempotency, but not all activities have idempotency checks |

### Continue-As-New Usage

| Practice | Status | Notes |
|----------|--------|-------|
| Used for file reupload | :white_check_mark: PASS | Correctly restarts workflow with new file |
| Pending signals handled | :yellow_square: PARTIAL | File reupload is the only continueAsNew trigger |
| Event history limit awareness | :white_check_mark: PASS | Workflow is short-lived, unlikely to hit 51,200 event limit |

---

## 2. Anti-Pattern Analysis

### Anti-Patterns NOT Found (Good)

| Anti-Pattern | Status | Notes |
|--------------|--------|-------|
| Large data in payloads | :white_check_mark: AVOIDED | Uses caseId references, data stored in Cosmos/Blob |
| Breaking determinism | :white_check_mark: AVOIDED | No random, time, or network calls in workflow |
| Over-wrapping SDK | :white_check_mark: AVOIDED | Direct SDK usage with thin typing layer |
| Non-idempotent retries | :white_check_mark: AVOIDED | Critical operations (Zoho) use idempotency keys |
| Infinite activity retries | :white_check_mark: AVOIDED | Maximum attempts capped at 3-5 |

### Potential Anti-Patterns Found

| Issue | Severity | Description |
|-------|----------|-------------|
| Singleton pattern in activities | LOW | `cachedEngine` in run-committee.ts persists across activity calls - acceptable but should be aware of memory implications |
| Hard-coded timeout durations | LOW | Timeout escalation phases use literal strings ('24h', '5d') instead of configurable constants |
| Missing heartbeat for long activities | MEDIUM | AI committee activity (up to 5min) should use heartbeat timeouts |
| No workflow versioning setup | MEDIUM | No `patched()` or versioning strategy documented for future updates |

---

## 3. Specific Implementation Questions Answered

### Q: Should AI committee (runCommittee) be a child workflow?

**Answer: No, activity is appropriate.**

Rationale:
- The committee runs 3 AI models in parallel, completes in under 5 minutes
- No internal state transitions or human waits required
- Single transactional operation with clear success/failure
- Using child workflow would add complexity without benefit

Per Temporal guidance: "Start with Activities until there is a clear need for Child Workflows."

**Recommendation**: Keep as activity, but add heartbeat timeout for better failure detection:
```typescript
const { runCommittee } = proxyActivities<Activities>({
  startToCloseTimeout: '5m',
  heartbeatTimeout: '30s',  // Add this
  retry: standardRetry,
});
```

### Q: Is external state storage (Cosmos DB) a recommended pattern?

**Answer: Yes, this is the recommended "Claim Check" pattern.**

Temporal explicitly recommends: "Store data external to Temporal in a database or file system. Pass an identifier for the data into the function and use an Activity to retrieve it as needed."

Your implementation correctly:
- Stores case data in Cosmos DB with ETag-based optimistic concurrency
- Stores files in Azure Blob Storage
- Passes only `caseId` through workflow
- Retrieves data in activities when needed

**This is best practice, not an anti-pattern.**

### Q: How should "selection cards" pattern work idiomatically?

**Answer: Your implementation is correct.**

Your pattern:
1. Activity detects need for human selection
2. Activity returns `needsHuman: true` with candidates
3. Workflow sends notification to user
4. Workflow waits on signal with `condition()`
5. Signal handler updates state
6. Workflow continues with selection

This matches Temporal's recommended human-in-the-loop pattern exactly.

### Q: Is the use of continueAsNew for file reuploads correct?

**Answer: Yes, this is the correct use case.**

`continueAsNew` is appropriate when:
- You want to reset workflow history
- You're starting "fresh" with new input data

For file reupload, the entire workflow needs to restart from step 1 with new data. This is exactly what `continueAsNew` is designed for.

**Consideration**: Ensure you're draining signals before continuing:
```typescript
// Current implementation correctly waits for signal before continuing
await condition(() => fileReuploadedEvent !== null);
const reuploadEvent = fileReuploadedEvent!;
return continueAsNew<typeof orderProcessingWorkflow>({...});
```

### Q: Should timeout escalation be a separate activity?

**Answer: Current inline approach is fine, but consider extraction for testability.**

Your `waitForHumanWithEscalation()` helper is well-designed:
- Encapsulates the 4-phase escalation logic
- Uses activities (`notifyUser`) for side effects
- Uses `condition()` for waiting

**Optional improvement**: Extract to a separate file for unit testing:
```typescript
// workflows/helpers/human-wait.ts
export async function waitForHumanWithEscalation(options: WaitForHumanOptions): Promise<HumanWaitResult>
```

---

## 4. Self-Hosted vs Temporal Cloud Decision Matrix

### Current Setup: Self-Hosted on Single VM

| Component | Configuration |
|-----------|--------------|
| Temporal Server | Docker (temporalio/auto-setup:latest) |
| Persistence | PostgreSQL 15 Alpine |
| UI | Temporal UI on port 8088 |
| Worker | PM2-managed Node.js process |

### Feature Comparison

| Feature | Self-Hosted | Temporal Cloud |
|---------|-------------|----------------|
| **Cost (50-200 workflows/day)** | ~$100-200/mo (VM + storage) | ~$75-150/mo (Actions + Storage) |
| **Cost (1000 workflows/day)** | ~$200-400/mo (larger VM) | ~$300-500/mo |
| **Operational burden** | HIGH (8+ eng-months/year typical) | ZERO |
| **SLA guarantee** | DIY (you're on-call) | 99.9% SLA |
| **Multi-region** | Complex to implement | Built-in |
| **Automatic scaling** | Manual | Automatic |
| **Security patches** | Manual updates | Automatic |
| **Observability** | Build your own | Built-in dashboards |
| **Worker Versioning** | Available | Available + Controller |
| **SSO/SAML** | DIY | Included (Enterprise) |

### Recommendation for Pippa of London

**Short-term (6-12 months)**: Stay self-hosted
- Current scale (50-200/day) is manageable
- Single VM can handle 500+ workflows/day easily
- Cost is lower with current setup
- Gain operational experience with Temporal

**Medium-term (12-24 months)**: Migrate to Temporal Cloud if:
- Volume exceeds 500 workflows/day consistently
- Operational burden becomes significant
- Multi-region redundancy is needed
- Team size grows and on-call becomes a concern

**Migration path** (when ready):
1. Temporal offers zero-downtime migration tooling (2025)
2. No code changes required - only connection config
3. Estimated migration: 1-2 days with tooling

---

## 5. Scaling Roadmap

### Current Capacity (Single VM)

| Metric | Current Config | Estimated Limit |
|--------|----------------|-----------------|
| Concurrent workflow tasks | 10 | Can increase to 50+ |
| Concurrent activity tasks | 20 | Can increase to 100+ |
| Workers | 1 | Can run 2-4 on same VM |
| PostgreSQL | Single instance | Handles 1000s of workflows |
| Workflows/day | 50-200 | Up to 2000-5000 |

### Scaling Tiers

#### Tier 1: Vertical Scaling (Current - 500 workflows/day)
- Increase worker concurrency settings
- Increase VM resources if needed
- **No architecture changes required**

```typescript
// worker.ts - increase these values
maxConcurrentWorkflowTaskExecutions: 25,  // from 10
maxConcurrentActivityTaskExecutions: 50,  // from 20
```

#### Tier 2: Horizontal Worker Scaling (500 - 2000 workflows/day)
- Run multiple worker instances (PM2 cluster mode or separate VMs)
- Single Temporal server handles multiple workers automatically
- **Add PM2 cluster configuration**

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'temporal-worker',
    script: 'dist/worker.js',
    instances: 4,  // Run 4 worker instances
    exec_mode: 'cluster',
  }]
};
```

#### Tier 3: Temporal Server Scaling (2000 - 10000 workflows/day)
- Separate Temporal services (History, Matching, Frontend)
- PostgreSQL with read replicas or managed PostgreSQL
- Consider Kubernetes deployment

#### Tier 4: Temporal Cloud or Full Scale-Out (10000+ workflows/day)
- Migrate to Temporal Cloud
- Or: Cassandra backend with multi-node Temporal
- Global distribution if needed

### PostgreSQL Scaling Notes

Current PostgreSQL 15 Alpine can handle:
- ~50,000 active workflow executions
- ~1,000,000 completed workflow histories (retention dependent)

**When to scale PostgreSQL**:
- History replay becomes slow (>10s)
- Connection pool exhaustion
- Disk I/O saturation

**Options**:
1. Azure Database for PostgreSQL (managed)
2. PostgreSQL with read replicas
3. Move to Cassandra (only if >100K concurrent workflows)

---

## 6. Prioritized Recommendations

### Priority 1: Quick Wins (This Week)

#### 1.1 Add Heartbeat to Long-Running Activities
```typescript
// workflow/src/workflows/order-processing.workflow.ts
const { runCommittee } = proxyActivities<Activities>({
  startToCloseTimeout: '5m',
  heartbeatTimeout: '30s',  // ADD THIS
  retry: standardRetry,
});
```

**Why**: If AI committee hangs, current 5-minute timeout means 5 minutes of uncertainty. Heartbeat detects failures in 30 seconds.

**Implementation in activity**:
```typescript
// activities/run-committee.ts
import { log, heartbeat } from '@temporalio/activity';

export async function runCommittee(input: RunCommitteeInput): Promise<RunCommitteeOutput> {
  heartbeat('starting committee');
  // ... run each model ...
  heartbeat('model 1 complete');
  // ... etc ...
}
```

#### 1.2 Configure Workflow Execution Timeout
```typescript
// When starting workflow (in API/bot)
const handle = await client.workflow.start(orderProcessingWorkflow, {
  workflowId: `order-${caseId}`,
  taskQueue: 'order-processing',
  args: [input],
  workflowExecutionTimeout: '30d',  // ADD THIS - max 30 days total
});
```

**Why**: Provides a hard ceiling on workflow duration, preventing zombie workflows.

### Priority 2: Medium-Term Improvements (Next Sprint)

#### 2.1 Add Workflow Versioning Infrastructure
Create versioning documentation and patching strategy:

```typescript
// workflows/order-processing.workflow.ts
import { patched } from '@temporalio/workflow';

// When making breaking changes in future:
if (patched('v2-new-approval-flow')) {
  // New code path
} else {
  // Old code path for in-flight workflows
}
```

**Why**: Allows safe deployment of workflow code changes without breaking running executions.

#### 2.2 Externalize Timeout Configuration
```typescript
// config/human-wait-config.ts
export const HUMAN_WAIT_CONFIG: HumanWaitTimeoutConfig = {
  reminderAfter: process.env.REMINDER_TIMEOUT || '24h',
  escalationAfter: process.env.ESCALATION_TIMEOUT || '48h',
  maxWait: process.env.MAX_WAIT_TIMEOUT || '7d',
};
```

**Why**: Allows timeout tuning without code changes.

#### 2.3 Add Activity Idempotency Keys to All Activities
```typescript
// activities/apply-corrections.ts
export async function applyCorrections(input: ApplyCorrectionsInput): Promise<ApplyCorrectionsOutput> {
  const idempotencyKey = `corrections-${input.caseId}-${input.correlationId}`;
  // Use this key to detect duplicate executions
}
```

**Why**: Prevents duplicate side effects during retries.

### Priority 3: Long-Term Architecture (Next Quarter)

#### 3.1 Implement Observability Stack
- Add OpenTelemetry tracing to workflow SDK
- Export metrics to Prometheus/Grafana
- Create workflow duration dashboards
- Set up alerting for stuck workflows

#### 3.2 Prepare for Multi-Worker Deployment
- Test PM2 cluster mode
- Document worker versioning strategy
- Create health check endpoints for workers

#### 3.3 Evaluate Temporal Cloud Migration
- Calculate total cost of ownership for self-hosted
- Request Temporal Cloud trial
- Plan migration timeline

---

## 7. Code Improvement Suggestions

### 7.1 Improve Error Classification in createZohoDraft

Current `isTransientError` function is good but could be more precise:

```typescript
// Better pattern: explicit error codes
export class ZohoRateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = 'ZohoRateLimitError';
  }
}

// In workflow, configure retry policy to handle this:
const zohoRetry: RetryPolicy = {
  maximumAttempts: 10,
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '5m',
  nonRetryableErrorTypes: ['ValidationError', 'ZohoAuthError'],
};
```

### 7.2 Add Workflow Reset Safety

Add a query that indicates if workflow is safe to reset:

```typescript
export const canResetQuery = defineQuery<boolean>('canReset');

// In workflow:
setHandler(canResetQuery, () => {
  // Safe to reset if we haven't created a Zoho order yet
  return state.currentStep !== 'creating_zoho_draft' &&
         state.currentStep !== 'completed';
});
```

### 7.3 Structured Logging Improvement

Add correlation ID to all log entries:

```typescript
const logger = {
  info: (msg: string, extra?: object) =>
    log.info(`[${caseId}] ${msg}`, { ...extra, correlationId }),
  error: (msg: string, extra?: object) =>
    log.error(`[${caseId}] ${msg}`, { ...extra, correlationId }),
};
```

---

## 8. Summary Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| **Workflow Design** | 9/10 | Excellent structure, minor improvements possible |
| **Activity Design** | 8/10 | Good patterns, needs heartbeats |
| **Signal Handling** | 10/10 | Textbook human-in-the-loop |
| **Error Handling** | 8/10 | Good retry policies, could add more precision |
| **Scalability** | 7/10 | Ready for 10x growth, needs planning for 100x |
| **Observability** | 6/10 | Basic logging, needs metrics/tracing |
| **Operational Readiness** | 7/10 | Good Docker setup, needs versioning strategy |

**Overall Score: 79/100 - PRODUCTION READY**

The implementation follows Temporal best practices and is well-suited for current scale. The recommendations in this audit will improve resilience and prepare the system for growth.

---

## Sources

- [Temporal Best Practices Hub](https://docs.temporal.io/best-practices)
- [Worker Deployment and Performance](https://docs.temporal.io/best-practices/worker)
- [Human-in-the-Loop Tutorial](https://learn.temporal.io/tutorials/ai/building-durable-ai-applications/human-in-the-loop/)
- [Continue-As-New TypeScript SDK](https://docs.temporal.io/develop/typescript/continue-as-new)
- [Temporal Cloud Pricing](https://temporal.io/pricing)
- [Temporal Anti-Patterns Blog](https://temporal.io/blog/spooky-stories-chilling-temporal-anti-patterns-part-1)
- [Child Workflows Documentation](https://docs.temporal.io/child-workflows)
- [Activity Timeouts Blog](https://temporal.io/blog/activity-timeouts)
- [Retry Policy Documentation](https://docs.temporal.io/encyclopedia/retry-policies)
- [Workflow Execution Limits](https://docs.temporal.io/workflow-execution/limits)
- [Long-Running Workflows Guide](https://temporal.io/blog/very-long-running-workflows)

---

*Audit performed by Claude Code on 2025-12-30*
