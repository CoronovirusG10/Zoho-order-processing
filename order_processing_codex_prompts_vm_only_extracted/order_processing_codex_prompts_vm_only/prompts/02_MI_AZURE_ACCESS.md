# 02 — Azure & Managed Identity Access Checks (Cosmos / Storage / Key Vault)

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Verify that the VM/services can access Azure dependencies as intended:
- Cosmos DB `cosmos-visionarylab`
- Storage `pippaistoragedev`
- Key Vault `pippai-keyvault-dev`
- Resource group `pippai-rg`

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `02_AZURE_MI_ACCESS_REPORT.md`
- `02_AZURE_MI_ACCESS_COMMANDS.log`

Then print a **Paste‑Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Read-only where possible.
- Safe test writes are allowed ONLY if clearly labelled as TEST and stored under:
  `orders-incoming/_test/` in blob, and a test document in a test container/partition if available.
- Do not print secrets.

## Steps
1) Setup logging helper.
2) Check az CLI:
   - `az version`
3) Attempt MI login:
   - `az login --identity`
   - If fails, capture the error and continue.
4) Control-plane sanity:
   - `az account show`
   - `az group show -n pippai-rg -o jsonc`
   - `az keyvault show -n pippai-keyvault-dev -g pippai-rg -o jsonc`
   - `az storage account show -n pippaistoragedev -g pippai-rg -o jsonc`
   - `az cosmosdb show -n cosmos-visionarylab -g pippai-rg -o jsonc`
5) Data-plane checks (best-effort):
   - Key Vault: list secret names only (no values)
     - `az keyvault secret list --vault-name pippai-keyvault-dev -o table`
   - Storage: list containers and optionally list blobs in a known container
     - `az storage container list --account-name pippaistoragedev --auth-mode login -o table`
6) If access denied anywhere:
   - identify which identity is running (VM MI / user) and suggest the minimum RBAC role for each resource.
   - Do NOT change RBAC automatically.
7) Write report + paste-back summary.
