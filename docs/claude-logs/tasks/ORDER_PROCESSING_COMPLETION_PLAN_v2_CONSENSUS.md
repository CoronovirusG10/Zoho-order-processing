# Order Processing App - Completion Plan v2 (Consensus Validated)

**Created**: 2025-12-30T08:45:00Z
**Updated**: 2025-12-30T09:15:00Z
**Validated By**: GPT-5.2 (8/10), DeepSeek-V3.2-Speciale (8/10), GPT-5.1-Codex-Max (7/10)
**Average Confidence**: 7.7/10

---

## CTO Orchestration Protocol

### Context Preservation Strategy

This plan is designed for **CTO orchestration mode** where Claude Code delegates to Task agents while preserving context across sessions.

**Key Principles**:
1. **Delegate ALL implementation** to Task agents (opus model, ultrathink)
2. **CTO maintains overview** - never loses sight of the full system
3. **Checkpoint after every phase** - save progress to files
4. **Resume-friendly** - any new session can pick up from checkpoints

### Checkpoint Files

After completing each phase, the CTO MUST create:

```
docs/claude-logs/tasks/CHECKPOINT_P{N}_{YYYYMMDD_HHMM}.md
```

Each checkpoint includes:
- Tasks completed with outcomes
- Tests run and results
- Issues encountered and resolutions
- Next phase prerequisites verified
- CTO observations and decisions

### Session Handoff Protocol

When context exceeds 70%, CTO must:

1. Create emergency checkpoint:
   ```
   docs/claude-logs/tasks/EMERGENCY_HANDOFF_{timestamp}.md
   ```

2. Include:
   - Current task in progress
   - Exact file and line being modified
   - Expected next steps
   - Open questions/blockers
   - All relevant file paths

3. New session loads checkpoint and resumes

---

## Consensus Summary

Three AI models evaluated the original completion plan and reached strong consensus on improvements:

### Unanimous Agreement (All 3 Models)

1. **Plan is technically feasible** - All components exist, just need wiring
2. **Priority adjustments required** - Several Phase 2/3 items are actually Phase 1 blockers
3. **Concurrency control required** - ETag-based optimistic concurrency for Cosmos updates
4. **End-to-end idempotency needed** - Teams uploads, card submissions, Zoho calls
5. **Selection card signal handlers missing** - Bot must handle Action.Submit and send Temporal signals
6. **Testing should be explicit** - E2E tests for happy path and disambiguation

### Key Recommendations

- **Event-sourcing light** (GPT-5.2): Append-only CaseEvents + materialized snapshot
- **Formal state machine** for disambiguation (GPT-5.2, DeepSeek)
- **Keep Temporal workflows deterministic** (Codex): All I/O in activities only
- **ZohoGateway interface boundary** (GPT-5.2): Future service extraction

---

## CTO Orchestration Execution Plan

### How to Execute This Plan

```
┌─────────────────────────────────────────────────────────────────┐
│                     CTO ORCHESTRATOR                            │
│  - Reads this plan                                              │
│  - Spawns Task agents for implementation                        │
│  - Reviews agent output                                         │
│  - Creates checkpoints                                          │
│  - Never implements directly (except trivial 1-2 line fixes)   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ Task Agent  │     │ Task Agent  │     │ Task Agent  │
   │ (opus)      │     │ (opus)      │     │ (opus)      │
   │             │     │             │     │             │
   │ Implements  │     │ Implements  │     │ Implements  │
   │ P1.1        │     │ P1.2        │     │ P1.3        │
   └─────────────┘     └─────────────┘     └─────────────┘
```

### Agent Spawning Templates

For each task, CTO spawns with this pattern:

```
Task Agent Prompt Template:
---
You are implementing task P{X}.{Y} for the order-processing system.

## Task
{task description}

## Files to Modify
{file paths}

## Requirements
{specific requirements from consensus}

## Verification
After implementation:
1. Run: cd /data/order-processing/app/services/{service} && npm run build
2. Verify no TypeScript errors
3. Report: files modified, lines changed, any issues

## Do NOT
- Modify files outside scope
- Add unnecessary dependencies
- Skip error handling
- Forget OCC where required
---
```

---

## Revised Phase Structure

### Phase 1: CRITICAL (Enables End-to-End Flow)

**7 items - Must all complete for any user path**

