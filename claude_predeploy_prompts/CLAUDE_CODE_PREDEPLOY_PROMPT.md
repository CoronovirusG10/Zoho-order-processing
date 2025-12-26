# Claude Code Prompt — Predeployment Readiness Audit + Deployment Runbook (Azure AI Foundry Agents + Teams + Zoho Books)

## Context
You are operating on a VM with the project files under:

- `/data/order-processing/` (v1 docs + artefacts)
- `/data/order-processing/v2/` (v2 docs + artefacts)

This system’s purpose: Salespeople send **orders** to a 1:1 **Microsoft Teams** chat bot as:
- Excel spreadsheets (.xlsx) **today**
- plus **free‑text**, **photos/scans/PDFs**, and **voice notes** **soon**

The app must:
- extract/validate order data with strict grounding and strong audit trails
- ask the user for corrections in Teams when needed
- create a **Draft Sales Order** in **Zoho Books** (EU endpoint) via API
- retain **all logs, files, and artefacts** in **Azure Blob Storage** (≥ 5 years retention)
- operate cross‑tenant (bot/app in Tenant A, Teams users in Tenant B)

You must run a **predeployment readiness audit** (read‑only; no resource creation/modification) and then produce a **deployment runbook** (instructions only; do not deploy).

### Non‑negotiables
- **DO NOT** create, update, delete, or deploy anything.
- **DO NOT** print secrets (tokens, client secrets, refresh tokens, API keys).
- **DO NOT** commit secrets or copy secrets into markdown.
- All findings must include **evidence**: commands run + relevant snippets (sanitised).
- Work must be **logged** exactly per `claude.md` in the repo. If missing, create it and follow the new file for the remainder of the work.

---

## Primary documentation references (use for verification; treat as source of truth)
Use these docs to validate any assumptions about Foundry Agents, workflow capabilities, capability hosts, and hosted agents.

```text
https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/workflow?view=foundry
https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/capability-hosts?view=foundry
https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry&tabs=cli
```

Key points to validate explicitly from the docs:
- Workflows templates (Human‑in‑the‑loop / Sequential / Group chat), node types, and strict JSON schema output support.
- Capability host requirements (Cosmos DB for thread storage, AI Search for vector store, Storage account for files), hierarchy (account vs project), and the constraint that updates aren’t supported (delete & recreate).
- Hosted agents are preview; confirm whether we rely on hosted agents or not; document risk if yes.

---

## Model inventory input
You have these files (do not rewrite; use as evidence):
- `/data/order-processing/azure-ai-foundry-model-catalog-2025-12-25.md`
- `/data/order-processing/MODEL_ACCESS_REPORT_2025-12-20.md`

Treat those as the canonical list of what is deployed and what is available.

---

## Output deliverables
Create a new folder:
- `/data/order-processing/_predeploy/`

Inside it, produce:

1) `PREDEPLOYMENT_READINESS_REPORT.md`
   - A structured checklist with Pass/Fail/Needs‑Action
   - Evidence for every item (command + sanitised output)
   - A “Blockers” section (anything that prevents deployment)
   - A “Risks accepted” section (explicit decisions only)

2) `DEPLOYMENT_RUNBOOK.md`
   - Step-by-step deployment instructions **only** (IaC + app + Foundry + Teams + Zoho)
   - Include “staging first” and “prod” sections
   - Include rollback steps

3) `SMOKE_TEST_PLAN.md`
   - Post‑deployment smoke tests (Teams → upload → parse → correction loop → draft created)
   - Non-destructive Zoho checks (avoid creating real orders; use sandbox + explicit test customer)

4) `CONFIG_MATRIX.md`
   - Full matrix of required config keys (no secret values)
   - Where each value lives (Key Vault secret vs app setting vs config file)
   - Environment-specific differences (dev/test/prod)

5) `OPEN_QUESTIONS.md`
   - Any remaining unknowns that must be answered before prod
   - For each: who answers, where to check, how to validate

---

## Concurrency plan (critical)
Use a **CTO Orchestrator** and spawn specialised subagents in parallel. You can use up to ~100 concurrent sessions; keep it sane:

- CTO Orchestrator: integrates outputs, enforces constraints, produces final deliverables.
- Subagents (run in parallel):
  A. Repo & build system audit
  B. IaC audit (Bicep/Terraform/azd) + “what-if” validation (NO deployments)
  C. Azure resource readiness audit (read-only)
  D. Azure AI Foundry readiness (agents/workflows/capability hosts/models)
  E. Teams app readiness (manifest, bot, personal tab, file handling, cross-tenant)
  F. Zoho Books sandbox readiness (OAuth, endpoints, minimal GET health checks)
  G. Security & governance audit (Key Vault, MI/RBAC, logging, retention/immutability)
  H. Multimodal pipeline readiness (Excel, images/OCR, voice/STT; stubs allowed)

Each subagent must:
- write a short summary to `/data/order-processing/_predeploy/logs/<agent>.md`
- write evidence outputs to `/data/order-processing/_predeploy/evidence/<agent>/...`
- never include secrets in logs/evidence (redact aggressively)

---

