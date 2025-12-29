# 01 — VM Foundation: Docker (Temporal) + PM2 + nginx + Health Checks

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Bring up and verify the VM runtime foundation:
- Temporal + PostgreSQL via Docker Compose
- PM2 services (workflow-api, workflow-worker, teams-bot)
- nginx routing and TLS sanity
- basic health endpoints

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `01_VM_FOUNDATION_REPORT.md`
- `01_VM_FOUNDATION_COMMANDS.log`

Then print a short **Paste‑Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Execution rules
- OK to start/restart services.
- Do not print secrets.

## Steps
1) Setup logging helper (append every command to COMMANDS.log).
2) Validate prerequisites:
   - docker, docker compose, pm2, nginx present; if pm2 missing install it.
3) Temporal stack:
   - locate compose file: expected `app/services/workflow/docker-compose.temporal.yml` (search if missing)
   - `docker compose -f <file> up -d`
   - `docker compose -f <file> ps`
   - `docker ps` table output
   - verify ports: 7233, 8080, 5432
4) PM2 stack:
   - find how to start services (ecosystem.config, scripts)
   - start/restart workflow-api (2 instances), workflow-worker (2 instances), teams-bot (1 instance)
   - capture `pm2 ls`, `pm2 describe`, last 200 log lines each (redact)
5) nginx:
   - `sudo nginx -t`
   - confirm proxy rules match:
     - /api/messages -> localhost:3978
     - /api/* -> localhost:3000
     - /temporal/ -> localhost:8080
     - /health -> localhost:3000/health
   - reload nginx if needed
6) Health checks:
   - `curl -fsS http://127.0.0.1:3000/health`
   - `curl -fsS https://pippai-vm.360innovate.com/health || true`
   - `curl -fsS https://pippai-vm.360innovate.com/temporal/ | head || true`
7) Write report with pass/fail and next actions.

Finally print Paste‑Back Report block.
