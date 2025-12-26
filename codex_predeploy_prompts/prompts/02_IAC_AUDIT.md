# Prompt 02 — IaC Audit (Validation + What‑If only)

## Goal
Verify infrastructure-as-code exists and is consistent with the design:
- Sweden Central region
- separation of dev/test/prod
- required services declared
- deployment would succeed (based on validate/plan/what-if)

## Rules
- No deployments.
- Allowed: `az deployment ... what-if`, `az bicep build`, `terraform validate/plan`, `azd` preview/plan commands.
- Do not create/modify resources.

## Output files
- `/data/order-processing/_predeploy_codex/logs/02_IAC_AUDIT.md`
- `/data/order-processing/_predeploy_codex/evidence/iac/iac_inventory.txt`
- `/data/order-processing/_predeploy_codex/evidence/iac/validate.txt`
- `/data/order-processing/_predeploy_codex/evidence/iac/plan_or_whatif.txt`
- `/data/order-processing/_predeploy_codex/artefacts/iac_required_resources_checklist.md`

## Steps

1) Discover IaC files
- Locate bicep/terraform/azd/arm templates.
- Write paths to `iac_inventory.txt`.

2) Validate syntax
- Bicep: `az bicep build` for main bicep (or `bicep build`).
- Terraform: `terraform fmt -check`, `terraform validate`.
- azd: check `azure.yaml` exists; run `azd env list` (no provision).
- Save to `validate.txt`.

3) Configuration sanity
- Confirm region is `swedencentral` everywhere.
- Confirm naming conventions and environment separation.

4) What-if / plan (NO deploy)
- If Bicep/ARM:
  - run `az deployment sub what-if` or `az deployment group what-if` with parameters for a non-prod environment (dev).
- If Terraform:
  - run `terraform plan` (no apply).
- Save outputs to `plan_or_whatif.txt` (redact any secrets).

5) Required resources checklist
Create `iac_required_resources_checklist.md` listing whether IaC defines (or plans to create):
- Resource group(s)
- Storage account for audit + files (Blob)
- Key Vault
- App Insights + Log Analytics
- Function App / Container Apps / AKS (whichever is chosen)
- Service Bus / Storage Queue (if used)
- Cosmos DB + AI Search + Storage account for Foundry capability host (if used)
- Azure AI Foundry / Azure OpenAI resources (model deployments usually manual; note that)
- API Management (if used)
- Private endpoints / VNet integration (if required)

For each, include:
- IaC file path(s)
- resource name pattern
- region
- notes

## Report
In `02_IAC_AUDIT.md` summarise:
- What IaC exists
- Whether it validates
- Whether it matches Sweden Central requirement
- Blockers + next actions
- Evidence file paths
