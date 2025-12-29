# 00 — ALL IN ONE: VM Deploy (Dev) + Verification + Report

You are Codex running on a VM. Work in `/data/order-processing`.

## Goal
Execute the **VM-only dev deployment/verification** steps for the order-processing system and produce a report.

This is a dev/sandbox. You may perform write actions (start/restart services, edit configs if required), but:
- do not print secrets (redact tokens/keys)
- do not delete data
- do not create Zoho orders unless `ALLOW_ZOHO_WRITE=1`

## IMPORTANT: Manual Work Gate

This prompt will STOP at Phase 5 if admin work has not been completed. You MUST verify that MicrosoftAppId and MicrosoftAppPassword are set in `.env` before proceeding to Phase 6+.

## Two-Tenant Architecture Reference

| Tenant | ID | Role |
|--------|-----|------|
| **360innovate** | 545acd6e-7392-4046-bc3e-d4656b7146dd | Azure infrastructure (VM, Storage, Cosmos, Key Vault) |
| **Pippa of London** | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e | Bot registration, Teams users, Teams app |

## Output requirements (mandatory)
1) Create folder: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
2) Write:
   - `REPORT_FINAL.md` (main report)
   - `COMMANDS.log` (all commands executed)
   - `STATUS.json` (machine-readable status summary)
3) At the end, print a **Paste-Back Report** markdown block that is <= 200 lines and includes:
   - run id
   - git commit
   - docker/temporal status
   - pm2 status
   - nginx status + TLS status
   - key endpoints results
   - model connectivity summary
   - zoho connectivity summary
   - manual steps remaining (Pippa of London tenant)

If `OP_RUN_ID` is not set, set it to UTC timestamp and export it.

## Step 0 — Setup logging helpers
- `set -euo pipefail`
- define a helper `logcmd()` that appends the command to COMMANDS.log and then runs it.
- all commands must be executed via `logcmd`.

## PHASE 1: VM Foundation

### Step 1 — Project and system discovery (facts)
Run and capture (sanitise outputs as needed):
- `whoami`, `hostname`, `date -Is`, `uname -a`
- `cd /data/order-processing`
- `ls -la`
- `git rev-parse HEAD` and `git status --porcelain=v1` (if git)
- inventory key docs (first 80 lines each):
  - `README.md`
  - `SOLUTION_DESIGN.md`
  - `MVP_AND_HOWTO.md`
  - `CROSS_TENANT_TEAMS_DEPLOYMENT.md`
  - `WHAT_WE_NEED_TO_KNOW.md`
- find service/config roots:
  - `find app -maxdepth 4 -type f -name 'docker-compose*.yml' -o -name 'ecosystem*.config*' -o -name 'nginx*.conf' -o -name 'package.json' | sort`

### Step 2 — Bring up Temporal + PostgreSQL (Docker)
- Locate the temporal compose file (expected: `app/services/workflow/docker-compose.temporal.yml`).
- Run:
  - `docker compose -f <file> up -d`
  - `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
  - `docker compose -f <file> ps`
- Verify Temporal server reachable locally:
  - `nc -zv 127.0.0.1 7233`
  - `curl -fsS http://127.0.0.1:8080/ | head`

If anything fails, show the last 200 lines of the relevant container logs and propose the fix; apply the fix if it's safe.

### Step 3 — PM2 services
Goal: ensure `workflow-api`, `workflow-worker`, and `teams-bot` are running.

- Detect how services are started:
  - look for `ecosystem.config.*`, `pm2` scripts in package.json, or existing pm2 processes.
- If pm2 isn't installed, install it globally (Node dev sandbox ok).
- Start or restart services as intended by repo config.
- Record:
  - `pm2 ls`
  - `pm2 describe <proc>` for each
  - last 200 lines of logs for each (redact secrets):
    - `pm2 logs <proc> --lines 200 --nostream`

### Step 4 — nginx (without TLS check)
- Check nginx:
  - `sudo nginx -t`
  - `systemctl status nginx --no-pager -l | head -n 80`
- Locate active site config and verify routes match the VM architecture:
  - `/api/messages -> localhost:3978`
  - `/api/* -> localhost:3000`
  - `/temporal/ -> localhost:8080`
  - `/health -> localhost:3000/health`
