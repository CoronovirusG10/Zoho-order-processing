# Claude Code CTO: Order Processing VM Deployment Orchestration

**Copy this entire document as the initial prompt for a new Claude Code session.**

---

## Role

You are a **CTO Orchestrator** managing the deployment verification of the Order Processing system on pippai-vm. You delegate execution to Task agents (sub-agents) using `claude-opus-4-5` model with ultrathink reasoning.

## Working Directory

```
/data/order-processing
```

## Critical Rules

1. **NEVER execute prompts directly** - Always delegate to Task agents
2. **Use claude-opus-4-5 model** for all Task agents (ultrathink mode)
3. **Maximum 75 concurrent Task agents** - but use judgment on actual parallelism
4. **Tasks spawning Tasks is FORBIDDEN** - causes context explosion
5. **Log everything** to `docs/claude-logs/daily/YYYY-MM-DD.md`
6. **Update TodoWrite** after each phase completes

## Prompt Location

```
/data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/
```

## Two-Tenant Architecture

| Tenant | ID | Role |
|--------|-----|------|
| **360innovate** | 545acd6e-7392-4046-bc3e-d4656b7146dd | Azure infrastructure |
| **Pippa of London** | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e | Bot registration + Teams |

---

## Execution Plan

### Setup Phase (CTO Direct)

Before delegating, perform setup directly:

```bash
# 1. Set run ID
export OP_RUN_ID=$(date -u +%Y%m%d_%H%M%S)
mkdir -p /data/order-processing/_codex_predeploy/${OP_RUN_ID}

# 2. Initialize log file
LOG_DIR="/data/order-processing/docs/claude-logs/daily"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/$(date +%Y-%m-%d).md"

# 3. Start session log entry
cat >> "${LOG_FILE}" << EOF

## Deployment Session: ${OP_RUN_ID} ($(date +%H:%M))

### Configuration
- Run ID: ${OP_RUN_ID}
- Output: /data/order-processing/_codex_predeploy/${OP_RUN_ID}/
- Model: claude-opus-4-5 (ultrathink)

### Phase Execution Log
EOF
```

---

### Phase 1: VM Foundation (Sequential)

**Delegate to single Task agent:**

```
Task Agent 1:
- Prompt: 01_VM_FOUNDATION.md
- Model: opus
- Description: "Execute VM Foundation setup"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/01_VM_FOUNDATION.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}
   Output to: /data/order-processing/_codex_predeploy/${OP_RUN_ID}/

   Execute all steps:
   1. Setup logging helper
   2. Validate prerequisites (docker, docker compose, pm2, nginx)
   3. Start Temporal stack
   4. Start PM2 services
   5. Verify nginx configuration
   6. Run health checks
   7. Write 01_VM_FOUNDATION_REPORT.md

   Return: Summary of pass/fail status for each step"
```

**After completion, log result and update TodoWrite.**

---

### Phase 2: Azure Access & Containers (Sequential)

**Must run in order: 02 → 08**

```
Task Agent 2a:
- Prompt: 02_MI_AZURE_ACCESS.md
- Model: opus
- Description: "Verify Managed Identity Azure access"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/02_MI_AZURE_ACCESS.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Execute:
   1. Verify Azure CLI
   2. Login with Managed Identity
   3. Verify access to Key Vault, Storage, Cosmos
   4. Write 02_AZURE_MI_ACCESS_REPORT.md

   Return: MI login status and resource access summary"
```

**Wait for 2a to complete, then:**

```
Task Agent 2b:
- Prompt: 08_CONTAINERS_SETUP.md
- Model: opus
- Description: "Create Cosmos/Blob containers and Temporal namespace"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/08_CONTAINERS_SETUP.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Execute:
   1. Create Cosmos DB containers (cases, fingerprints, events, agentThreads, committeeVotes, cache)
   2. Create Blob containers (orders-incoming, orders-audit, committee-evidence, logs-archive)
   3. Register Temporal namespace: order-processing
   4. Write 08_CONTAINERS_SETUP_REPORT.md

   Return: Container creation status summary"
```

---

### Phase 3: SSL Provisioning (Sequential)

```
Task Agent 3:
- Prompt: 09_SSL_PROVISIONING.md
- Model: opus
- Description: "Provision SSL certificate"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/09_SSL_PROVISIONING.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Execute:
   1. Verify nginx is running
   2. Check DNS resolution for processing.pippaoflondon.co.uk
   3. Check existing certificate status
   4. Run certbot if needed
   5. Verify renewal cron job
   6. Write 09_SSL_PROVISIONING_REPORT.md

   Return: SSL certificate status and expiry date"
```

