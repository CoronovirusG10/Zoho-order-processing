# Codex Predeployment Audit Prompt Pack

This folder contains a parallelisable set of prompts for **OpenAI Codex (CLI or Cloud)** to perform a **read‑only predeployment readiness audit** for the Azure-only Teams → Foundry Agents/Workflows → Zoho Books solution.

## What this pack produces

When you run the prompts, they will create:

- `/data/order-processing/_predeploy_codex/`
  - `logs/` (per-task summaries)
  - `evidence/` (sanitised command outputs)
  - `reports/` (final readiness + deployment runbook)
  - `artefacts/` (generated config matrices, smoke test plan, etc.)

## Recommended way to run (Codex CLI on the VM)

This is the most reliable approach because:
- the tasks need access to `/data/order-processing/`
- the tasks need access to `az` CLI and your current Azure login context

### 1) Install / verify Codex CLI (if not already installed)

Follow the official docs for installation. (See `links.md`.)

### 2) Run prompts in parallel

Open **8 terminal sessions** (or use tmux), and run one prompt per session using `codex exec`.

Example (adjust model choice as you like):

```bash
cd /data/order-processing

# Create the output folder (Prompt 00 does this too)
mkdir -p /data/order-processing/_predeploy_codex

# In Terminal 1:
codex exec --model gpt-5.1-codex --sandbox workspace-write --ask-for-approval on-request --cd /data/order-processing "$(cat /path/to/00_ORCHESTRATOR.md)"

# In Terminal 2..9 (one per prompt file):
codex exec --model gpt-5.1-codex --sandbox workspace-write --ask-for-approval on-request --cd /data/order-processing "$(cat /path/to/prompts/01_REPO_AUDIT.md)"
...
```

Notes:
- `--sandbox workspace-write` allows the agent to write outputs under the repo/workspace.
- Keep approvals ON (`--ask-for-approval on-request` or `untrusted`) so nothing risky runs without you seeing it.

### 3) Run the aggregator last

After prompts 01–08 complete, run `prompts/09_AGGREGATE_AND_RUNBOOK.md` to produce the final reports.

## Alternative: Codex Cloud tasks

Codex Cloud runs each task in its own sandbox “environment” preloaded with your repository.
If you use Cloud tasks:
- Run prompts 01–08 as separate tasks.
- Each task should upload its generated report artefacts back to the repo (commit) OR paste the final markdown output into your ticketing system.
- Then run prompt 09 in a final task to consolidate.

Cloud tasks may not have your Azure CLI login context by default; prefer CLI on the VM for Azure inspection.

## Safety / secrecy rules (non-negotiable)

- Do not print or paste secrets (Zoho refresh tokens, client secrets, Teams secrets, etc.).
- Redact any bearer tokens from logs and evidence.
- The Zoho sandbox token JSON file must be treated as a secret and should end up in Key Vault for real deployments.

## Prompt files

- `00_ORCHESTRATOR.md` — creates folders + sets global rules.
- `prompts/01_REPO_AUDIT.md` — repo structure, builds/tests, secret scanning.
- `prompts/02_IAC_AUDIT.md` — IaC validation + what-if/plan only.
- `prompts/03_AZURE_BASELINE.md` — subscription, RGs, Key Vault, Storage, App Insights.
- `prompts/04_FOUNDRY_AUDIT.md` — Foundry models, workflows, capability hosts (read-only).
- `prompts/05_TEAMS_AUDIT.md` — Teams manifest, bot/personal tab, cross-tenant plan consistency.
- `prompts/06_ZOHO_AUDIT.md` — Zoho sandbox reachability (GET-only).
- `prompts/07_SECURITY_GOVERNANCE.md` — least privilege, blob retention/immutability, logging.
- `prompts/08_MULTIMODAL_READY.md` — Excel/image/voice pipeline readiness checks.
- `prompts/09_AGGREGATE_AND_RUNBOOK.md` — compiles readiness report + deployment runbook.

## Links

See `instructions/links.md` for canonical reference links.
