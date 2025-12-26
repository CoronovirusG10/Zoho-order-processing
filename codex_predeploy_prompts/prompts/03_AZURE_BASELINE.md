# Prompt 03 — Azure Baseline Readiness (Read‑only)

## Goal
Confirm the Azure subscription and baseline resources are ready for deployment:
- correct subscription selected
- target region Sweden Central available
- baseline services exist or are planned (Storage, Key Vault, monitoring)
- RBAC / managed identities are plausible

## Rules
- Read-only Azure CLI commands only.
- No role assignments changes.
- No resource creation.

## Output files
- `/data/order-processing/_predeploy_codex/logs/03_AZURE_BASELINE.md`
- `/data/order-processing/_predeploy_codex/evidence/azure/account_show.json`
- `/data/order-processing/_predeploy_codex/evidence/azure/resource_groups.txt`
- `/data/order-processing/_predeploy_codex/evidence/azure/storage_accounts.txt`
- `/data/order-processing/_predeploy_codex/evidence/azure/keyvaults.txt`
- `/data/order-processing/_predeploy_codex/evidence/azure/monitoring.txt`
- `/data/order-processing/_predeploy_codex/evidence/azure/identities.txt`
- `/data/order-processing/_predeploy_codex/evidence/azure/network_notes.txt`

## Steps

1) `az account show`
- Save raw JSON to `account_show.json` (ok to include subscription id; redact any tokens).

2) Resource groups
- `az group list -o table`
- Save to `resource_groups.txt`.

3) Storage accounts
- `az storage account list -o table`
- For the intended audit storage account (if known), capture:
  - blob versioning enabled?
  - soft delete?
  - immutable storage (if configured)?
  - replication / redundancy
- Save to `storage_accounts.txt`.
- If you cannot determine which storage account is intended, list candidate accounts and flag as open question.

4) Key Vault
- `az keyvault list -o table`
- For the intended KV (if known), capture:
  - RBAC enabled?
  - soft delete / purge protection?
- Save to `keyvaults.txt`.

5) Monitoring
- Check for Log Analytics + App Insights components.
- Save to `monitoring.txt`.

6) Identities
- List managed identities (user-assigned) and note candidate identities for:
  - Bot runtime
  - Zoho integration
  - Blob writer
- Save to `identities.txt`.

7) Networking constraints (high-level)
- If VNets / private endpoints are used, inventory them at high level:
  - `az network vnet list -o table`
  - `az network private-endpoint list -o table`
- Save key notes to `network_notes.txt` (don’t dump massive outputs).

## Report
In `03_AZURE_BASELINE.md` provide:
- A PASS/FAIL/NEEDS-ACTION checklist for baseline readiness
- Blockers and actions (e.g., “need a dedicated audit storage account with immutability policy”, “need KV purge protection”, etc.)
- Evidence file paths