---

### Phase 4: Integrations (✅ PARALLEL)

**Launch both agents simultaneously in ONE message:**

```
Task Agent 4a:
- Prompt: 03_FOUNDRY_MODEL_SMOKES.md
- Model: opus
- Description: "AI model connectivity smoke tests"
- run_in_background: true
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/03_FOUNDRY_MODEL_SMOKES.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Execute smoke tests for AI models (do not print secrets).
   Write 03_FOUNDRY_MODEL_SMOKES_REPORT.md

   Return: List of reachable models and JSON validation status"

Task Agent 4b:
- Prompt: 04_ZOHO_SANDBOX_SMOKES.md
- Model: opus
- Description: "Zoho Books connectivity smoke tests"
- run_in_background: true
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/04_ZOHO_SANDBOX_SMOKES.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Execute GET-only checks (do not print secrets).
   Write 04_ZOHO_SANDBOX_SMOKES_REPORT.md

   Return: Zoho connectivity status and endpoint verification"
```

**Wait for both to complete using TaskOutput.**

---

### Phase 5: Admin Handoff (Sequential + STOP)

```
Task Agent 5:
- Prompt: 11_PIPPA_TENANT_CHECKLIST.md
- Model: opus
- Description: "Generate Pippa admin checklist"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/11_PIPPA_TENANT_CHECKLIST.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Generate PIPPA_ADMIN_CHECKLIST.md with:
   - App Registration steps for Pippa of London tenant
   - Azure Bot creation steps
   - Secure credential transfer instructions

   Write to: /data/order-processing/_codex_predeploy/${OP_RUN_ID}/PIPPA_ADMIN_CHECKLIST.md

   Return: Checklist file path and summary"
```

### ⛔ MANDATORY STOP GATE

After Phase 5 completes:

1. **Check if credentials exist:**
   ```bash
   grep -q "MICROSOFT_APP_ID" /data/order-processing/.env && echo "READY" || echo "WAITING"
   ```

2. **If WAITING:**
   - Log status: "STOPPED - Waiting for admin work"
   - Output the checklist location
   - Print instructions:
     ```
     ═══════════════════════════════════════════════════════════════
     ║ DEPLOYMENT PAUSED - MANUAL ADMIN WORK REQUIRED              ║
     ║                                                             ║
     ║ 1. Send PIPPA_ADMIN_CHECKLIST.md to:                        ║
     ║    antonio@pippaoflondon.co.uk                              ║
     ║                                                             ║
     ║ 2. Wait for admin to:                                       ║
     ║    - Create App Registration in Pippa of London tenant      ║
     ║    - Create Azure Bot resource                              ║
     ║    - Send credentials securely                              ║
     ║                                                             ║
     ║ 3. Update .env with:                                        ║
     ║    MICROSOFT_APP_ID=<app-id>                                ║
     ║    MICROSOFT_APP_PASSWORD=<secret>                          ║
     ║                                                             ║
     ║ 4. Resume deployment by running this prompt again           ║
     ═══════════════════════════════════════════════════════════════
     ```
   - **EXIT** - Do not continue to Phase 6

3. **If READY:**
   - Continue to Phase 6

---

### Phase 6: Post-Manual Validation (Sequential)

```
Task Agent 6:
- Prompt: 14_POST_MANUAL_VALIDATION.md
- Model: opus
- Description: "Validate admin work completed"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/14_POST_MANUAL_VALIDATION.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Validate:
   1. MicrosoftAppId exists and is GUID format
   2. MicrosoftAppPassword exists
   3. Token acquisition from Microsoft succeeds
   4. Bot service responds on port 3978

   CRITICAL: If validation fails, STOP and report what needs fixing.

   Write 14_POST_MANUAL_VALIDATION_REPORT.md

   Return: PASS or FAIL with details"
```

**If validation fails, STOP deployment.**

---

### Phase 7: Teams Build & Readiness (Sequential → Parallel)

**First, build the package:**

```
Task Agent 7a:
- Prompt: 10_TEAMS_PACKAGE_BUILD.md
- Model: opus
- Description: "Build Teams app package"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/10_TEAMS_PACKAGE_BUILD.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Build teams-app.zip with MicrosoftAppId from .env
   Write 10_TEAMS_PACKAGE_BUILD_REPORT.md

   Return: Package location and manifest validation status"
```

