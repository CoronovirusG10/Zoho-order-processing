# Order processing v2 (multi-provider committee + hybrid automation)

**Last updated:** 2025-12-21

This folder contains the v2 evolution:
- multi-model / multi-provider committee (Azure Foundry + optional external APIs)
- calibrated voting based on golden files
- hybrid workflow: auto-create drafts only when confidence is high

Read:
- `SOLUTION_DESIGN.md`
- `MVP_AND_HOWTO.md`
- `CROSS_TENANT_TEAMS_DEPLOYMENT.md`
- `WHAT_WE_NEED_TO_KNOW.md`


## Reference implementations / similar work (starting points)

These are not drop-in solutions for Zoho order creation, but they cover key building blocks:

- Microsoft Teams “file upload bot” sample (Bot Framework v4): demonstrates handling file attachments and download flow.
  - https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-file-upload-nodejs/
- Azure AI Foundry / Agent Service samples (tool calling patterns; verify latest repo state):
  - https://github.com/Azure-Samples/azureai-samples
- Teams app publishing/deployment guidance:
  - https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-publish-overview