| ID | Task | Files | Complexity | Agent Prompt |
|----|------|-------|------------|--------------|
| **P1.1** | Refactor resolveItems to use Zoho library | `app/services/workflow/src/activities/resolve-items.ts` | M | See P1.1 Agent Prompt below |
| **P1.2** | Wire resolveCustomer dependencies | `app/services/workflow/src/worker.ts` | S | See P1.2 Agent Prompt below |
| **P1.3** | Fix Teams bot Cosmos persistence | `app/services/teams-bot/src/services/case-service.ts`, `conversation-store.ts` | M | See P1.3 Agent Prompt below |
| **P1.4** | Cosmos persistence for retry queue/fingerprints | `app/services/zoho/src/client.ts` | M | See P1.4 Agent Prompt below |
| **P1.5** | Implement applyCorrections with OCC | `app/services/workflow/src/activities/apply-corrections.ts` | M | See P1.5 Agent Prompt below |
| **P1.6** | Implement applySelections with OCC | `app/services/workflow/src/activities/apply-selections.ts` | M | See P1.6 Agent Prompt below |
| **P1.7** | Create Selection cards + signal handlers | `app/services/teams-bot/src/cards/`, `card-submit-handler.ts` | M | See P1.7 Agent Prompt below |

#### P1.1 Agent Prompt
```
Implement P1.1: Refactor resolveItems to use Zoho library directly.

PROBLEM: The resolveItems activity currently makes HTTP calls to ZOHO_SERVICE_URL
(localhost:3010) which doesn't exist, causing item resolution to fail.

SOLUTION: Import and use ItemMatcher from @order-processing/zoho library directly.

FILE: /data/order-processing/app/services/workflow/src/activities/resolve-items.ts

STEPS:
1. Read the current implementation
2. Remove HTTP fetch calls to ZOHO_SERVICE_URL
3. Import ItemMatcher from @order-processing/zoho
4. Initialize ItemMatcher with ZohoClient
5. Call itemMatcher.matchItem() for each item
6. Preserve existing return type and error handling
7. Ensure activity remains idempotent

VERIFICATION:
1. cd /data/order-processing/app/services/workflow && npm run build
2. Verify no TypeScript errors
3. Check that item matching logic is preserved

CONSTRAINTS:
- Do NOT modify the activity's input/output interface
- Do NOT add new dependencies (library already exists)
- Preserve correlation ID logging
```

#### P1.2 Agent Prompt
```
Implement P1.2: Wire resolveCustomer dependencies in worker.

PROBLEM: resolveCustomer activity falls back to mock because dependencies
(ZohoClient, CustomerMatcher) are not initialized in the worker.

SOLUTION: Initialize dependencies in worker.ts and call initializeResolveCustomerActivity().

FILE: /data/order-processing/app/services/workflow/src/worker.ts

STEPS:
1. Read current worker.ts and resolve-customer.ts
2. Import ZohoClient and CustomerMatcher from @order-processing/zoho
3. In worker startup (after Cosmos init), initialize ZohoClient
4. Create CustomerMatcher with the client
5. Call initializeResolveCustomerActivity({ casesRepository, zohoCustomerService, customerMatcher })
6. Handle initialization errors gracefully

VERIFICATION:
1. cd /data/order-processing/app/services/workflow && npm run build
2. Worker should start without errors
3. resolveCustomer should no longer fall back to mock
```

#### P1.3 Agent Prompt
```
Implement P1.3: Fix Teams bot Cosmos persistence.

PROBLEM: CaseService.createCase() returns metadata but doesn't persist to Cosmos DB.
getCaseStatus() always returns null.

FILES:
- /data/order-processing/app/services/teams-bot/src/services/case-service.ts
- /data/order-processing/app/services/teams-bot/src/services/conversation-store.ts

STEPS:
1. Read current implementations
2. In CaseService.createCase():
   - Connect to Cosmos DB (order-processing database, cases container)
   - Create case document with all metadata
   - Use SHA-256(file) + tenantId as idempotency key
3. In CaseService.getCaseStatus():
   - Query Cosmos for case by ID
   - Return actual status
4. In CosmosConversationStore:
   - Implement store() to persist to Cosmos
   - Implement get() to retrieve from Cosmos

VERIFICATION:
1. cd /data/order-processing/app/services/teams-bot && npm run build
2. No TypeScript errors

CONSTRAINTS:
- Use DefaultAzureCredential for auth
- Handle 404 gracefully (return null, don't throw)
```

