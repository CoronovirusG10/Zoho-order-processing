# Prompt 09 — Aggregate Results + Produce Deployment Runbook (NO DEPLOY)

## Goal
Consolidate outputs from prompts 01–08 and produce:
1) A single readiness report (pass/fail + blockers)
2) A deployment runbook (steps only, no execution)
3) Open questions list for remaining unknowns

## Rules
- Do not deploy.
- Only read the existing `_predeploy_codex` artefacts and local docs.

## Input folder
`/data/order-processing/_predeploy_codex/`

## Output files to create
- `/data/order-processing/_predeploy_codex/reports/PREDEPLOY_READINESS_REPORT.md`
- `/data/order-processing/_predeploy_codex/reports/DEPLOYMENT_RUNBOOK.md`
- `/data/order-processing/_predeploy_codex/reports/OPEN_QUESTIONS.md`
- `/data/order-processing/_predeploy_codex/reports/CHANGELOG.md`

## Steps

1) Load all task logs:
- `logs/01_REPO_AUDIT.md`
- `logs/02_IAC_AUDIT.md`
- `logs/03_AZURE_BASELINE.md`
- `logs/04_FOUNDRY_AUDIT.md`
- `logs/05_TEAMS_AUDIT.md`
- `logs/06_ZOHO_AUDIT.md`
- `logs/07_SECURITY_GOVERNANCE.md`
- `logs/08_MULTIMODAL_READY.md`

If any are missing, note it.

2) Produce `PREDEPLOY_READINESS_REPORT.md`
Structure:
- Executive summary
- Readiness scorecard table (area → PASS/FAIL/NEEDS-ACTION)
- Blockers (must-fix before deployment)
- Non-blocking hardening recommendations
- Evidence index: link each claim to evidence file paths under `evidence/`
- “What will change in production” (e.g., tokens moved to Key Vault)

3) Produce `DEPLOYMENT_RUNBOOK.md`
It must be implementable. Include:
- prerequisites checklist (CLI logins, permissions)
- IaC deploy commands (or azd/terraform) — but as steps, not executed
- Foundry setup steps:
  - models to deploy/verify
  - workflow/agent creation steps
  - capability host setup steps
- Teams app deployment steps:
  - manifest packaging
  - cross-tenant install/consent steps (high level)
- App configuration steps (Key Vault secrets, environment variables)
- Smoke test steps (happy path + failure modes)
- Rollback plan

4) Produce `OPEN_QUESTIONS.md`
Include any unknowns that materially affect deployment and how to resolve them:
- which tenant hosts which parts
- exact resource naming
- production Zoho org_id and Books settings
- whether Teams file retrieval uses Graph vs Bot Framework attachments
- etc.

5) Update `CHANGELOG.md`
Record:
- timestamp
- which logs were used
- hashes of key docs (if possible)

## Output constraints
- No secrets.
- Use concise but precise language.
- Every “ready/not ready” statement must point to evidence path(s).
