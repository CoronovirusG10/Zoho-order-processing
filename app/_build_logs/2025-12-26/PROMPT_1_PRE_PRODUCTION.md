# PROMPT 1: Pre-Production Parallel Execution

**Mode:** ULTRATHINK
**Execution:** 8 Concurrent Claude Code Sessions
**Goal:** Complete all remaining work to reach Pre-Production ready state

---

## CTO ORCHESTRATION INSTRUCTIONS

You are the CTO orchestrator. Your job is to:
1. Read this prompt ONCE
2. Create a compressed context file for sub-agents
3. Launch ALL 8 agents IN PARALLEL in a SINGLE message
4. Monitor completion and merge results
5. Write final verification log

**CRITICAL:** To save CTO context, you MUST:
- Launch all agents in ONE tool call batch
- NOT re-read files that agents will read
- Keep your own token usage minimal
- Delegate ALL implementation to agents

---

## COMPRESSED CONTEXT FOR ALL AGENTS

```markdown
# Order Processing App — Pre-Production Sprint

## What This App Does
Teams 1:1 bot + personal tab that:
1. Receives Excel uploads (1 file = 1 order)
2. Uses deterministic-led extraction (minimal LLM freedom)
3. Runs 3-model committee for cross-checking mappings
4. Creates Draft Sales Orders in Zoho Books
5. Stores everything in Azure Blob for 5+ years audit

## Non-Negotiable Requirements
- Cross-tenant: Azure in Tenant A, Teams users in Tenant B
- Formula blocking: If formulas exist, BLOCK file (configurable)
- Zoho pricing prevails: Spreadsheet prices are audit-only
- Qty=0 is valid: No warnings for zero quantity
- Human-in-the-loop: Issues must be surfaced to user for correction
- Evidence-based: Every extracted value has cell reference proof
- Correlation IDs: End-to-end tracing from Teams→Zoho

## Current State (2025-12-25)
- 10 of 11 services BUILD SUCCESSFULLY
- 244 of 247 tests PASS
- Workflow service SKIPPED (durable-functions v3 migration needed)
- 3 test failures (weighted-voting min weight, GTIN-12 check digit)

## Codebase Location
- Monorepo: `/data/order-processing/app/`
- Services: `services/{parser,committee,storage,api,teams-bot,teams-tab,agent,zoho,workflow}`
- Packages: `packages/{types,shared}`
- Infra: `infra/*.bicep`
- Tests: `tests/`

## Tech Stack
- TypeScript/Node for all services
- exceljs for Excel parsing
- Durable Functions v3 + @azure/functions v4 for workflow
- Bicep for IaC
- vitest for testing
- React + Vite for Teams tab
- Bot Framework v4 for Teams bot

## Security Rules
- NEVER log secrets (Zoho tokens, API keys)
- All model outputs stored as blob artefacts
- WORM policies for 5+ year retention
```

---

## 8 PARALLEL AGENTS TO LAUNCH

### Agent 1: Workflow V3 Migration (Activities)
```
TASK: Migrate all workflow activity files to durable-functions v3 API

FILES TO MODIFY:
- services/workflow/src/activities/apply-corrections.ts
- services/workflow/src/activities/apply-selections.ts
- services/workflow/src/activities/create-zoho-draft.ts
- services/workflow/src/activities/notify-user.ts
- services/workflow/src/activities/resolve-customer.ts
- services/workflow/src/activities/resolve-items.ts
- services/workflow/src/activities/run-committee.ts
- services/workflow/src/activities/update-case.ts

PATTERN TO FOLLOW (already migrated examples):
- services/workflow/src/activities/store-file.ts
- services/workflow/src/activities/parse-excel.ts

CHANGES REQUIRED:
1. Change: `import * as df from 'durable-functions'`
   To: `import { InvocationContext } from '@azure/functions'`
2. Change: `df.ActivityHandler` and `df.InvocationContext`
   To: Use `InvocationContext` from @azure/functions
3. Remove: `df.app.activity(...)` registration calls
4. Export function directly: `export { activityName }`

VERIFY: Run `cd services/workflow && npx tsc --noEmit` after changes

OUTPUT: Write summary to `_build_logs/2025-12-26/01_workflow_activities.md`
```

### Agent 2: Workflow V3 Migration (Orchestrations & Entities)
```
TASK: Migrate orchestration and entity files to durable-functions v3 API

FILES TO MODIFY:
- services/workflow/src/orchestrations/order-processing.ts
- services/workflow/src/entities/case-entity.ts
- services/workflow/src/utils/durable-client.ts

CHANGES REQUIRED FOR order-processing.ts:
1. Fix `context.log.info(...)` → use `context.log(...)`
2. Fix WorkflowResult type casting issue on line 304
3. Update any df.* type references

CHANGES REQUIRED FOR case-entity.ts:
1. Fix `dispatchEntity` call on line 213
2. Update entity context types

CHANGES REQUIRED FOR durable-client.ts:
1. Replace `DurableOrchestrationClient` with new v3 patterns
2. Fix `OrchestrationStatusQueryCondition` references
3. Use @azure/functions v4 client patterns

REFERENCE: https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-node-model-upgrade

VERIFY: Run `cd services/workflow && npx tsc --noEmit` after changes

OUTPUT: Write summary to `_build_logs/2025-12-26/02_workflow_orchestrations.md`
```

### Agent 3: Workflow V3 Migration (Triggers)
```
TASK: Migrate HTTP and Queue triggers to @azure/functions v4 API

FILES TO MODIFY:
- services/workflow/src/triggers/http-trigger.ts (fix Headers.Location issue line 73)
- services/workflow/src/triggers/queue-trigger.ts
- services/workflow/src/triggers/http-event-trigger.ts
- services/workflow/src/triggers/http-status-trigger.ts
- services/workflow/src/index.ts

CHANGES REQUIRED:
1. Update trigger registrations to v4 patterns
2. Fix type issues with Headers object
3. Ensure all exports are correct

PATTERN:
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

app.http('triggerName', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // implementation
  }
});
```

VERIFY: Run `cd services/workflow && npx tsc --noEmit` after changes

OUTPUT: Write summary to `_build_logs/2025-12-26/03_workflow_triggers.md`
```

### Agent 4: Test Fixes
```
TASK: Fix the 3 failing unit tests

FILES TO FIX:
1. tests/unit/committee/weighted-voting.test.ts
   - Issue: expect(calculateWeight(accuracies['poor-model'])).toBe(0.1) returns 0.3
   - Find the calculateWeight function and fix the min weight logic

2. tests/unit/validation/gtin.test.ts
   - Issue: GTIN-12 check digit calculation returns 6 instead of 9
   - Find calculateCheckDigit function and fix the algorithm

STEPS:
1. Read the test files to understand expected behavior
2. Find the source functions being tested
3. Fix the logic errors
4. Run `npm test` to verify all 247 tests pass

VERIFY: All tests pass with `npm test`

OUTPUT: Write summary to `_build_logs/2025-12-26/04_test_fixes.md`
```

### Agent 5: Azure Deployment Preparation
```
TASK: Prepare Azure deployment scripts and validate Bicep templates

FILES TO WORK WITH:
- infra/main.bicep
- infra/modules/*.bicep (14 modules)

DELIVERABLES:
1. Create `infra/deploy.sh` script:
   ```bash
   #!/bin/bash
   # Deploy Order Processing to Azure Sweden Central
   RESOURCE_GROUP="${1:-rg-orderprocessing-prod}"
   LOCATION="swedencentral"

   az group create --name $RESOURCE_GROUP --location $LOCATION
   az deployment group create \
     --resource-group $RESOURCE_GROUP \
     --template-file main.bicep \
     --parameters environment=prod
   ```

2. Create `infra/parameters.prod.json` with production parameters

3. Validate Bicep: `az bicep build --file infra/main.bicep`

4. Create `infra/README.md` with deployment instructions

5. List all resources that will be created

VERIFY: `az bicep build` succeeds without errors

OUTPUT: Write summary to `_build_logs/2025-12-26/05_azure_deployment.md`
```

### Agent 6: Cross-Tenant Teams Configuration
```
TASK: Create Teams app package and cross-tenant configuration scripts

REFERENCE: /data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md

DELIVERABLES:
1. Create `teams-app/manifest.json`:
   - Bot definition with placeholder for BOT_APP_CLIENT_ID
   - Personal tab definition pointing to tab URL
   - Required permissions and scopes

2. Create `teams-app/color.png` and `teams-app/outline.png` (placeholder)
   - Can be simple solid color images for now

3. Create `scripts/create-entra-apps.sh`:
   - Script to create Bot App registration (multi-tenant)
   - Script to create Tab/API App registration (multi-tenant with app roles)
   - Output required environment variables

4. Create `scripts/package-teams-app.sh`:
   - Package manifest + icons into deployable zip

5. Create `docs/TENANT_B_ADMIN_GUIDE.md`:
   - Step-by-step for Tenant B admin to onboard

VERIFY: manifest.json passes Teams schema validation

OUTPUT: Write summary to `_build_logs/2025-12-26/06_teams_configuration.md`
```

### Agent 7: Integration Test Setup
```
TASK: Create integration test infrastructure for pre-production validation

DELIVERABLES:
1. Create `tests/integration/setup.ts`:
   - Test environment configuration
   - Mock server setup for Zoho API
   - Test blob storage client

2. Create `tests/integration/e2e-flow.test.ts`:
   - Full flow: Excel upload → Parse → Committee → Zoho draft
   - Use golden file Excel samples

3. Create `tests/integration/committee-voting.test.ts`:
   - Test 3-provider committee with mock LLM responses
   - Verify weighted voting aggregation
   - Test disagreement handling

4. Create `tests/integration/zoho-draft.test.ts`:
   - Test idempotent draft creation
   - Test fingerprint deduplication
   - Mock Zoho API responses

5. Create `tests/fixtures/` with sample Excel files:
   - simple-order.xlsx
   - multi-line-order.xlsx
   - order-with-formulas.xlsx (should be blocked)
   - farsi-headers.xlsx

VERIFY: Integration tests run with `npm run test:integration`

OUTPUT: Write summary to `_build_logs/2025-12-26/07_integration_tests.md`
```

### Agent 8: Documentation & Runbooks
```
TASK: Create operational documentation for pre-production

DELIVERABLES:
1. Update `app/docs/README.md` with current architecture

2. Create `app/docs/runbooks/zoho-outage.md`:
   - Detection (API errors, latency)
   - Impact (draft creation queued)
   - Resolution steps
   - Rollback procedures

3. Create `app/docs/runbooks/model-change.md`:
   - How to add/remove committee models
   - Weight recalibration steps
   - Testing requirements

4. Create `app/docs/runbooks/troubleshooting.md`:
   - Common error codes and fixes
   - Log locations
   - Correlation ID tracing

5. Create `app/docs/architecture/data-flow.md`:
   - Mermaid diagram of request flow
   - All services and their interactions

6. Create `CHANGELOG.md` at repo root:
   - Version 0.1.0 with all features implemented

VERIFY: All markdown renders correctly

OUTPUT: Write summary to `_build_logs/2025-12-26/08_documentation.md`
```

---

## CTO EXECUTION COMMANDS

```bash
# Launch all 8 agents in parallel using Task tool with subagent_type="general-purpose"
# Each agent gets the compressed context + their specific task
# All agents run in ULTRATHINK mode

# After all agents complete:
npm run build                    # Verify all services compile
npm test                         # Verify all 247 tests pass
cd services/workflow && npm run build:strict  # Verify workflow compiles
az bicep build --file infra/main.bicep        # Verify Bicep

# Write final summary to:
_build_logs/2025-12-26/CTO_PRE_PRODUCTION_SUMMARY.md
```

---

## SUCCESS CRITERIA

Pre-Production is COMPLETE when:
1. ✅ All 11 services build successfully (including workflow)
2. ✅ All 247 tests pass (0 failures)
3. ✅ Bicep templates validate
4. ✅ Teams app manifest is valid
5. ✅ Integration tests are in place
6. ✅ Deployment scripts are ready
7. ✅ Runbooks are documented

---

## AGENT OUTPUT FORMAT

Each agent MUST write a summary file containing:
```markdown
# Agent N: [Task Name] — 2025-12-26

## Status: COMPLETE | PARTIAL | BLOCKED

## Changes Made
- [file]: [description of change]

## Verification
- Command: [what was run]
- Result: [pass/fail + output]

## Issues Encountered
- [any blockers or warnings]

## Time Spent
- Estimated: [X minutes]
```