#### P1.4 Agent Prompt
```
Implement P1.4: Cosmos persistence for Zoho retry queue and fingerprints.

PROBLEM: Retry queue and fingerprint store are in-memory only. Lost on restart,
causing potential duplicate orders.

FILE: /data/order-processing/app/services/zoho/src/client.ts

EXISTING IMPLEMENTATIONS (just need wiring):
- /data/order-processing/app/services/zoho/src/persistence/cosmos-retry-queue.ts
- /data/order-processing/app/services/zoho/src/persistence/fingerprint-store.ts

STEPS:
1. Read ZohoClient initialization
2. Replace in-memory RetryQueue with CosmosRetryQueue
3. Replace in-memory Map<string, OrderFingerprint> with FingerprintStore
4. Initialize Cosmos containers if not exist (zoho-fingerprints, zoho-retry-queue)
5. Update client.initialize() to await Cosmos setup

VERIFICATION:
1. cd /data/order-processing/app/services/zoho && npm run build
2. No TypeScript errors
```

#### P1.5 Agent Prompt
```
Implement P1.5: applyCorrections with Cosmos persistence and OCC.

PROBLEM: applyCorrections logs corrections but doesn't persist to Cosmos DB.
No concurrency control.

FILE: /data/order-processing/app/services/workflow/src/activities/apply-corrections.ts

STEPS:
1. Read current stub implementation
2. Load case from casesRepository.getCase(caseId, tenantId)
3. Store the _etag for OCC
4. Apply each correction to canonicalData using JSON path
5. Update case with casesRepository.updateCase(..., { etag })
6. Handle 412 (Precondition Failed) with RetryableError
7. Append 'corrections_applied' event via eventsRepository

OCC PATTERN:
```typescript
const caseDoc = await casesRepository.getCase(caseId, tenantId);
const etag = caseDoc._etag;

// Apply corrections...

try {
  await casesRepository.updateCase(caseId, tenantId, updatedData, {
    ifMatch: etag
  });
} catch (error) {
  if (error.code === 412) {
    throw new RetryableError('Concurrent update, retrying...');
  }
  throw error;
}
```

VERIFICATION:
1. cd /data/order-processing/app/services/workflow && npm run build
```

#### P1.6 Agent Prompt
```
Implement P1.6: applySelections with Cosmos persistence and OCC.

PROBLEM: applySelections logs selections but doesn't persist to Cosmos DB.

FILE: /data/order-processing/app/services/workflow/src/activities/apply-selections.ts

STEPS:
1. Read current stub implementation
2. Load case with ETag for OCC
3. For customer selection:
   - Update canonicalData.customer.zoho_customer_id
   - Set customer.match_metadata.selection_source = 'user_selected'
4. For item selection:
   - Find line item by row number
   - Update zoho_item_id
   - Set match_metadata.selection_source = 'user_selected'
5. Save with OCC (same pattern as P1.5)
6. Append 'selection_applied' event

VERIFICATION:
1. cd /data/order-processing/app/services/workflow && npm run build
```

#### P1.7 Agent Prompt
```
Implement P1.7: Customer/Item Selection cards AND signal handlers.

PROBLEM: No cards exist to present disambiguation choices. No handlers to
process selections and signal Temporal.

FILES TO CREATE:
- /data/order-processing/app/services/teams-bot/src/cards/customer-selection-card.ts
- /data/order-processing/app/services/teams-bot/src/cards/item-selection-card.ts

FILE TO MODIFY:
- /data/order-processing/app/services/teams-bot/src/handlers/card-submit-handler.ts

CARD REQUIREMENTS:
1. Show candidate list with confidence scores
2. Include evidence (why we think this match)
3. Radio button selection
4. Submit action with case binding

SIGNAL HANDLER REQUIREMENTS:
1. Handle 'select_customer' action
2. Handle 'select_item' action
3. Get Temporal workflow handle by caseId
4. Send appropriate signal (customerSelectionSignal / itemSelectionSignal)
5. Validate (caseId, userId, conversationId) server-side

VERIFICATION:
1. cd /data/order-processing/app/services/teams-bot && npm run build
```

### Phase 1 Checkpoint Template

After completing all P1.x tasks, create:

