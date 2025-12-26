# Claude Code Prompt — App Registrations & Cross‑Tenant Setup (Instructions Only)

## Goal
Produce a detailed, step-by-step plan to register and configure the required Microsoft Entra applications for a Microsoft Teams app (bot + personal tab), where:

- The app/bot is registered and hosted in **Tenant A** (deployment tenant).
- Users operate in **Tenant B** (Teams tenant).
- The solution must work for 1:1 chat, file uploads, and a personal tab.

Do not create or change anything. Only produce instructions and validation steps.

## Inputs to read (local)
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md`
- `/data/order-processing/SOLUTION_DESIGN.md`
- `/data/order-processing/MVP_AND_HOWTO.md`
- `/data/order-processing/WHAT_WE_NEED_TO_KNOW.md`

## Required outputs (write to `/data/order-processing/_predeploy/`)
1) `APP_REGISTRATIONS_RUNBOOK.md`
   - Exact app registrations required (bot app, tab app if separate, optional API app)
   - Redirect URIs, certificates/secrets strategy (prefer certs)
   - Required API permissions (Microsoft Graph) with least privilege
   - Bot Framework / Azure Bot resource identity settings

2) `CROSS_TENANT_ENROLLMENT_STEPS.md`
   - What Tenant A admin must do
   - What Tenant B admin must do
   - If store/AppSource publishing is required vs org app catalogue vs sideloading
   - How consent works (admin consent, enterprise app creation, conditional access considerations)

3) `VALIDATION_CHECKLIST.md`
   - CLI commands and portal checks for both tenants to confirm setup is correct

## Key constraints to include
- New multi-tenant bot creation is deprecated after 31 July 2025; document how this affects our approach and the supported alternative patterns.
- The Teams app must include both:
  - Bot for 1:1 chat
  - Personal tab
- File upload/download must be supported in the bot conversation.

## What to verify via Microsoft documentation (link in code block only)
```text
https://learn.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration?view=azure-bot-service-4.0
https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-authentication?view=azure-bot-service-4.0
```

## Deliverables must be precise
- Include concrete “click path” steps for Portal AND equivalent Azure CLI / Microsoft Graph steps where realistic.
- Call out common pitfalls and how to detect them (auth errors, tenant mismatch, AADSTS errors).
- Provide a minimal viable cross-tenant path (least moving parts) and a production-hardened path.

Start by analysing the existing cross-tenant document in the repo, then write the three output files.