## Step 0 — Setup logging
1) Locate `claude.md` in the repo (search root and `.claude/`).
2) Create `/data/order-processing/_predeploy/` and subfolders:
   - `logs/`
   - `evidence/`
   - `artefacts/`
3) Start an index log: `logs/00_INDEX.md` listing:
   - timestamp
   - git commit hash (if repo exists)
   - subagents launched
   - files created

---

## Subagent instructions (detailed)

### A) Repo & build audit (read-only)
Goal: confirm a deployable application exists and can be built reproducibly.

Checklist:
- Identify the actual codebase root (it may not exist; if missing, mark as Blocker).
- Detect language/runtime (Node/TS vs Python vs .NET) and toolchain (pnpm/poetry/dotnet).
- Confirm:
  - linting configured
  - unit tests exist (parsers, validation, schema inference)
  - golden-file tests exist (at least placeholders)
  - CI pipeline defined (GitHub Actions/Azure DevOps)
  - Dockerfiles exist if container deployment is intended
- Secret scanning:
  - ensure `/data/order-processing/zoho_books_tokens-*.json` is gitignored
  - scan repo for accidental secrets (client_secret, refresh_token, API keys)
- Output:
  - `logs/A_repo.md` summary
  - `evidence/A_repo/` with `tree.txt`, `git_status.txt`, `secret_scan.txt`

Commands (examples; adapt):
- `cd /data/order-processing && find . -maxdepth 3 -type f | sort`
- `git rev-parse HEAD` (if git)
- `rg -n "(client_secret|refresh_token|api_key|Bearer\s+[A-Za-z0-9_\-\.]+)" .` (redact outputs)

---

### B) IaC audit + what-if validation (NO deploy)
Goal: ensure infrastructure definition exists and matches the design.

Checklist:
- Identify IaC type: Bicep/Terraform/azd/ARM.
- Validate:
  - resource group(s) naming
  - region set to **Sweden Central**
  - environment separation dev/test/prod
  - Key Vault, Storage, App Insights, Functions/Container Apps, Service Bus/Queues (if used), Cosmos DB (if used), AI Search (if using capability host)
- Run *what-if* / plan commands only.
- Output:
  - `logs/B_iac.md`
  - `evidence/B_iac/` with plan outputs

Commands (examples; adapt):
- `az bicep build --file <main.bicep>`
- `az deployment group what-if ...` (must be what-if only)
- `terraform validate && terraform plan` (if terraform)

---

### C) Azure readiness audit (read-only)
Goal: confirm subscription, RGs, identities, and baseline services exist for deployment.

Checklist:
- Validate Azure CLI logged in and correct subscription selected.
- Verify:
  - RG(s) exist (or will be created)
  - Storage account exists for audit + file retention
  - Key Vault exists
  - Application Insights / Log Analytics exists
  - Managed identity strategy defined (system-assigned or user-assigned)
  - Network restrictions (if any) are compatible with external APIs (Gemini/Anthropic/xAI) and Zoho EU endpoints.
- Output:
  - `logs/C_azure.md`
  - `evidence/C_azure/` with `az` outputs (redacted)

Suggested commands:
- `az account show`
- `az group list -o table`
- `az resource list -g <rg> -o table`
- `az storage account list -o table`
- `az keyvault list -o table`
- `az monitor app-insights component show ...` (if exists)

---

### D) Azure AI Foundry readiness (agents/workflows/capability hosts/models)
Goal: confirm Foundry project and models align with the intended architecture.

Checklist:
- Using the model catalog files, confirm required deployments exist:
  - Orchestrator: `gpt-5.1` (AgentAI deployment)
  - Committee models (Azure): `o3`, `claude-opus-4-5`
  - OCR: `mistral-document-ai` and/or `gpt-4o` vision
  - STT: `gpt-4o-transcribe` (plus diarize if needed)
  - Embeddings: `Cohere-embed-v3-multilingual`
- Confirm whether the design uses:
  - Foundry “prompt-based” agents + tools (preferred for prod), OR
  - Hosted agents (containerised) — document that hosted agents are preview and not recommended for production unless explicitly accepted.
- Capability hosts:
  - Determine if capability host is required (we want BYO storage for retention and sovereignty).
  - If required, verify both account-level and project-level capability hosts exist and are configured for:
    - thread storage (Cosmos DB)
    - vector store (AI Search)
    - storage (Storage account)
  - Confirm all these resources are in Sweden Central and consistent with VNet needs.
- Workflows:
  - Determine if Workflows are used (human-in-loop / sequential / group chat).
  - If used, verify strict JSON schema output is configured for agent nodes; capture the schema.
- Output:
  - `logs/D_foundry.md`
  - `evidence/D_foundry/` with model list, project info, capability host config (redacted)

Commands:
- Locate any existing scripts that produced the model catalog. Re-run them read-only if available.
- Otherwise use `az resource list` / Foundry CLI/SDK where available.
- If SDK code exists, run a “list agents/workflows” call (read-only).

---

### E) Teams app readiness (cross-tenant, 1:1 chat + personal tab)
Goal: validate the Teams app package and bot approach works cross‑tenant given post‑2025 bot identity changes.