```markdown
# Checkpoint: Phase 1 Complete

**Date**: {timestamp}
**CTO Session**: {session_id}

## Tasks Completed

| Task | Status | Files Modified | Tests |
|------|--------|----------------|-------|
| P1.1 | DONE | resolve-items.ts | build ✓ |
| P1.2 | DONE | worker.ts | build ✓ |
| ... | ... | ... | ... |

## Build Verification

```bash
# All services build successfully
cd /data/order-processing/app/services/workflow && npm run build  # ✓
cd /data/order-processing/app/services/teams-bot && npm run build # ✓
cd /data/order-processing/app/services/zoho && npm run build      # ✓
```

## Integration Test

{describe manual test of end-to-end flow}

## Issues Encountered

{list any issues and how they were resolved}

## Ready for Phase 2

- [ ] All P1 tasks complete
- [ ] All builds pass
- [ ] Integration test successful
- [ ] No blocking issues

## Next Session Instructions

{instructions for next CTO session to continue with Phase 2}
```

---

### Phase 2: HIGH (Production Reliability)

**3 items - Complete happy path with compliance**

| ID | Task | Files | Complexity | Consensus Notes |
|----|------|-------|------------|-----------------|
| **P2.1** | Wire finalizeAudit into workflow | `app/services/workflow/src/workflows/order-processing.workflow.ts` | S | Call after createZohoDraft success |
| **P2.2** | Blob audit logging integration | `app/services/zoho/src/api/sales-orders.ts`, `customers.ts`, `items.ts` | S | **PROMOTED from P3** - Compliance requirement |
| **P2.3** | Add timeout/escalation handling | `app/services/workflow/src/workflows/order-processing.workflow.ts` | M | **NEW** - Handle user non-response scenarios |

### Phase 3: MEDIUM (Hardening & Testing)

**3 items - Production hardening**

| ID | Task | Files | Complexity | Consensus Notes |
|----|------|-------|------------|-----------------|
| **P3.1** | Implement cancel command | `app/services/teams-bot/src/handlers/message-handler.ts` | S | Send Temporal cancellation signal |
| **P3.2** | Add E2E tests | New test files | M | **NEW** - Happy path + disambiguation paths |
| **P3.3** | Add feature flags for mock/real Zoho | Config files | S | **NEW** - Prevent accidental prod calls in dev |

---

## Critical Implementation Details (From Consensus)

### 1. Optimistic Concurrency Control (OCC)

All Cosmos updates must use ETag-based concurrency:

```typescript
// In applyCorrections/applySelections
const caseDoc = await casesRepository.getCase(caseId, tenantId);
const etag = caseDoc._etag;

// Apply changes...

try {
  await casesRepository.updateCase(caseId, tenantId, updatedData, { ifMatch: etag });
} catch (error) {
  if (error.code === 412) { // Precondition failed
    throw new RetryableError('Concurrent update detected, retrying...');
  }
  throw error;
}
```

### 2. Selection Card Signal Handlers

P1.7 must include bot-side action handlers:

```typescript
// In card-submit-handler.ts
case 'select_customer':
  await workflowClient.getHandle(caseId).signal(
    'customerSelectionSignal',
    { customerId: data.selectedCustomerId }
  );
  break;

case 'select_item':
  await workflowClient.getHandle(caseId).signal(
    'itemSelectionSignal',
    { lineRow: data.lineRow, itemId: data.selectedItemId }
  );
  break;
```

### 3. Idempotency Keys

Add idempotency for:
- **createCase**: Use SHA-256(file) + userId as dedup key
- **applyCorrections**: Include correction timestamp in event
- **applySelections**: Include selection timestamp in event
- **Card submissions**: Track last processed action ID per case

### 4. Timeout Handling (P2.3)

```typescript
// In workflow
const selectionTimeout = '24 hours';
const escalationTimeout = '48 hours';

try {
  await condition(() => customerSelected, { timeout: selectionTimeout });
} catch (e) {
  if (e instanceof TimeoutError) {
    await notifyUser({ type: 'selection_reminder', ... });
    await condition(() => customerSelected, { timeout: escalationTimeout });
  }
}
```

---

## Revised Implementation Order

```
P1.1 (resolveItems) ─┬─> P1.2 (resolveCustomer deps)
                     └─> P1.3 (bot Cosmos) ─> P1.4 (retry queue)
                                            ↓
                              P1.5 + P1.6 (corrections/selections with OCC)
                                            ↓
                                    P1.7 (cards + handlers)
                                            ↓
                              P2.1 (finalizeAudit) + P2.2 (audit logging)
                                            ↓
                                    P2.3 (timeouts)
                                            ↓
                                      Phase 3 (parallel)
```