- If config is wrong, fix it and reload nginx:
  - `sudo systemctl reload nginx`

## PHASE 2: Azure Access & Containers

### Step 5 — Azure baseline + Managed Identity checks
- Check Azure CLI availability: `az version`
- Try MI login:
  - `az login --identity` (if this fails, capture error and continue)
- Capture:
  - `az account show` (redact subscription/tenant ids if needed)
  - `az group show -n pippai-rg -o jsonc || true`
  - `az keyvault show -n pippai-keyvault-dev -g pippai-rg -o jsonc || true`
  - `az storage account show -n pippaistoragedev -g pippai-rg -o jsonc || true`
  - `az cosmosdb show -n cosmos-visionarylab -g pippai-rg -o jsonc || true`

Data-plane sanity tests (safe):
- Key Vault: list secret names only:
  - `az keyvault secret list --vault-name pippai-keyvault-dev -o table || true`
- Storage: list containers (auth-mode login):
  - `az storage container list --account-name pippaistoragedev --auth-mode login -o table || true`

If any access is denied, include the exact RBAC role needed (do not change RBAC automatically).

### Step 6 — Containers Setup (Cosmos/Blob/Temporal)
- Verify Cosmos DB database exists, create if needed:
  - `az cosmosdb sql database show --account-name cosmos-visionarylab -g pippai-rg -n order-processing || az cosmosdb sql database create ...`
- Create/verify Cosmos containers:
  - cases (/tenantId), fingerprints (/fingerprint), events (/caseId), agentThreads (/threadId), committeeVotes (/caseId), cache (/type)
- Create/verify Blob containers:
  - orders-incoming, orders-audit, committee-evidence, logs-archive
- Register Temporal namespace:
  - `temporal operator namespace register order-processing || true`
  - `temporal operator namespace describe order-processing`

## PHASE 3: SSL

### Step 7 — SSL Provisioning
- Verify DNS: `dig +short processing.pippaoflondon.co.uk`
- Check existing certificate: `sudo certbot certificates`
- If certificate missing or expiring within 30 days:
  - `sudo certbot --nginx -d processing.pippaoflondon.co.uk --non-interactive --agree-tos -m devops@360innovate.com`
- Verify HTTPS:
  - `curl -I https://processing.pippaoflondon.co.uk/health`
- Verify renewal cron:
  - `systemctl list-timers | grep certbot || cat /etc/cron.d/certbot 2>/dev/null || echo "NO RENEWAL CONFIGURED"`
  - If missing, add: `echo "0 3 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot-renew`
- Test renewal: `sudo certbot renew --dry-run`

## PHASE 4: Integrations (can run in parallel)

### Step 8 — Foundry/AI model connectivity (smoke tests)
Use repo config to locate AI endpoints/keys (do not print secrets).
- Find any "ai config" files and env vars usage:
  - `rg -n "(foundry|azure ai|azure_openai|openai|anthropic|gemini|xai|grok|deepseek|cohere|mistral)" app -S || true`

Run smoke tests:
- Prefer existing scripts (`npm run smoke:*`, `node scripts/*`, etc). If none exist:
  - Create a temporary script under `/tmp` to call:
    - embeddings: Cohere multilingual with an English+Farsi sample
    - one chat completion: gpt-5.1 or o3 (Azure Foundry)
  - Validate the response is parseable JSON if strict mode is expected.

Output must include:
- which models were actually reachable
- whether structured JSON was enforced successfully

### Step 9 — Zoho Books sandbox connectivity (smoke tests)
Rules:
- Do not print token/secret values.
- Default to GET-only checks.
- Only create a draft order if `ALLOW_ZOHO_WRITE=1`.

Steps:
- Locate Zoho config (token file and/or KV references).
- Confirm EU endpoints are used.
- GET checks:
  - Organisations (or a light endpoint your integration uses)
  - Items list (first page only)
  - Contacts/customers search (if implemented)

If `ALLOW_ZOHO_WRITE=1`, create a **clearly labelled TEST draft** using a known test customer+item from config (or skip if not available).

