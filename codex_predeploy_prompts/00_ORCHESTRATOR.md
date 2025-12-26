# Codex — Predeployment Orchestrator Prompt (READ‑ONLY)

You are Codex running on a VM with shell access.

## Mission

Perform a **read‑only** predeployment readiness audit for the system described in `/data/order-processing/`.

Do **not** deploy anything. Do **not** create/update/delete Azure resources. Do **not** create Zoho orders. Do **not** print secrets.

After the audit is complete, you will produce **deployment instructions only** (runbook). Still do not deploy.

## Hard rules

1) READ‑ONLY with respect to Azure, Zoho, and Microsoft 365:
   - You may run `az`, `curl`, etc, but **only** listing, `what-if`, or GET operations.
   - No `PUT/POST/PATCH/DELETE` against production services.
   - For Zoho: GET-only health checks; no order creation.

2) Local filesystem:
   - You may create folders and write audit reports **only** under:
     - `/data/order-processing/_predeploy_codex/`
   - Do not modify existing design docs except to copy them into evidence folders if necessary.

3) Secrets:
   - Treat any file named like `zoho_books_tokens*.json` as a secret.
   - Never print tokens, client secrets, refresh tokens, or auth headers.
   - If you must confirm a key exists, print only a redacted form, e.g. last 4 chars.

4) Evidence:
   - Every assertion in the readiness report must include:
     - command(s) run
     - sanitised output snippet
     - file path to the evidence artefact

## Working directory and output folders

Work in: `/data/order-processing`

Create (if missing):

- `/data/order-processing/_predeploy_codex/`
  - `logs/`
  - `evidence/`
  - `reports/`
  - `artefacts/`

Also create an index file:

- `/data/order-processing/_predeploy_codex/logs/00_INDEX.md`

The index must include:
- UTC timestamp
- repo path
- detected git commit hash (if any)
- subscription id (redacted if needed)
- list of prompts executed + their output paths

## Inputs (local)

Use these as authoritative local evidence if present:
- `/data/order-processing/README.md`
- `/data/order-processing/SOLUTION_DESIGN.md`
- `/data/order-processing/MVP_AND_HOWTO.md`
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md`
- `/data/order-processing/WHAT_WE_NEED_TO_KNOW.md`
- `/data/order-processing/AZURE_MODEL_INVENTORY.md`
- `/data/order-processing/MODEL_ACCESS_REPORT_2025-12-20.md`
- `/data/order-processing/azure-ai-foundry-model-catalog-2025-12-25.md` (if present)

If some are missing, record that.

## Execution plan

You will NOT do all work in one go. This orchestrator prompt only:
1) creates folders
2) writes the index file skeleton
3) prints the recommended parallel execution plan:
   - which prompt files to run (01–08)
   - suggested terminal commands to run them with `codex exec`
4) then exits.

Do NOT run the full audit here; that is done by prompts 01–08.

## Step-by-step

1) Confirm you can access `/data/order-processing` and list files.
2) Create the output folder structure.
3) Detect git repo status (if any) and record commit hash.
4) Run `az account show` (redact tenant/subscription ids only if required by policy; otherwise record them).
5) Write `/data/order-processing/_predeploy_codex/logs/00_INDEX.md` with the above.
6) Print the parallel run instructions.

## Output format

- Create the folders and index file on disk.
- Print a short “Next steps” section that tells the operator exactly which prompt files to run in parallel.
