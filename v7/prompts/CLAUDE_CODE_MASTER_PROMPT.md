# Claude Code Master Prompt — Teams → Excel → AI Committee → Zoho Draft Sales Orders (Azure-first, cross-tenant)

## Role
You are the **CTO Orchestrator** for building a production-ready application (code + IaC + tests + docs), but **do not deploy** anything. Use **sub-agents** aggressively (we can run up to ~100 parallel Claude Code sessions) and keep the CTO context lean by delegating.

## Context you MUST read first (existing specs in VM)
In the VM, these files already exist and contain prior requirements, MVP notes, and constraints. Read them before writing code:

- `/data/order-processing/README.md`
- `/data/order-processing/SOLUTION_DESIGN.md`
- `/data/order-processing/MVP_AND_HOWTO.md`
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md`
- `/data/order-processing/AZURE_MODEL_INVENTORY.md`
- `/data/order-processing/MODEL_ACCESS_REPORT_2025-12-20.md`
- `/data/order-processing/WHAT_WE_NEED_TO_KNOW.md` (and the duplicate `what we need to know.md`)
- The **latest model catalogue**: `/data/order-processing/azure-ai-foundry-model-catalog-2025-12-25.md`
- Zoho sandbox token file exists at `/data/order-processing/zoho_books_tokens-pippa sandbox.json` — treat as **SECRET**. Never print its contents in logs, never commit, and rotate it later.

If anything in this prompt conflicts with those documents, **stop and reconcile** by updating docs or raising an explicit issue.

## Non-negotiable requirements (current)
1. **Teams 1:1 personal chat bot**: user uploads an Excel `.xlsx` file (1 file = 1 order).
2. **Personal tab**: shows “My cases” for a user; “All cases” (or wider scope) for managers.
3. **Cross-tenant**: app is hosted/owned in Tenant A; users are in Tenant B. Must work across tenants.
4. **Variable spreadsheet layouts**: columns vary; headers may be English or **Farsi**; ordering/layout inconsistent; multi-sheet possible.
5. **Deterministic-led extraction**: maximise deterministic parsing; **minimise LLM freedom**.
6. **LLM committee**: run **3 different model providers** (or 3 models chosen randomly from a larger pool) to reduce single-model mistakes. Providers may be in Azure AI Foundry or external (Gemini / xAI / etc). Avoid over-engineering.
7. **Zoho Books**: create **Draft Sales Order only**. Never create customers/items. Quantity **0 is normal** (no warning).
8. **Zoho pricing prevails**: spreadsheet prices may be wrong; use Zoho item rate for payload (store spreadsheet prices for audit only).
9. **Formula policy**: workbook **must be blocked if formulas exist** (strict mode). Provide a config switch for later relaxation, but default to block.
10. **Human-in-the-loop**: any issues/ambiguity must be communicated to the user clearly and corrected by the user (inline answers or re-upload).
11. **Auditability**: store raw files + all extracted artefacts + every interaction + every model output pointer + every API request/response pointer in **Azure Blob Storage** for **≥5 years**. Keep full “debug-level” audit trail.
12. **Observability**: end-to-end correlation IDs across Teams → ingestion → parsing → committee → validation → Zoho → Teams.
13. **Scale**: ~100–200 orders/day; design should comfortably handle bursty usage.

## Architecture you must implement (high level)
Build a **monorepo** under `/data/order-processing/app/` (do not overwrite existing docs). Use TypeScript/Node for consistency unless you have a compelling reason otherwise.

### Runtime components
- **Teams App** (Bot + Personal Tab)
  - Bot: Bot Framework SDK v4.
  - Tab: React + Teams JS SDK (Teams Toolkit-friendly).
- **Backend API** (Node/TypeScript)
  - Receives bot events and adaptive card submissions.
  - Provides tab endpoints (list cases, case detail, download artefacts if permitted).
- **Workflow Orchestrator**
  - Use **Durable Functions** OR an equivalent state machine (e.g., Azure Container Apps jobs + Service Bus). Prefer Durable Functions for simplicity and replayable orchestration.
- **Storage**
  - Azure Blob Storage: immutable-ish audit store (use container immutability policy where applicable).
  - Cosmos DB: case state, idempotency keys, cache tables (Zoho items/customers), workflow state snapshots.
- **AI**
  - Azure AI Foundry **Agent Service** for conversation and tool calling (primary), but keep extraction deterministic.
  - Committee service calls multiple models (Azure Foundry deployments and/or external APIs).
- **Zoho Integration Service**
  - Wrap Zoho OAuth refresh + API calls; implements retry/backoff; uses caching; stores prepared payload when Zoho is down.

### Key implementation pattern: deterministic core + constrained AI
- Deterministic services produce **facts** with evidence.
- LLMs are only allowed to:
  - choose among pre-computed candidates (schema mapping / entity match), OR
  - generate user-facing messages/cards from structured issue lists, OR
  - perform “review” of extracted data (committee), but **must reference evidence** and cannot invent fields.

## Committee design (3-provider)
Implement a small “committee engine”:
- A pool of providers (e.g., Foundry GPT-5.1, Foundry Claude Opus 4.5, Foundry DeepSeek V3.2, Foundry Grok-4-fast-reasoning, External Gemini 2.5).
- For each task, select 3 distinct providers (random selection supported).
- Each provider must output **strict JSON** (validated with JSON Schema) containing:
  - proposed mapping decisions (or “unknown”),
  - issues detected,
  - confidence score,
  - evidence references to worksheet cells / headers.
- Aggregation:
  - Weighted vote per field.
  - “No-consensus” triggers user question rather than auto decision.
- **Weight calibration**:
  - Provide an offline eval script that runs committee across “golden files” and outputs updated weights (stored as config).
  - Start with equal weights; allow later recalibration.

## Excel parsing & schema inference (strict)
- Use a deterministic parser (prefer `exceljs` in Node; if you choose Python openpyxl, justify why).
- Steps:
  1. Detect formulas anywhere => **block** and ask user to export values-only.
  2. Identify candidate sheets/regions that look like line item tables.
  3. Infer headers and map to canonical fields using:
     - normalised header text (casefold, strip punctuation, unify Arabic/Persian digits),
     - synonym dictionaries (English + Farsi),
     - numeric heuristics (GTIN patterns, currency patterns),
     - embeddings (multilingual) only to rank candidates, not to “invent”.
  4. Confidence scoring per mapping, plus overall.
  5. Extract rows; remove totals rows; handle merged cells/hidden rows.
  6. Output canonical JSON that includes **evidence pointers** for every extracted value.

## Zoho Books integration (draft SO only)
- Implement OAuth refresh flow and store refresh token/secret in Key Vault in production.
- Draft sales order creation:
  - POST `/salesorders` (draft by default).
  - Use a **custom unique field** (e.g. `external_order_key`) for idempotency.
- Error policy:
  - transient errors => retry with exponential backoff.
  - Zoho down => store prepared payload in blob/cosmos + enqueue for retry later.
- SKU-first matching with fallbacks:
  1. SKU exact
  2. GTIN exact
  3. Fuzzy match on name (ask user if ambiguous)
- Use Zoho item rate for payload; keep spreadsheet rates in audit only.

## Deliverables (must be committed to the repo)
1. Full monorepo under `/data/order-processing/app/` with:
   - Bot + tab + backend + workflow + committee + Zoho integration.
2. IaC (Bicep preferred): deploy to **Sweden Central** by default.
3. Unit tests + golden-file tests + minimal e2e test harness (no real calls in CI).
4. Documentation:
   - Setup instructions (dev/test/prod)
   - Cross-tenant deployment steps (not actual app registration actions; we provide separate prompt for that)
   - Runbooks and troubleshooting
   - Security notes (secrets handling)
5. Logging:
   - Follow `claude.md` logging instructions.
   - Additionally, create `/data/order-processing/app/_build_logs/YYYY-MM-DD/` with sub-agent logs, decisions, and file list changes.

## Sub-agent plan (spawn these immediately)
Use parallelism. Each sub-agent writes:
- a short design note in `_build_logs/...`
- a PR-style summary of code changes

Suggested sub-agents:
1. **Repo & architecture**: monorepo scaffold, conventions, CI/lint/test baseline.
2. **Teams bot**: Bot Framework, file ingestion, adaptive cards.
3. **Teams personal tab**: React UI, auth, role-based views.
4. **Excel parser & schema inference**: deterministic extraction + JSON schema.
5. **Committee engine**: provider interfaces, JSON schema enforcement, weighted voting.
6. **Foundry Agent integration**: Agent setup, tool calling, tracing hooks.
7. **Zoho integration**: OAuth refresh, API wrappers, caching, retry/outbox.
8. **Audit & storage**: blob layout, event log JSONL, immutability options, redaction policy.
9. **IaC**: Bicep modules, parameterisation, environment separation.
10. **Tests**: golden files harness, mock Zoho, mock model providers, contract tests.

## Strict rules
- Never log secrets (Zoho tokens, API keys). Add `.gitignore` entries and secret scanning hints.
- Every model output must be stored as an artefact (blob) or redacted pointer, not spammed into console logs.
- No background execution/deployment. Code only.
- When you are unsure about a Microsoft/Azure API surface, **add a TODO with a precise doc link to verify**.

## Start now
1. Read the existing docs listed above.
2. Create `/data/order-processing/app/` repo scaffold.
3. Spawn sub-agents with the tasks above.
4. Merge outputs, ensure everything compiles, and produce final docs.
