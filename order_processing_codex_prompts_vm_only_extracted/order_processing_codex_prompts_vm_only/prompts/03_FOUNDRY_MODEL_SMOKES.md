# 03 — Foundry / Model Connectivity Smoke Tests (Orchestrator + Committee + Embeddings)

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Verify that the application can reach the AI endpoints needed for the dev MVP:
- Orchestrator model (Azure Foundry): gpt‑5.1 (AgentAI) or equivalent configured in code
- Committee models: o3, claude‑opus‑4‑5, DeepSeek‑V3.2 (as configured)
- Embeddings: Cohere‑embed‑v3‑multilingual (critical for Farsi headers)
- Document OCR: mistral‑document‑ai (optional unless image pipeline enabled)

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `03_FOUNDRY_MODEL_SMOKES_REPORT.md`
- `03_FOUNDRY_MODEL_SMOKES_COMMANDS.log`

Then print a **Paste‑Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print API keys, bearer tokens, endpoints containing secrets.
- Prefer running existing smoke scripts in the repo.
- If you must create a test script, write it under `/tmp` and delete it afterwards (or leave it under the run folder but without secrets).

## Steps
1) Setup logging helper.
2) Locate model catalog evidence files:
   - `ls -la /data/order-processing/*model*catalog* /data/order-processing/MODEL_ACCESS_REPORT_*.md || true`
3) Locate AI configuration in code:
   - search for env vars and config files:
     - `rg -n "(FOUNDRY|AZURE_OPENAI|OPENAI|ANTHROPIC|COHERE|DEEPSEEK|MISTRAL|MODEL_DEPLOYMENT|API_VERSION|ENDPOINT)" app -S || true`
   - identify which models/endpoints the code is actually configured to call.
4) Run smoke tests (preferred order):
   A) If repo has scripts:
      - list scripts: find package.json and show `scripts` blocks
      - run `npm test` or a dedicated smoke script ONLY if it does not require real external writes.
   B) If no scripts exist, run minimal API checks:
      - one embedding call with English + Farsi sample string
      - one chat completion/tool call / structured JSON output check for orchestrator model
      - committee model call check (strict JSON response)
   Record: success/failure, latency, and whether JSON schema strictness was honoured.
5) Write report:
   - models reachable
   - failures and likely causes (missing env var, firewall, DNS, wrong deployment name, etc.)
   - exact next actions

Finally print Paste‑Back Report.