Checklist:
- Confirm bot approach:
  - New multi-tenant bot creation is deprecated after 31 July 2025 (so we must be single-tenant or user-assigned MI and use an approved cross-tenant distribution pattern).
  - Confirm our plan uses a supported distribution approach (AppSource/store vs org app catalogue in Tenant B) and required admin approvals.
- Verify Teams app artefacts exist:
  - `manifest.json` with bot + personal tab declared
  - valid icons
  - correct `webApplicationInfo` / AAD app IDs if using SSO
- Verify file upload handling:
  - Bot can receive file attachments in 1:1 chat
  - download flow uses Graph “downloadUrl” or the correct attachment retrieval mechanism for the Bot Framework activity (confirm implementation)
- Cross-tenant specifics:
  - Document exactly what must be configured in Tenant A vs Tenant B.
  - Confirm whether SSO is required (if yes, cross-tenant consent becomes more complex).
- Output:
  - `logs/E_teams.md`
  - `evidence/E_teams/` with manifest validation results (no secrets)

Commands:
- Validate manifest schema (Teams Toolkit CLI or JSON schema validation)
- Search repo for Teams toolkit project structure (`appPackage/manifest.json`, `teamsapp.yml`, etc.)

---

### F) Zoho Books sandbox readiness (EU)
Goal: confirm authentication approach and minimal API reachability.

Constraints:
- Use Zoho EU endpoints.
- Do not create any orders in this stage.

Checklist:
- Identify where Zoho tokens are stored:
  - The JSON file under `/data/order-processing/` contains tokens. Confirm it is treated as a secret and not used directly in prod.
  - Verify plan to store refresh token + client secret in Key Vault.
- Confirm we have:
  - organisation_id for sandbox
  - required custom field metadata (if used)
- Minimal health checks (GET only):
  - list organisations
  - list contacts (customers)
  - list items
- Verify rate-limit and retry handling plan exists.

Output:
- `logs/F_zoho.md`
- `evidence/F_zoho/` with redacted responses (IDs ok; tokens redacted)

---

### G) Security & governance audit
Goal: ensure least privilege, secrets management, and audit retention are real.

Checklist:
- Key Vault:
  - all secrets referenced by name only in config
  - MI has `get` permission (RBAC preferred)
- Storage:
  - audit container exists / will exist
  - retention policy ≥ 5 years
  - blob versioning enabled
  - immutability policy / legal hold strategy documented (if required)
- Logging:
  - correlation IDs across Teams → file → extraction → committee → Zoho → result
  - Foundry tracing enabled where applicable
  - copies of raw input (xlsx/images/audio) + extracted evidence packs stored
- PII:
  - explicitly define what is stored long-term (you said no GDPR restrictions, but still avoid secrets)
- Output:
  - `logs/G_security.md`
  - `evidence/G_security/` (configs redacted)

---

### H) Multimodal pipeline readiness (Excel + images + voice)
Goal: verify the plan and code can expand without redesign.

Checklist:
- Excel parser:
  - deterministic extraction library and provenance retained (sheet/cell)
- Images/PDF:
  - OCR path defined (Document Intelligence or mistral-document-ai); evidence bboxes/spans retained
- Voice:
  - STT path defined (`gpt-4o-transcribe`), timestamps retained
- Committee interface:
  - all modalities normalise into the same canonical “evidence pack”
  - models must produce outputs referencing evidence items
- Output:
  - `logs/H_multimodal.md`
  - `evidence/H_multimodal/`

---

## CTO Orchestrator — final assembly instructions
After all subagents complete:

1) Merge all subagent summaries into `PREDEPLOYMENT_READINESS_REPORT.md`:
   - Executive overview
   - Pass/Fail table
   - Blockers
   - Actions required (ordered)
   - Risks/assumptions
   - Evidence index (links to evidence files)

2) Produce `DEPLOYMENT_RUNBOOK.md`:
   - IaC deployment (commands only; no execution)
   - App deployment (Functions/Container Apps/Bot)
   - Foundry setup (agents/workflows/capability hosts)
   - Teams packaging + deployment in Tenant B
   - Key Vault secret population (commands templates)
   - Post-deploy smoke tests and rollback

3) Produce `SMOKE_TEST_PLAN.md`, `CONFIG_MATRIX.md`, `OPEN_QUESTIONS.md`.

4) Ensure nothing contains secrets. Redact any accidental values.

---

## Success criteria for “Ready to deploy”
Only mark “Ready” if ALL are true:
- Codebase exists and builds locally with tests.
- IaC validates (what-if/plan) with no critical errors.
- Foundry models and project are confirmed in Sweden Central; required deployments exist.
- Capability host strategy is decided and documented (BYO or Microsoft-managed).
- Teams app manifest validated and cross-tenant plan is unblocked.
- Zoho sandbox GET health checks succeed (no create calls yet).
- Logging + retention plan is implementable in Blob (≥5 years) with correlation IDs.

If any are not true: mark as “NOT READY” and list exact next actions.

---

## Start now
Begin by creating the `_predeploy` folder structure and launching the subagents in parallel.