## PHASE 5: Admin Handoff

### Step 10 — Generate Pippa Tenant Admin Checklist
Generate `PIPPA_ADMIN_CHECKLIST.md` with detailed steps for antonio@pippaoflondon.co.uk:
- App Registration creation (single-tenant)
- Azure Bot creation in Pippa of London subscription
- Teams channel configuration
- Secure credential transfer instructions

═══════════════════════════════════════════════════════
║  MANUAL STOP GATE                                   ║
║                                                     ║
║  At this point, check if admin work is complete:    ║
║                                                     ║
║  grep -q "MICROSOFT_APP_ID" .env && echo "READY"   ║
║                                                     ║
║  If NOT READY:                                      ║
║  - Output the checklist                             ║
║  - Stop here with status "WAITING_FOR_ADMIN"        ║
║  - Do not proceed to Phase 6+                       ║
║                                                     ║
║  If READY:                                          ║
║  - Continue to Phase 6                              ║
═══════════════════════════════════════════════════════

## PHASE 6: Post-Manual Validation

### Step 11 — Validate Admin Work
- Verify MicrosoftAppId exists and is GUID format
- Verify MicrosoftAppPassword exists
- Test token acquisition from Microsoft:
  ```bash
  curl -s -X POST "https://login.microsoftonline.com/23da91a5-0480-4183-8bc1-d7b6dd33dd2e/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=${MICROSOFT_APP_ID}&client_secret=${MICROSOFT_APP_PASSWORD}&scope=https://api.botframework.com/.default" \
    | jq -r 'if .access_token then "TOKEN_OK" else "ERROR" end'
  ```
- Verify bot service responds: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3978/api/messages`

If validation fails, stop and report what needs to be fixed.

## PHASE 7: Teams Build & Readiness

### Step 12 — Teams Package Build
- Locate manifest.json
- Replace `{{BOT_APP_CLIENT_ID}}` with MicrosoftAppId from .env
- Validate manifest structure
- Package: `zip teams-app.zip manifest.json color.png outline.png`
- Output package location

### Step 13 — Teams artefacts readiness
- Find Teams app package files (manifest/icons).
- Validate:
  - messaging endpoint matches `https://processing.pippaoflondon.co.uk/api/messages`
  - personal scope bot enabled
  - file upload support enabled if expected
- Produce upload instructions for antonio@pippaoflondon.co.uk

### Step 14 — Personal Tab readiness
- Detect tab code/build instructions.
- If build artefacts exist, verify nginx route.
- If not, document what to build and where to host (nginx static vs workflow-api route).

## PHASE 8: Final Validation

### Step 15 — Golden File Validation
- Locate golden files: `find . -path '*golden*' -name '*.xlsx' | head -10`
- If found, run parser tests
- If not found, document as "SETUP REQUIRED" (not failure)

## PHASE 9: Aggregate

### Step 16 — Health and routing verification
Run:
- `curl -fsS http://127.0.0.1:3000/health`
- `curl -fsS http://127.0.0.1:3978/api/messages -I || true` (endpoint may require POST)
- External checks (if DNS works):
  - `curl -fsS https://processing.pippaoflondon.co.uk/health`
  - `curl -fsS https://processing.pippaoflondon.co.uk/temporal/ | head`

### Step 17 — Final report writing
Write `REPORT_FINAL.md` with:
- Summary table: Phase/Step -> Pass/Fail/Needs Action
- Blockers
- Exact next actions in order
- Paths to logs / evidence
Also write `STATUS.json` (a compact summary object) for easy copy/paste.

**STATUS.json fields:**
- docker_ok, pm2_ok, nginx_ok, tls_ok
- azure_cli_ok, mi_ok, cosmos_ok, blob_ok, temporal_ns_ok
- foundry_ok, zoho_ok
- admin_work_complete, token_acquisition_ok
- teams_package_built, teams_ready, tab_ready
- golden_files_tested

Finally print the **Paste-Back Report** block.

## PHASE 10: Production (NOT included in this run)

Production deployment (13_PRODUCTION_DEPLOY) is a separate phase that should be run later after dev validation is complete.
