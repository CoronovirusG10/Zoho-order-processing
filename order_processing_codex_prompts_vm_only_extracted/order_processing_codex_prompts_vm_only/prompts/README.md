# Codex VM Deployment Prompts

This directory contains prompts for deploying and verifying the Order Processing system using OpenAI Codex CLI.

## Overview

These prompts are designed to be run by Codex on the target VM (processing.pippaoflondon.co.uk) to automate deployment verification and configuration tasks.

## Two-Tenant Architecture

| Tenant | ID | Role |
|--------|-----|------|
| **360innovate** | 545acd6e-7392-4046-bc3e-d4656b7146dd | Azure infrastructure (VM, Storage, Cosmos, Key Vault) |
| **Pippa of London** | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e | Bot registration, Teams users, Teams app |

**CRITICAL:** Azure Bot must be registered in Pippa of London tenant due to Microsoft's July 31, 2025 multi-tenant bot deprecation.

## Consensus-Validated Sequencing

This sequencing was validated by a 3-model consensus (Gemini-3-pro-preview, DeepSeek-V3.2-Speciale, o3-pro) with unanimous APPROVE_WITH_CHANGES (8/10 average confidence).

```
PHASE 1: VM Foundation
  01_VM_FOUNDATION
    - Install Docker, nginx, PM2
    - Start Temporal containers
    - Skip SSL-dependent health checks initially

PHASE 2: Azure Access & Containers
  02_MI_AZURE_ACCESS (verify permissions)
    ↓
  08_CONTAINERS_SETUP (create Cosmos/Blob + Temporal namespace)

PHASE 3: SSL
  09_SSL_PROVISIONING (certbot after nginx exists)

PHASE 4: Integrations (parallel)
  03_FOUNDRY_MODEL_SMOKES
  04_ZOHO_SANDBOX_SMOKES

PHASE 5: Admin Handoff
  11_PIPPA_TENANT_CHECKLIST (output for admin)
    ↓
  ══════════════════════════════════════════════
  ║  STOP - Wait for Manual Admin Work         ║
  ║  (antonio@pippaoflondon.co.uk)            ║
  ║  - Create App Registration                 ║
  ║  - Create Azure Bot                        ║
  ║  - Send credentials to DevOps              ║
  ║  - DevOps updates .env on VM               ║
  ══════════════════════════════════════════════
    ↓
PHASE 6: Post-Manual Validation
  14_POST_MANUAL_VALIDATION (verify credentials, token acquisition)

PHASE 7: Teams Build & Readiness
  10_TEAMS_PACKAGE_BUILD (uses App ID from .env)
    ↓
  05_TEAMS_READINESS (validate package)
  06_TAB_READINESS (parallel)

PHASE 8: Final Validation
  12_GOLDEN_FILE_VALIDATION

PHASE 9: Aggregate
  07_AGGREGATE_REPORT

PHASE 10: Production (separate run, later)
  13_PRODUCTION_DEPLOY
```

## Prompt Files

| Prompt | Purpose | Dependencies |
|--------|---------|--------------|
| [00_ALL_IN_ONE_VM_DEPLOY_DEV.md](00_ALL_IN_ONE_VM_DEPLOY_DEV.md) | Combined deployment (dev only) | None |
| [01_VM_FOUNDATION.md](01_VM_FOUNDATION.md) | Docker, PM2, nginx setup | None |
| [02_MI_AZURE_ACCESS.md](02_MI_AZURE_ACCESS.md) | Managed Identity Azure access | After 01 |
| [03_FOUNDRY_MODEL_SMOKES.md](03_FOUNDRY_MODEL_SMOKES.md) | AI model connectivity tests | After 02 |
| [04_ZOHO_SANDBOX_SMOKES.md](04_ZOHO_SANDBOX_SMOKES.md) | Zoho Books connectivity tests | After 02 |
| [05_TEAMS_READINESS.md](05_TEAMS_READINESS.md) | Teams bot validation | After 10, 14 |
| [06_TAB_READINESS.md](06_TAB_READINESS.md) | Personal tab validation | After 10 |
| [07_AGGREGATE_REPORT.md](07_AGGREGATE_REPORT.md) | Combined final report | After all others |
| [08_CONTAINERS_SETUP.md](08_CONTAINERS_SETUP.md) | Cosmos/Blob/Temporal setup | After 02 |
| [09_SSL_PROVISIONING.md](09_SSL_PROVISIONING.md) | SSL certificate provisioning | After 01 |
| [10_TEAMS_PACKAGE_BUILD.md](10_TEAMS_PACKAGE_BUILD.md) | Build teams-app.zip | After 11, 14 |
| [11_PIPPA_TENANT_CHECKLIST.md](11_PIPPA_TENANT_CHECKLIST.md) | Admin checklist for Pippa tenant | Early |
| [12_GOLDEN_FILE_VALIDATION.md](12_GOLDEN_FILE_VALIDATION.md) | Parser accuracy tests | After services running |
| [13_PRODUCTION_DEPLOY.md](13_PRODUCTION_DEPLOY.md) | Production deployment prep | Separate phase |
| [14_POST_MANUAL_VALIDATION.md](14_POST_MANUAL_VALIDATION.md) | Verify admin work completed | After admin work |

