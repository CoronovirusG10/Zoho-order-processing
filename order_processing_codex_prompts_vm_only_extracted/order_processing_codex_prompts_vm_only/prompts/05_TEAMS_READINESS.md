# 05 — Teams Readiness (Bot + Manifest + Cross‑Tenant Plan) + Manual Steps Output

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Verify everything on the VM/code side is ready for Teams integration and produce a clear checklist
for the remaining manual steps in the Pippa of London tenant.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `05_TEAMS_READINESS_REPORT.md`
- `05_TEAMS_READINESS_COMMANDS.log`

Then print a **Paste-Back Report** block (<=150 lines) including a "Manual Steps for Pippa of London Tenant" section.

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Do not attempt to create tenant resources unless explicitly instructed; focus on readiness + instructions.

## Steps
1) Setup logging helper.
2) Locate Teams app artefacts:
   - find manifest: `find . -maxdepth 6 -type f -name 'manifest.json' -o -name '*appPackage*' | sort`
   - locate icons
3) Validate manifest content matches your VM ingress:
   - messaging endpoint must be `https://processing.pippaoflondon.co.uk/api/messages`
   - personal scope bot enabled
   - file upload support enabled if expected
   - tab present (personal tab)
4) Verify bot service is running locally:
   - check pm2 process for teams-bot
   - verify local port 3978 listening
   - verify nginx route `/api/messages` proxies to it
5) Cross-tenant / single-tenant reality:
   - read `CROSS_TENANT_TEAMS_DEPLOYMENT.md` and summarise exactly what must be done in Pippa of London tenant.
   - produce a step-by-step checklist:
     - app registration(s)
     - Azure Bot resource creation & Teams channel wiring (in Pippa of London subscription - NOT 360innovate)
     - Teams app package upload/install
     - testing steps (send message, upload xlsx)
6) Write report + paste-back summary.
