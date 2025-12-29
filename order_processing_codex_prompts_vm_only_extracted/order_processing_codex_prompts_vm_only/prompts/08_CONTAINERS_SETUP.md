# 08 — Containers Setup: Cosmos DB + Blob Storage + Temporal Namespace

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Create and validate all required Cosmos DB containers, Blob Storage containers, and register the Temporal namespace.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `08_CONTAINERS_SETUP_REPORT.md`
- `08_CONTAINERS_SETUP_COMMANDS.log`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Verify MI access was confirmed before running (depends on 02_MI_AZURE_ACCESS).
- Do not delete existing containers.

## Dependencies
- MUST run AFTER 02_MI_AZURE_ACCESS (verify permissions first)

## Cosmos DB Containers Specification

| Container | Partition Key | Purpose |
|-----------|---------------|---------|
| cases | /tenantId | Case state |
| fingerprints | /fingerprint | Idempotency |
| events | /caseId | Audit events |
| agentThreads | /threadId | AI threads |
| committeeVotes | /caseId | Voting |
| cache | /type | Zoho cache |

## Blob Containers Specification

| Container | Purpose | Retention |
|-----------|---------|-----------|
| orders-incoming | Raw Excel files | 5 years |
| orders-audit | Audit bundles | 5 years |
| committee-evidence | AI outputs | 5 years |
| logs-archive | Platform logs | 5 years |

## Steps
1) Setup logging helper.
2) Verify Azure CLI is logged in with Managed Identity:
   - `az account show`
   - If not logged in, fail with message to run 02_MI_AZURE_ACCESS first.
3) Cosmos DB containers:
   - Check if database `order-processing` exists in `cosmos-visionarylab`:
     - `az cosmosdb sql database show --account-name cosmos-visionarylab -g pippai-rg -n order-processing`
   - If not exists, create it:
     - `az cosmosdb sql database create --account-name cosmos-visionarylab -g pippai-rg -n order-processing`
   - For each container in the specification:
     - Check if exists: `az cosmosdb sql container show ...`
     - If not exists, create with partition key:
       - `az cosmosdb sql container create --account-name cosmos-visionarylab -g pippai-rg -d order-processing -n <container> -p <partition_key>`
   - List all containers to confirm:
     - `az cosmosdb sql container list --account-name cosmos-visionarylab -g pippai-rg -d order-processing -o table`
4) Blob Storage containers:
   - For each container in the specification:
     - Check if exists: `az storage container show --account-name pippaistoragedev --name <container> --auth-mode login`
     - If not exists, create it:
       - `az storage container create --account-name pippaistoragedev --name <container> --auth-mode login`
   - List all containers to confirm:
     - `az storage container list --account-name pippaistoragedev --auth-mode login -o table`
5) Temporal namespace registration:
   - Check if namespace exists:
     - `temporal operator namespace describe order-processing || true`
   - If not exists, register it:
     - `temporal operator namespace register order-processing`
   - Verify registration:
     - `temporal operator namespace describe order-processing`
6) Write report with:
   - Cosmos containers: created/existing status
   - Blob containers: created/existing status
   - Temporal namespace: registered/existing status
   - Any errors encountered
7) Print Paste-Back Report block.
