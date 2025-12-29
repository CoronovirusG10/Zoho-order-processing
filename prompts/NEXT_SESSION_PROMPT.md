# Claude Code Session Prompt: Complete Codex Prompts Revision

**Copy this entire document as the initial prompt for a new Claude Code session.**

---

## Context

You are continuing work on the order-processing project. A previous session analyzed the Codex deployment prompts and ran a **Zen consensus validation** with three AI models (Gemini-3-pro-preview, DeepSeek-V3.2-Speciale, o3-pro). All three returned **APPROVE_WITH_CHANGES** with 8/10 average confidence.

Your task is to implement the consensus-validated fixes and create missing prompts.

## Working Directory

```
/data/order-processing
```

## Consensus Results Summary

| Model | Verdict | Confidence |
|-------|---------|------------|
| Gemini-3-pro-preview | APPROVE_WITH_CHANGES | 9/10 |
| DeepSeek-V3.2-Speciale | APPROVE_WITH_CHANGES | 8/10 |
| o3-pro | APPROVE_WITH_CHANGES | 7/10 |

## Critical Fixes Required (Consensus-Validated)

### 1. Fix Prompt 05 (MANDATORY)
- Replace "Ashtad tenant" → "Pippa of London tenant"
- Replace "(in 360innovate subscription)" → "(in Pippa of London subscription - NOT 360innovate)"

### 2. Fix Sequencing (CRITICAL)
All models agreed:
- 01 (nginx) must run BEFORE 09 (SSL) - certbot needs nginx
- 02 (MI access) must run BEFORE 08 (containers) - verify permissions first
- 11 (admin checklist) must run BEFORE 10 (Teams build) - need App ID first

### 3. Add Missing Validations
- Environment variable verification (MicrosoftAppId, MicrosoftAppPassword)
- Temporal namespace registration
- Post-manual validation step (new prompt 14)
- SSL renewal cron job verification

## Full Analysis Document

Read the complete analysis at:
```
/data/order-processing/prompts/CODEX_PROMPTS_REVISION_HANDOFF.md
```

## Your Tasks

### Task 1: Fix Prompt 05

Edit `/data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/05_TEAMS_READINESS.md`:

```bash
# Apply these fixes:
sed -i 's/Ashtad tenant/Pippa of London tenant/g' 05_TEAMS_READINESS.md
sed -i 's/(in 360innovate subscription)/(in Pippa of London subscription - NOT 360innovate)/g' 05_TEAMS_READINESS.md
```

Also update admin reference to: `antonio@pippaoflondon.co.uk`

### Task 2: Create New Prompts (08-14)

Create these prompts in the same directory, following existing prompt structure:

| Prompt | Purpose | Key Dependencies |
|--------|---------|------------------|
| 08_CONTAINERS_SETUP.md | Create Cosmos/Blob containers + Temporal namespace | After 02 |
| 09_SSL_PROVISIONING.md | certbot + renewal cron verification | After 01 |
| 10_TEAMS_PACKAGE_BUILD.md | Build teams-app.zip with App ID | After 11 + admin work |
| 11_PIPPA_TENANT_CHECKLIST.md | Detailed admin steps for antonio@ | Early in sequence |
| 12_GOLDEN_FILE_VALIDATION.md | Parser tests against golden files | After services running |
| 13_PRODUCTION_DEPLOY.md | Production deployment path | Separate phase |
| **14_POST_MANUAL_VALIDATION.md** | Verify admin work completed (NEW) | After admin updates .env |

### Task 3: Update Sequencing

Update README.md with this consensus-validated sequence:

```
PHASE 1: 01_VM_FOUNDATION
PHASE 2: 02_MI_AZURE_ACCESS → 08_CONTAINERS_SETUP
PHASE 3: 09_SSL_PROVISIONING
PHASE 4: 03, 04 (parallel)
PHASE 5: 11_PIPPA_TENANT_CHECKLIST → STOP for manual admin work
PHASE 6: 14_POST_MANUAL_VALIDATION
PHASE 7: 10_TEAMS_PACKAGE_BUILD → 05_TEAMS_READINESS, 06_TAB_READINESS
PHASE 8: 12_GOLDEN_FILE_VALIDATION
PHASE 9: 07_AGGREGATE_REPORT
PHASE 10: 13_PRODUCTION_DEPLOY (later)
```

### Task 4: Update 00_ALL_IN_ONE

Update the all-in-one prompt to:
- Reflect new phases
- Include STOP gate after Phase 5 for manual admin work
- Add Temporal namespace registration in containers step
- Add post-manual validation after STOP gate resumes

## Prompt Structure Template

Each new prompt should follow this structure:

```markdown
# XX — [Title]

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
[Clear description]

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `XX_[NAME]_REPORT.md`
- `XX_[NAME]_COMMANDS.log`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- [Safety rules]
- Do not print secrets.

## Steps
1) Setup logging helper.
2) [Step 2]
...
N) Write report + paste-back summary.
```

## Key Architecture Details

| Item | Value |
|------|-------|
| VM Domain | pippai-vm.360innovate.com |
| Bot Messaging Endpoint | https://pippai-vm.360innovate.com/api/messages |
| 360innovate Tenant ID | 545acd6e-7392-4046-bc3e-d4656b7146dd |
| Pippa of London Tenant ID | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e |
| Pippa Admin | antonio@pippaoflondon.co.uk |
| Temporal Namespace | order-processing |

## Cosmos Containers Specification

| Container | Partition Key | Purpose |
|-----------|--------------|---------|
| cases | /tenantId | Case state |
| fingerprints | /fingerprint | Idempotency |
| events | /caseId | Audit events |
| agentThreads | /threadId | AI threads |
| committeeVotes | /caseId | Voting |
| cache | /type | Zoho cache |

## Blob Containers Specification

| Container | Purpose | Retention |
|-----------|---------|-----------|
| orders-incoming | Raw Excel files | 5 years |
| orders-audit | Audit bundles | 5 years |
| committee-evidence | AI outputs | 5 years |
| logs-archive | Platform logs | 5 years |

## Consensus Recommendations to Incorporate

### From Gemini:
- Validate MicrosoftAppId/Password format before starting bot
- Consider splitting 01 into 01a (deps) and 01b (services) if needed

### From DeepSeek:
- Tab SSO configuration may be needed in checklist
- Secure credential transfer via Key Vault, not email
- SSL renewal cron job must be verified

### From o3-pro:
- Add Temporal namespace registration: `temporal operator namespace register order-processing`
- Automated Bot Framework API check in validation prompt
- Add monitoring/alerting notes to production prompt

## Do NOT

- Do not run any prompts yet - just create/edit them
- Do not modify Azure resources
- Do not touch production systems
- Do not commit without review

## Output

After completing all tasks:
1. Summarize what was created/modified
2. Show the new file structure
3. Highlight any decisions made
4. Ask for review before committing

## Reference Documents

Read these for additional context if needed:
- `/data/order-processing/prompts/CODEX_PROMPTS_REVISION_HANDOFF.md` (full analysis with consensus)
- `/data/order-processing/docs/UNIFIED_DEPLOYMENT_PLAN.md` (architecture)
- `/data/order-processing/docs/BOT_REGISTRATION_GUIDE_PIPPA.md` (Pippa admin steps)
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md` (cross-tenant strategy)

---

**Start by reading the handoff document, then proceed with the tasks in order.**
