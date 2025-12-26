# Prompt 04 — Azure AI Foundry Readiness (Agents / Workflows / Capability Hosts / Models)

## Goal
Confirm Azure AI Foundry is ready for the planned build:
- Foundry account(s) and project(s) exist in Sweden Central
- required model deployments exist (per local catalog files)
- Agent Service / Workflows are usable (or clearly blocked)
- capability host configuration is decided and implementable

## Rules
- Read-only.
- Do not create or delete models/deployments/projects.
- You may compare against local evidence files.

## Output files
- `/data/order-processing/_predeploy_codex/logs/04_FOUNDRY_AUDIT.md`
- `/data/order-processing/_predeploy_codex/evidence/foundry/foundry_resources.txt`
- `/data/order-processing/_predeploy_codex/evidence/foundry/model_deployments_detected.txt`
- `/data/order-processing/_predeploy_codex/evidence/foundry/local_model_catalog_excerpt.md`
- `/data/order-processing/_predeploy_codex/artefacts/foundry_required_models_checklist.md`
- `/data/order-processing/_predeploy_codex/artefacts/foundry_workflows_capability_host_notes.md`

## Steps

1) Identify Foundry resources in the subscription
- Use `az resource list` filtering on likely types:
  - Microsoft.CognitiveServices/accounts
  - any Foundry/AI related resource providers present
- Save a table to `foundry_resources.txt`.

2) Extract local model catalogue evidence
- If present, read:
  - `MODEL_ACCESS_REPORT_2025-12-20.md`
  - `azure-ai-foundry-model-catalog-2025-12-25.md`
- Save key excerpts (just the deployment table lines; no secrets) to `local_model_catalog_excerpt.md`.

3) Detect model deployments from Azure (best-effort)
- If you have tooling/scripts in the repo that generated the model catalogue, run them in read-only mode.
- Otherwise, attempt to query deployments using available APIs/CLI for your Foundry account.
- Save results to `model_deployments_detected.txt`.

If direct querying is blocked (missing permissions/tooling), explicitly record:
- which command failed
- the exact error message
- what permission is missing

4) Required models checklist
Create `foundry_required_models_checklist.md` with PASS/FAIL for these classes:

### Orchestrator / Agent node
- gpt-5.1 (deployment name: AgentAI) OR gpt-5.2

### Committee (fixed trio + pool)
- o3
- claude-opus-4-5
- deepseek-r1 (DeepSeek-R1-0528) OR DeepSeek-V3.2
(Also note any other models already deployed that can be added to pool)

### Excel/text normalisation
- gpt-4o (for robust JSON schema + tool calling)

### OCR / document
- mistral-document-ai (document endpoint)
- vision-capable model(s): gpt-4o, gpt-5.1, claude-opus-4-5

### Speech-to-text (future voice notes)
- gpt-4o-transcribe (and diarize variant if needed)

### Embeddings/rerank (if using RAG for customer-specific formats)
- Cohere-embed-v3-multilingual
- Cohere-rerank-v4.0-pro (if deployed)

5) Workflows / capability hosts readiness notes
Write `foundry_workflows_capability_host_notes.md`:
- whether the plan uses Foundry Workflows (human-in-loop / sequential / group chat)
- whether you need a capability host (BYO Cosmos DB + AI Search + Storage) vs Microsoft-managed
- what you can confirm from local docs + current resource inventory
- what remains unknown and how to verify (link to Microsoft docs pages)

## Report
In `04_FOUNDRY_AUDIT.md`:
- confirm Sweden Central presence
- confirm model deployments match catalogue
- list blockers (permissions, missing capability host, etc.)
- provide concrete next steps
- reference evidence file paths