## Usage

### Option A: All-in-One (Dev/Sandbox)

Run the combined prompt for dev environment:

```bash
codex --sandbox workspace-write --ask-for-approval on-request \
  -p "$(cat 00_ALL_IN_ONE_VM_DEPLOY_DEV.md)"
```

### Option B: Individual Prompts (Recommended for Production)

Run prompts in sequence, following the phase order above:

```bash
# Phase 1
codex --sandbox workspace-write -p "$(cat 01_VM_FOUNDATION.md)"

# Phase 2
codex --sandbox workspace-write -p "$(cat 02_MI_AZURE_ACCESS.md)"
codex --sandbox workspace-write -p "$(cat 08_CONTAINERS_SETUP.md)"

# Phase 3
codex --sandbox workspace-write -p "$(cat 09_SSL_PROVISIONING.md)"

# Phase 4 (parallel)
codex --sandbox workspace-write -p "$(cat 03_FOUNDRY_MODEL_SMOKES.md)" &
codex --sandbox workspace-write -p "$(cat 04_ZOHO_SANDBOX_SMOKES.md)" &
wait

# Phase 5
codex --sandbox workspace-write -p "$(cat 11_PIPPA_TENANT_CHECKLIST.md)"

# === STOP HERE - Manual admin work required ===
# Send PIPPA_ADMIN_CHECKLIST.md to antonio@pippaoflondon.co.uk
# Wait for admin to complete and provide credentials
# Update .env with MicrosoftAppId and MicrosoftAppPassword
# ================================================

# Phase 6
codex --sandbox workspace-write -p "$(cat 14_POST_MANUAL_VALIDATION.md)"

# Phase 7
codex --sandbox workspace-write -p "$(cat 10_TEAMS_PACKAGE_BUILD.md)"
codex --sandbox workspace-write -p "$(cat 05_TEAMS_READINESS.md)" &
codex --sandbox workspace-write -p "$(cat 06_TAB_READINESS.md)" &
wait

# Phase 8
codex --sandbox workspace-write -p "$(cat 12_GOLDEN_FILE_VALIDATION.md)"

# Phase 9
codex --sandbox workspace-write -p "$(cat 07_AGGREGATE_REPORT.md)"

# Phase 10 (separate, later)
# codex --sandbox workspace-write -p "$(cat 13_PRODUCTION_DEPLOY.md)"
```

## Output Location

All prompts write outputs to:
```
/data/order-processing/_codex_predeploy/${OP_RUN_ID}/
```

Where `OP_RUN_ID` is a UTC timestamp set at the start of the run.

## Key Architecture

| Component | Value |
|-----------|-------|
| VM Domain | processing.pippaoflondon.co.uk |
| Bot Messaging Endpoint | https://processing.pippaoflondon.co.uk/api/messages |
| Temporal Namespace | order-processing |
| Key Vault | pippai-keyvault-dev |
| Storage Account | pippaistoragedev |
| Cosmos Account | cosmos-visionarylab |

## Validation Source

These prompts were validated via Zen MCP consensus on 2025-12-29:
- Gemini-3-pro-preview: APPROVE_WITH_CHANGES (9/10)
- DeepSeek-V3.2-Speciale: APPROVE_WITH_CHANGES (8/10)
- o3-pro: APPROVE_WITH_CHANGES (7/10)

See `/data/order-processing/prompts/CODEX_PROMPTS_REVISION_HANDOFF.md` for full analysis.