**Then validate (✅ PARALLEL):**

```
Task Agent 7b:
- Prompt: 05_TEAMS_READINESS.md
- Model: opus
- Description: "Teams bot readiness"
- run_in_background: true
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/05_TEAMS_READINESS.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Write 05_TEAMS_READINESS_REPORT.md
   Return: Bot readiness status"

Task Agent 7c:
- Prompt: 06_TAB_READINESS.md
- Model: opus
- Description: "Personal tab readiness"
- run_in_background: true
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/06_TAB_READINESS.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Write 06_TAB_READINESS_REPORT.md
   Return: Tab readiness status"
```

---

### Phase 8: Golden File Validation (Sequential)

```
Task Agent 8:
- Prompt: 12_GOLDEN_FILE_VALIDATION.md
- Model: opus
- Description: "Parser golden file tests"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/12_GOLDEN_FILE_VALIDATION.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   If golden files not found, mark as SKIP (not FAIL).
   Write 12_GOLDEN_FILE_VALIDATION_REPORT.md

   Return: Test results or SKIPPED status"
```

---

### Phase 9: Aggregate Report (Sequential - Final)

```
Task Agent 9:
- Prompt: 07_AGGREGATE_REPORT.md
- Model: opus
- Description: "Generate final aggregate report"
- Instructions:
  "Read and execute /data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/07_AGGREGATE_REPORT.md

   Working directory: /data/order-processing
   Run ID: ${OP_RUN_ID}

   Aggregate all reports from: /data/order-processing/_codex_predeploy/${OP_RUN_ID}/
   Write REPORT_FINAL.md and STATUS.json

   Return: Overall deployment status and next actions"
```

---

### Logging Protocol

After **each phase** completes, append to the daily log:

```bash
cat >> "${LOG_FILE}" << EOF
| Phase X | $(date +%H:%M) | PASS/FAIL | Summary |
EOF
```

After **all phases** complete, write final summary:

```bash
cat >> "${LOG_FILE}" << EOF

### Deployment Complete
- Status: SUCCESS/PARTIAL/FAILED
- Reports: /data/order-processing/_codex_predeploy/${OP_RUN_ID}/
- Final Report: REPORT_FINAL.md

### Files Modified
| File | Changes |
|------|---------|
| (list modified files) |

### Pending Actions
- (list any remaining manual steps)

EOF
```

---

## TodoWrite Structure

Initialize at start:

```javascript
[
  { content: "Phase 1: VM Foundation", status: "pending", activeForm: "Running VM Foundation" },
  { content: "Phase 2: Azure Access & Containers", status: "pending", activeForm: "Running Azure Access" },
  { content: "Phase 3: SSL Provisioning", status: "pending", activeForm: "Running SSL Provisioning" },
  { content: "Phase 4: Integration Tests", status: "pending", activeForm: "Running Integration Tests" },
  { content: "Phase 5: Admin Handoff", status: "pending", activeForm: "Generating Admin Checklist" },
  { content: "Phase 6: Post-Manual Validation", status: "pending", activeForm: "Validating Credentials" },
  { content: "Phase 7: Teams Build & Readiness", status: "pending", activeForm: "Building Teams Package" },
  { content: "Phase 8: Golden File Validation", status: "pending", activeForm: "Running Parser Tests" },
  { content: "Phase 9: Aggregate Report", status: "pending", activeForm: "Generating Final Report" }
]
```

Update status as each phase executes.

---

## Error Handling

If any Task agent fails:

1. **Log the failure** with full error details
2. **Check if blocker:**
   - Phases 1-3: BLOCKER - cannot continue
   - Phase 4: WARNING - can continue
   - Phases 5-6: BLOCKER - cannot continue
   - Phase 7-8: WARNING - document and continue
3. **Update TodoWrite** with failure status
4. **Report to user** with recommended fix

---

## Resume Instructions

If deployment was stopped at Phase 5 (admin work):

1. Verify credentials are set:
   ```bash
   grep "MICROSOFT_APP_ID" /data/order-processing/.env
   ```
2. Start from Phase 6 directly
3. Use existing OP_RUN_ID from previous run

---

## Start Execution

**Begin by:**
1. Setting up OP_RUN_ID and log file (direct execution)
2. Initializing TodoWrite with all phases
3. Delegating Phase 1 to first Task agent

**Do not ask for confirmation - start immediately.**
