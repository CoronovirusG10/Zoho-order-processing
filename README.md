# Order processing (Teams → Excel → AI validation → Zoho Books draft)

**Last updated:** 2025-12-21

This folder contains an implementation-grade design for a secure order intake workflow:

- Salespeople upload an **Excel** file to a **1:1 Teams chat bot**
- The system extracts and validates order data (variable layouts, multilingual headers including Farsi)
- The bot asks the user to correct issues in Teams
- The system creates a **Draft Sales Order** in **Zoho Books** (customers/items already exist)
- Everything is fully traceable and retained in **Azure Blob Storage for ≥ 5 years**

There are two plans:
- **v1 (safest possible):** deterministic-led + review-first, committee used as bounded cross-check
- **v2:** multi-provider committee + hybrid (auto-create only when confidence is high)

## Key documents

- `SOLUTION_DESIGN.md` — full architecture and detailed design (v1 safest possible)
- `MVP_AND_HOWTO.md` — step-by-step build and pilot plan
- `WHAT_WE_NEED_TO_KNOW.md` — open questions and discovery checklist
- `CROSS_TENANT_TEAMS_DEPLOYMENT.md` — how to deploy when Azure tenant ≠ Teams tenant
- `MODEL_ACCESS_REPORT_2025-12-20.md` — your current Azure AI Foundry deployments/catalog snapshot

## Constraints captured
- Hosting in Azure (Sweden Central). External LLM calls are allowed for the committee, but the workflow and storage remain Azure-hosted.
- Qty=0 is valid and must not warn.
- Spreadsheet formulas are blocked for safety (ask user to upload values-only).
- Zoho pricing prevails (spreadsheet prices are treated as informational only).
- Audit and logs retained ≥ 5 years in Azure Blob.

See v2 folder for the alternative plan.


## Reference implementations / similar work (starting points)

These are not drop-in solutions for Zoho order creation, but they cover key building blocks:

- Microsoft Teams “file upload bot” sample (Bot Framework v4): demonstrates handling file attachments and download flow.
  - https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-file-upload-nodejs/
- Azure AI Foundry / Agent Service samples (tool calling patterns; verify latest repo state):
  - https://github.com/Azure-Samples/azureai-samples
- Teams app publishing/deployment guidance:
  - https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-publish-overview

