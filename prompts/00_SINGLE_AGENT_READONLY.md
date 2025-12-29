Use Zen MCP `clink` with `cli_name=codex` (or `claude`). Treat this as an autonomous task.

Work **read-only** against `/data/order-processing`.

Do this end-to-end (don’t ask questions unless blocked):

1) Capture a complete project snapshot (do not create or modify files):
   - `pwd`, `whoami`, `date -Is`, `uname -a`
   - `ls -la /data/order-processing`
   - `find /data/order-processing -maxdepth 3 -type f -printf '%p\t%k KB\n' | sort`
   - If git repo: `git -C /data/order-processing status --porcelain=v1`, `git -C /data/order-processing rev-parse HEAD`

2) Read and summarise current state from these files (if present):
   - `/data/order-processing/README.md`
   - `/data/order-processing/SOLUTION_DESIGN.md`
   - `/data/order-processing/MVP_AND_HOWTO.md`
   - `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md`
   - `/data/order-processing/WHAT_WE_NEED_TO_KNOW.md`
   - `/data/order-processing/MODEL_ACCESS_REPORT_2025-12-20.md`
   - `/data/order-processing/azure-ai-foundry-model-catalog-2025-12-25.md`

3) Determine whether application code exists:
   - list likely code dirs: `app/`, `src/`, `infra/`, `packages/`, `teams/`, `bot/`, `functions/`, `containerapps/`.
   - if code exists, run only *read-only* checks: list package files, list build scripts; do not install dependencies.

4) Azure environment readiness (read-only):
   - `az account show` (if logged in; otherwise note)
   - `az group list -o table`
   - list key resources only (filter if output too large): Storage, KeyVault, AppInsights/Log Analytics, Functions/Container Apps, Service Bus, Cosmos DB, AI Search, Bot Service, Cognitive Services / Azure OpenAI / Foundry.

5) Foundry readiness (read-only):
   - infer intended orchestrator/committee/embedding/OCR/STT models from the local model catalogue files
   - identify any mismatch between intended architecture and what is deployed

6) Teams readiness:
   - search for Teams app manifest(s): `manifest.json`, `appPackage/manifest.json`, `teamsapp.yml`, Teams Toolkit artefacts
   - confirm the docs cover cross-tenant steps (Tenant A hosting vs Tenant B install)

7) Zoho readiness:
   - confirm sandbox config/token file exists but **do not print it**
   - confirm endpoints are EU and Draft orders only

8) Security and retention:
   - confirm requirement for ≥5 years blob retention and debug-level audit trails is documented
   - scan repo for accidental secrets (redact any matches): search for strings like `refresh_token`, `client_secret`, `Authorization:`

9) Print a structured report to stdout:
   - Where we are (planning vs implementation)
   - What exists
   - What is missing
   - Blockers
   - Recommended next steps

Output requirements:
- Show the exact commands you ran.
- Redact secrets.
- Finish with a short “where we are / what’s next” summary.
