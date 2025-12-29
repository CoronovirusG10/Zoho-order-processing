# Codex Prompts — VM‑Only (Temporal) Dev/Sandbox Deployment + Verification

This pack contains Codex prompts to execute the **next steps** for your VM‑only architecture in `pippai-rg`
on `pippai-vm`, and to output a clear report you can paste back into ChatGPT.

## What these prompts do
- Bring up **Temporal + PostgreSQL** via Docker Compose (if not already up)
- Start/verify **PM2** services (`workflow-api`, `workflow-worker`, `teams-bot`)
- Validate **nginx** routing + TLS + health endpoints
- Validate **Managed Identity** access to Cosmos/Storage/Key Vault (best‑effort)
- Validate **AI model connectivity** (Foundry + optional external)
- Validate **Zoho sandbox** connectivity (GET only by default; optional write test)
- Validate **Teams artefacts** (manifest/package, bot endpoint readiness)
- Validate **Personal tab** artefacts (build + routing readiness)

## Safety defaults
- Prompts redact secrets in output.
- Zoho **write** operations are disabled by default unless you set:
  `export ALLOW_ZOHO_WRITE=1`

## Recommended execution mode
Use Codex CLI `codex exec` with a writable sandbox (these prompts will create report files):

- `--sandbox workspace-write`
- `--ask-for-approval on-request` (recommended) or `--full-auto` if you accept unattended execution.

### Choose a run id (so outputs go to one folder)
Run this once before running prompts:

```bash
export OP_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
echo "$OP_RUN_ID"
```

Outputs will be written to:

`/data/order-processing/_codex_predeploy/$OP_RUN_ID/`

## Option A — Single prompt (everything together)
Run:

```bash
cd /data/order-processing

codex exec \
  --model gpt-5.1-codex \
  --cd /data/order-processing \
  --sandbox workspace-write \
  --ask-for-approval on-request \
  - < prompts/00_ALL_IN_ONE_VM_DEPLOY_DEV.md \
  | tee /tmp/OP_${OP_RUN_ID}_ALL_IN_ONE.txt
```

At the end it prints a **Paste‑Back Report** block and the path to the full report file.

## Option B — Tandem/parallel prompts (faster + modular)
Run prompts 01–06 in parallel (separate terminals) and then aggregate.

Example (bash background jobs):

```bash
cd /data/order-processing

for f in 01_VM_FOUNDATION 02_MI_AZURE_ACCESS 03_FOUNDRY_MODEL_SMOKES 04_ZOHO_SANDBOX_SMOKES 05_TEAMS_READINESS 06_TAB_READINESS; do
  codex exec --model gpt-5.1-codex --cd /data/order-processing --sandbox workspace-write --ask-for-approval on-request - \
    < prompts/${f}.md \
    | tee /tmp/OP_${OP_RUN_ID}_${f}.txt &
done
wait

codex exec --model gpt-5.1-codex --cd /data/order-processing --sandbox workspace-write --ask-for-approval on-request - \
  < prompts/07_AGGREGATE_REPORT.md \
  | tee /tmp/OP_${OP_RUN_ID}_AGGREGATE.txt
```

## What to paste back into ChatGPT
Paste either:
- the **Paste‑Back Report** block from the end of the run, or
- the contents of:
  `/data/order-processing/_codex_predeploy/$OP_RUN_ID/REPORT_FINAL.md`