---

## CTO Quick Reference

### Starting a Session

```markdown
1. Read this plan: docs/claude-logs/tasks/ORDER_PROCESSING_COMPLETION_PLAN_v2_CONSENSUS.md
2. Check for checkpoints: ls docs/claude-logs/tasks/CHECKPOINT_*.md
3. Load most recent checkpoint if exists
4. Verify current state: git status, pm2 status, docker ps
5. Spawn Task agents for next tasks
6. Review agent output
7. Create checkpoint when phase complete or context > 50%
```

### Spawning Task Agents

```
All Task agents MUST use:
- subagent_type: "general-purpose"
- model: "opus"
- Detailed prompt with file paths and requirements
- Clear verification steps
```

### Context Thresholds

| Context % | Action |
|-----------|--------|
| < 50% | Normal operation |
| 50-70% | Complete current task, create checkpoint |
| > 70% | Emergency checkpoint, handoff to new session |

---

## Risk Mitigation (From Consensus)

| Risk | Mitigation | Owner |
|------|------------|-------|
| Race conditions in Cosmos | ETag-based OCC in all updates | P1.5, P1.6 |
| Stuck workflows | Timeout + escalation handling | P2.3 |
| Duplicate orders | Fingerprint persistence | P1.4 |
| Card tampering | Server-side validation of (caseId, userId, conversationId) | P1.7 |
| Temporal non-determinism | Keep Zoho client in activities only | All |
| Large Excel files | Evidence pack size limits | Existing |
| Teams card size limits | Pagination for many candidates | P1.7 |
| CTO context loss | Checkpoint files after every phase | All |

---

## Architectural Decisions (Consensus Recommendations)

### Accepted

1. **Direct Zoho library usage** - No separate HTTP service (simpler, fewer moving parts)
2. **ETag-based OCC** - Standard Cosmos pattern for concurrency
3. **Selection card signal handlers** - Required for end-to-end flow
4. **Checkpoint-based CTO orchestration** - Context preservation across sessions

### Deferred (Consider for v2)

1. **Event-sourcing light** - Append-only CaseEvents (reduces concurrency bugs, improves audit)
2. **Formal state machine** - Explicit disambiguation states
3. **ZohoGateway interface** - Future service extraction boundary

### Under Research

1. **Azure AI Foundry Agents** - Could replace/complement committee for AI reasoning
2. **Azure Durable Functions** - Alternative to self-hosted Temporal
3. **Hybrid Temporal + Agents** - Best of both worlds?

See: `docs/claude-logs/tasks/ORCHESTRATION_RESEARCH_PROMPTS.md` for research prompts.

---

## Success Criteria

End-to-end test passes:
1. User uploads Excel in Teams personal chat
2. File stored to Blob with SHA-256 hash
3. Case created and persisted in Cosmos DB
4. Temporal workflow started
5. Excel parsed, formula blocking works
6. Committee review completes
7. Customer resolved (or selection card shown if ambiguous, with signal handler)
8. Items resolved (or selection card shown if ambiguous, with signal handler)
9. Corrections can be submitted and persisted with OCC
10. Approval card shown with preview
11. Zoho draft created on approval (idempotent)
12. Success card shows Zoho order ID
13. Audit bundle created in Blob
14. Retry queue persisted across restarts

---

## Estimated Effort

| Phase | Items | Estimated Hours |
|-------|-------|-----------------|
| Phase 1 | 7 | 10-14 |
| Phase 2 | 3 | 4-6 |
| Phase 3 | 3 | 4-6 |
| **Total** | **13** | **18-26** |

---

## Appendix: Model Verdicts

### GPT-5.2 (Neutral Architect) - 8/10
> "Technically feasible and close to completion, but the plan underestimates end-to-end correctness risks (idempotency, state model, disambiguation UX loops, and audit/compliance)."

### DeepSeek-V3.2-Speciale (Devil's Advocate) - 8/10
> "The plan is technically feasible and well-structured, but requires adjustments to prioritization and inclusion of missing components such as error handling, testing, and bot signal handlers for selection cards."

### GPT-5.1-Codex-Max (Implementation Expert) - 7/10
> "Strong, feasible completion plan with minor reprioritization and a few missing durability and UX safeguards."
