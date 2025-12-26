# Secure order intake and draft Sales Order creation (Azure-only) — v2 with 3-model committee

**Objective**: Salespeople send incoming **Excel (.xlsx) sales order spreadsheets** to a **dedicated 1:1 Microsoft Teams chat** (bot). The system extracts and validates the order, asks the salesperson for corrections in Teams when required, and then creates a **Draft Sales Order** in **Zoho Books** via API — with strong auditability and traceability.

**v2 change**: every workbook is interpreted by **three independent “interpreters”** (three model deployments, ideally from three different providers) and then adjudicated deterministically. The goal is to reduce single-model mapping mistakes while keeping a strict, auditable, deterministic truth source.

**Scope constraints (hard)**
- One spreadsheet = one sales order.
- Input format varies by customer/ERP; column names/order/layout are inconsistent.
- Customers and items already exist in Zoho Books (no creation of new customers/items).
- Create **draft** Sales Orders only (no invoicing/fulfilment).
- Quantity can be **0 or more** and must be handled explicitly.
- Everything must be hosted in Azure (no hosting outside Azure).
- Expected volume: ~100–200 orders/day.
- Audit artefacts retained for **24 months** in Azure Blob.

---

## 1. Executive summary

### 1.1 Proposed best architecture (safest-by-default)

**Recommendation (v2 safest possible)**: a **deterministic-led** pipeline for parsing/validation and Zoho writes, with:
- **Azure AI Foundry Agent Service** handling the Teams dialogue (asking for corrections, summarising, producing patches), and
- a **3-model committee** providing *non-authoritative* mapping proposals and consistency checks.

**Core services (Sweden Central)**
- **Teams bot (personal chat)** via Bot Framework (Teams app manifest).
- **Azure Durable Functions** as the orchestration/state machine (parse → validate → ask → approve → create).
- **Azure Blob Storage** for immutable raw spreadsheets and derived artefacts (24-month retention).
- **Azure Cosmos DB** for case state, idempotency keys, and lookup caches.
- **Azure Key Vault** for Zoho OAuth secrets and organisation IDs.
- **Azure API Management (APIM)** as a controlled egress proxy to Zoho.
- **Azure AI Foundry Agent Service** for agent-run conversation, tool calling, and tracing.
- **Application Insights / Log Analytics** for telemetry.

**Why this architecture minimises incorrect order creation**
- Excel is the source of truth; the system only extracts values that exist in cells and preserves evidence.
- A single model is not trusted: the **committee** must converge (or the user is asked).
- Zoho writes are gated by:
  - deterministic validations,
  - successful customer/item resolution,
  - explicit user approval,
  - idempotency checks.
- Everything is auditable: raw input, each model’s output, the adjudication result, user corrections, Zoho request/response.

### 1.2 Agent-led vs deterministic-led (in this context)

**Deterministic-led (recommended)**
- Code is authoritative for:
  - file ingestion and hashing,
  - XLSX parsing,
  - field extraction,
  - validation rules,
  - customer/item resolution,
  - Zoho API calls.
- The agent(s) can only:
  - choose among candidate mappings,
  - ask bounded questions,
  - produce structured patches,
  - generate user-facing explanations.

**Agent-led (not recommended for “safest possible”)**
- The agent orchestrates everything and may proceed with partial/implicit assumptions.
- Risk: silent mis-mapping that still passes arithmetic checks.

### 1.3 Recommended workflow mode

**Safest possible (explicit)**: **Review-first, committee-assisted**
- Always show the extracted order + issues.
- Always require “Approve & create draft sales order” in Teams.
- Any ambiguity blocks creation.

**Fastest possible (explicit)**: **Auto-create only when the committee converges**
- Create the Zoho draft automatically only if:
  - deterministic validations pass,
  - customer and all items resolve unambiguously,
  - the **committee unanimously agrees** (or “2-of-3 with high confidence” + no contradicting red flags) on column mappings,
  - no “quantity=0 requires confirmation” items exist.
- Every other case falls back to review-first.

### 1.4 Model deployments in Sweden Central and how to inventory them (Dec 2025)

#### Facts (from Microsoft documentation; verify in your tenant)
**Foundry Agent Service (Sweden Central) — Azure OpenAI models**
- Microsoft’s “Supported models in Foundry Agent Service” documentation (updated **4 Dec 2025**) lists **Sweden Central** as supporting the following Azure OpenAI model families for agents (deployment type/quotas may still vary by subscription):  
  - **gpt-5** (2025‑08‑07), **gpt-5-mini** (2025‑08‑07), **gpt-5-nano** (2025‑08‑07), **gpt-5-chat** (2025‑08‑07)  
  - **gpt-4.1** (2025‑04‑14), **gpt-4.1-mini** (2025‑04‑14), **gpt-4.1-nano** (2025‑04‑14)  
  - **gpt-4o** (2024‑05‑13 / 2024‑08‑06 / 2024‑11‑20), **gpt-4o-mini** (2024‑07‑18)  
  - **gpt-4** (0613), **gpt-4 turbo** (2024‑04‑09)  
  (You must still confirm the exact set available in *your* Foundry project, because the portal enforces project-type and quota constraints.)

**Important Agent Service constraints called out by Microsoft**
- **Hub-based projects** are limited to **gpt-4o, gpt-4o-mini, gpt-4, gpt-35-turbo**. If your Foundry project is hub-based, assume you cannot use gpt-4.1 or gpt-5 for the agent without changing the project type.  
- In Agent Service, **gpt-5 models can only use the Code Interpreter and File Search tools** (not arbitrary tool calling), and **require registration/eligibility**.

**Foundry Models (serverless / partner models)**
- Microsoft also lists “other model collections” that can be used by agents, including models sold directly by Azure and partner/community models (for example, Claude and Llama families). Availability still depends on your region, billing offer and subscription eligibility.

#### Design recommendations for this workflow
- **Main Teams conversation agent (must call your tools):**
  - Use **gpt-4o** as the safe default (because it is compatible with hub-based projects and supports tool calling in agents).
  - Use **gpt-4.1** only if your Foundry project type and governance allow it, and after regression testing on your golden spreadsheet set.
  - Avoid using **gpt-5** as the main agent for this workflow unless the only tools you need are Code Interpreter/File Search.
- **Model version stability:**
  - Pin model versions for production (or set “no auto upgrade” where supported).
  - Treat any model-version change like an app release: run regression tests over your “golden file” spreadsheet suite, then deploy.
- **Keep “fast/cheap” models for non-authoritative text only** (user-facing summaries, friendly explanations), not for extraction.

#### How to list what is currently deployed (your Azure subscription)
> I cannot query your Azure subscription from this environment (no access to your tenant/VM). Run the checks below on your Sweden Central VM (or Azure Cloud Shell).

**Azure CLI (Azure OpenAI / Foundry deployments)**
- List deployments (includes model + version):
  - `az cognitiveservices account deployment list -g <rg> -n <openaiResourceName> -o table`
- List models available to the resource (what you *can* deploy):
  - `az cognitiveservices account list-models -g <rg> -n <openaiResourceName> -o table`

**Management API alternative (automation/audit)**
- `GET https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/deployments?api-version=2025-06-01`

**Foundry portal**
- Model catalogue filters you should use:
  - Region = Sweden Central
  - Capability = Agent supported (for Agent Service)
  - Deployment type = Standard vs Global Standard vs Provisioned

#### What “can be deployed” (practical interpretation)
- **For the agent**: choose a model that is agent-supported *and* supports the tools you require (for this design: tool calling to your APIs, not just Code Interpreter).
- **For committee/reviewer models (v2)**: choose models from three different providers where possible, but only if (a) they are deployable in your hub/project region, and (b) your procurement/security policy allows that provider for production data.

---

## 2. Architecture options (compare at least 3)

### Option A — Teams bot → Logic Apps → Foundry Agent → Zoho

**Text diagram**
1. Teams user uploads Excel file to bot.
2. Bot stores raw file in Blob and triggers Logic App.
3. Logic App calls:
   - parsing/validation function,
   - committee mapping/check function,
   - Foundry Agent for Q&A,
   - Zoho integration function.
4. Bot posts Adaptive Cards back to Teams.

**Azure services**
- Teams bot (Bot Framework)
- Azure Logic Apps
- Azure Functions (parser/validator, committee engine, Zoho integration)
- Azure AI Foundry Agent Service
- Azure Blob Storage
- Azure Cosmos DB
- Azure Key Vault
- APIM
- App Insights/Log Analytics

**How Teams triggers it**
- Bot calls a Logic Apps HTTP trigger (or writes to Service Bus, which triggers Logic Apps).

**Where Foundry Agent fits**
- Logic Apps invokes the agent for:
  - generating user-facing summaries,
  - running multi-turn corrections.

**Committee integration**
- Logic Apps calls a **Committee Engine** function that runs 3 model invocations in parallel and returns an adjudicated mapping + review findings.

**Operational complexity**
- Moderate. Logic Apps is good for orchestration but awkward for complex stateful multi-turn dialogues unless you keep most state in Durable Functions/Cosmos.

**Cost drivers**
- Logic Apps actions
- 3× model calls per order (committee)

**Failure modes**
- Orchestration complexity if multi-turn logic is split between Logic Apps and the agent.

**Use when**
- You prefer low-code orchestration and accept that complex logic is still in Functions.

---

### Option B — Teams bot → Durable Functions (parser/validator + committee) → Foundry Agent → Zoho

**Text diagram**
1. Teams bot receives file and stores it in Blob (immutable) + writes an audit event.
2. Durable Functions orchestrator starts an `OrderCase` workflow.
3. Activities:
   - Parse workbook deterministically → candidate tables + candidate column mappings.
   - Run committee mapping + review → adjudicated mapping + issues.
   - Extract canonical JSON (grounded in cells) → deterministic validations.
   - Resolve customer/items in Zoho.
   - Ask user for corrections/approval via Foundry Agent + Teams Adaptive Cards.
   - On approval, create Zoho draft sales order via APIM.
4. Persist every artefact and event to Blob (24 months).

**Azure services**
- Teams bot
- Azure Functions (Durable)
- Azure Blob Storage
- Azure Cosmos DB
- Azure Key Vault
- APIM
- Azure AI Foundry Agent Service
- App Insights/Log Analytics
- (Recommended) Service Bus for retryable Zoho writes + DLQ

**How Teams triggers it**
- Bot invokes an HTTP endpoint on the Function app (or places a message on Service Bus).

**Where Foundry Agent fits**
- Runs the Teams conversation:
  - summarises extraction,
  - asks correction questions,
  - turns user answers into JSON Patch operations.

**Committee integration**
- **Committee Engine** is an activity function:
  - calls 3 model deployments (different providers where possible),
  - enforces strict JSON outputs,
  - adjudicates by majority vote and confidence rules,
  - returns a mapping + “committee findings”.

**Operational complexity**
- Higher than Option A initially, but lower long-term risk.
- Durable Functions is well-suited to state machines, retries, and long-running human-in-the-loop workflows.

**Cost drivers**
- 3× model calls per order (committee)
- Durable Functions (minor at this volume)
- Storage and logs

**Failure modes**
- Model disagreement → more user questions (expected and acceptable in safe mode).
- Bad template detection → falls back to user selection.

**Recommended option**
- Best balance of correctness, auditability, and implementability.

---

### Option C — Teams bot → Foundry Agent as primary orchestrator (tools for parsing + Zoho calls)

**Text diagram**
1. Teams bot sends the file to a single “Orchestrator Agent”.
2. Agent calls tools for parsing, validation, committee, and Zoho.
3. Agent decides when to ask user and when to create.

**Azure services**
- Teams bot
- Azure AI Foundry Agent Service (primary orchestrator)
- Functions/Container Apps behind APIM as tools
- Blob/Cosmos/Key Vault/App Insights

**Committee integration**
- Still possible: the orchestrator agent calls a committee tool.

**Operational complexity**
- Potentially simpler to wire, but correctness is harder.

**Failure modes**
- If the agent becomes the authority, it can overstep.

**Use when**
- You have strong in-house agent governance and are willing to invest in strict tool contracts and extensive testing.

---

## 3. Teams 1:1 experience design

### 3.1 Exact user flow steps (review-first)
1. User uploads `.xlsx` in a personal Teams chat with the bot.
2. Bot replies immediately:
   - “Received `<filename>`”
   - correlation ID (e.g., `SO-2025-12-19-000123`)
   - “Processing…”
3. Bot posts an Adaptive Card (Preview #1):
   - detected customer (or “unknown”)
   - line items preview table (first N lines)
   - totals detected (if any)
   - deterministic validation summary (pass/warn/fail)
   - **committee summary** (e.g., “3/3 agree on column mappings” or “2/3 disagree on Quantity column”) and the resulting action
   - actions:
     - **Fix now**
     - **Upload revised spreadsheet**
     - **Cancel**
4. If blocking issues exist, the bot asks a *bounded* set of questions (Adaptive Cards):
   - choose correct customer (from Zoho search results)
   - resolve ambiguous item mapping
   - confirm quantity=0 lines (keep as 0 / remove line / edit)
   - choose correct columns when committee cannot adjudicate
5. Bot posts a Final Review card:
   - full extracted order summary
   - list of corrections made (with who/when)
   - “Approve & create draft sales order” button
6. After approval, bot creates the Zoho draft sales order and posts:
   - Zoho sales order number / ID
   - audit bundle link/reference ID

### 3.2 How the user sends files
- In personal chat: attach `.xlsx`.
- Bot accepts only `.xlsx` (reject `.xlsm` by default; allow only if security approves).

### 3.3 Corrections model (multi-turn)
- Every correction is stored as:
  - JSON Patch operation
  - actor AAD object ID
  - Teams message ID
  - timestamp (UTC)
- Corrections are applied to a canonical order JSON document; the original extraction remains immutable.

### 3.4 Revised uploads vs inline corrections
- Each upload becomes a new `revision_###` under the same correlation ID.
- Revised upload triggers re-parse, re-validation, re-committee.
- Bot shows a diff from last revision (changed totals, changed line count, changed mappings).

---

## 4. Excel ingestion and extraction strategy (v2)

### 4.1 Deterministic parsing libraries (Azure-friendly)
**Recommended (Python)**
- `openpyxl` for cell-level XLSX parsing (merged cells, hidden rows/columns).
- `pandas` for working with rectangular data once extracted.
- `rapidfuzz` for fuzzy header matching.
- `python-dateutil` for date parsing (if needed for order dates).
- `decimal.Decimal` for currency-safe arithmetic.

### 4.2 Variable column names/layouts

#### Step A — Workbook normalisation
For each sheet:
- Expand merged ranges (copy top-left value into the merged region in a *virtual* grid; keep original merge metadata for audit).
- Record hidden rows/columns.
- Capture number formats and raw strings for every candidate cell.

#### Step B — Candidate table detection
- Scan each sheet for header-like rows:
  - high ratio of strings
  - keyword matches for SKU/Item/Qty/Price/Total/Description
  - adjacent columns with consistent data types beneath
- From each header candidate, grow a table downwards until “blank row” threshold.
- Output a list of `TableCandidate` objects with:
  - `sheet_name`, `header_row_index`, `data_start_row`, `data_end_row`, `columns[]`, `table_score`, sample rows.

#### Step C — Candidate field detection (deterministic)
For each canonical field, generate candidates with scores:
- **SKU / ItemCode** synonyms: `sku`, `item code`, `itemcode`, `product code`, `material`, etc.
- **Quantity**: `qty`, `quantity`, `order qty`, `ordered`, etc.
- **Unit price**: `unit price`, `price`, `rate`, `unit cost`.
- **Line total**: `line total`, `amount`, `total`, `ext price`.
- **GTIN/EAN**: `gtin`, `barcode`, `ean`, `upc`.
- Customer name: `customer`, `client`, `account`, etc. (often outside the line-items table).

Candidate scoring signals:
- header fuzzy match score
- type match score (e.g., quantity column is mostly integers)
- uniqueness (SKU column has high distinct values)
- arithmetic correlation (a column that equals qty×price across many rows is likely line total)

### 4.3 v2 schema inference via a 3-model committee

#### Committee intent
Use three independent model deployments to reduce single-model errors in:
- selecting the correct table,
- selecting the correct columns,
- spotting “looks wrong” patterns that deterministic rules miss.

#### Committee inputs (minimised, grounded)
To reduce hallucination and PII exposure, each model receives:
- list of table candidates with:
  - header texts
  - per-column stats (type distribution, min/max, unique count)
  - **N sample rows** (e.g., 5–10) with raw values
- deterministic candidate lists per canonical field (top K columns with scores)
- constraints:
  - SKU-first matching policy
  - quantity may be 0 and is allowed but must be confirmed

**Important**: models never receive the full workbook binary; they receive extracted, bounded summaries.

#### Committee outputs (strict JSON)
Each model returns:
- selected `table_id`
- mapping from canonical fields → `column_id` (or null)
- per-field confidence (0–1)
- per-field evidence references (`header`, sample values indices)
- “red flags” list (e.g., “Quantity column has negative numbers”, “Unit price column contains dates”).

#### Adjudication algorithm (deterministic)
- Majority vote per field:
  - If ≥2 models pick the same `column_id` and mean confidence ≥ `0.70`, accept.
  - If all disagree or confidence low, mark as **AMBIGUOUS**.
- Consistency constraints:
  - SKU, quantity, unit price, line total must come from the same selected table.
  - Reject mappings that mix different tables unless explicitly allowed.
- Safety override:
  - If deterministic heuristics strongly contradict the committee (e.g., arithmetic correlation), force AMBIGUOUS and ask the user.

#### How committee disagreement becomes user questions
If AMBIGUOUS:
- The bot asks the user to pick from a short list:
  - “Which column is Quantity?” (buttons: `Qty`, `OrderQty`, `ShippedQty`)
- The selected answer becomes a JSON Patch correction to the mapping, and is stored in audit.

### 4.4 Multi-sheet files
- Compute a score per sheet:
  - presence of line-item keywords
  - presence of a plausible item table
  - density of numeric columns
- If top two sheets are close in score and committee disagrees, ask user to select the sheet.

### 4.5 Handling hidden rows, totals rows, currency formats
- Ignore hidden rows/columns during detection by default.
- Detect totals rows via keyword and/or by “sum of column equals cell value” heuristics.
- Parse currency symbols (e.g., `€`, `£`) and ISO codes (e.g., `EUR`, `GBP`) if present.

### 4.6 Explicit validation rules (deterministic)

**Line-level checks**
- `quantity >= 0` (hard requirement)
- If quantity, unit_price, line_total are present:
  - `abs(quantity × unit_price − line_total) <= tolerance` (configurable; recommend `0.01` in currency units)
- If SKU present, normalise and validate allowed characters.

**Order-level checks**
- If totals present:
  - Sum(line_totals) matches subtotal/grand total within tolerance (adjust for taxes/discounts if they are separate fields).

**SKU/GTIN cross-checks (where possible)**
- If both SKU and GTIN exist:
  - ensure they resolve to the same Zoho item (or flag).

**Quantity = 0 policy**
- Allowed, but **requires explicit confirmation** per line (blocking until user confirms).

### 4.7 Preventing hallucinations (non-negotiable)
- Canonical JSON must include evidence for every extracted value:
  - `sheet`, `cell`, `raw`, `normalised`.
- Models are prohibited (by prompt and by schema) from returning values that are not in candidate sets.
- The adjudicator rejects any model output that references unknown columns.

### 4.8 Canonical JSON schema (high-level)
(Full schema lives in `MVP_AND_HOWTO.md`.)
- `correlation_id`, file hash, revision info
- `extraction`:
  - customer name (if present)
  - line items with evidence
  - totals with evidence
- `validation`:
  - issues array with codes, severity, evidence
- `committee`:
  - per-model raw outputs
  - adjudicated mapping and confidence
- `corrections`:
  - JSON Patch list
- `zoho`:
  - resolved customer/item IDs
  - payload snapshot
  - response metadata

---

## 5. Azure AI Foundry Agent design (deep dive, v2)

### 5.1 Responsibilities vs deterministic components

**Deterministic (authoritative)**
- XLSX parsing and evidence capture
- validation and gating
- committee adjudication
- Zoho integration
- audit persistence

**Foundry Agent (authoritative only for conversation)**
- multi-turn Teams dialogue
- converting user text/selections into JSON Patch operations
- explaining issues and asking next questions

**Foundry models (non-authoritative committee)**
- mapping proposals
- independent consistency review

### 5.2 Tooling approach
Expose narrow tools (Functions behind APIM). The agent can only call these tools:
- `GetCaseSummary(correlation_id)`
- `RunExtraction(revision_id)`
- `RunCommittee(revision_id)`
- `RunValidation(revision_id)`
- `ResolveZohoEntities(correlation_id)`
- `CreateZohoDraftSalesOrder(correlation_id, idempotency_key)`
- `WriteAuditEvent(correlation_id, event_type, payload_ref)`

**Guardrail**: `CreateZohoDraftSalesOrder` refuses unless:
- validation status is pass (or warn with explicit accepted warnings)
- user approval record exists
- idempotency key is unused

### 5.3 Committee implementation pattern in Foundry
Two implementation patterns (choose one):

**Pattern 1 (recommended): Committee Engine in code + direct model calls**
- Durable Functions calls three model endpoints (Foundry Models) in parallel.
- Pros: simpler state, easier to keep prompts small.
- Cons: separate from agent tracing unless you wire telemetry.

**Pattern 2: Three “committee agents” + adjudicator in code**
- Create 3 agents, each pinned to a different model.
- Durable Functions calls each agent run and then adjudicates.
- Pros: consistent agent tracing.
- Cons: more agent-state to manage.

**Verification (Dec 2025)**
- You must confirm, in your Foundry project, which models are available in **Sweden Central** and whether partner models require separate purchase/enablement.


### 5.3.1 Recommended committee model set for Sweden Central (Dec 2025)

You asked for “three different providers/interpreters” to reduce the chance that any single model makes a mapping mistake. The key design point is: **committee models are advisory only**; deterministic parsing/validation still owns the truth.

**Recommended default committee (three different providers)**
1. **Azure OpenAI** (OpenAI models via Azure): a smaller, cheap model used as a “mapper” (for example a mini/nano tier where available) — produces a column mapping proposal + confidence + reasons.
2. **Cohere**: **Command R+ (08-2024)** — produces an independent mapping proposal and flags anomalies.
3. **Anthropic**: **Claude Sonnet 4.5** (or Opus 4.x) — produces an independent mapping proposal and flags anomalies.

**Data residency warning (must decide)**
- Claude models in Foundry are documented as **Global Standard** deployments. This can imply global routing. If you require “processing must stay in Sweden Central” you may need to exclude Claude and pick a third provider that offers **regional Standard** deployment in Sweden Central (for example, Mistral/Cohere/Meta models where the model card lists Sweden Central for deployment).

**EU-only committee alternative (if Global Standard is not allowed)**
- Azure OpenAI (gpt-4o-mini / gpt-4.1-mini, depending on what your project allows)
- Cohere Command R+ (Sweden Central deployable)
- A third non-OpenAI model whose model card explicitly lists Sweden Central *and* a non-global deployment type (verify in the Foundry catalogue; Mistral is a common candidate, but you must confirm availability and deployment type at the time you build).

**Implementation note**
- Keep the committee calls **out of Agent Service** unless all committee models are agent-supported and tool-compatible. It is usually simpler to call committee models directly from Durable Functions (parallel fan-out), then adjudicate deterministically, and only then engage the Teams agent to ask the user.

**What to log for audit**
- model name + version (deployment)
- provider
- deployment type (Standard/Global Standard/Provisioned)
- prompt hash + input summary hash (not raw PII)
- raw JSON output from each model
- adjudication decision and reason

### 5.4 State/memory handling
- Authoritative workflow state: Cosmos DB.
- Agent state:
  - store only minimal references (correlation IDs, blob URIs), not raw workbook content.
- Do **not** store PII in long-term agent memory.

### 5.5 Prompting strategy
**System prompt principles**
- Never invent values.
- Only select from provided candidates.
- If uncertain, ask a bounded question.
- Output strict JSON only.

**Committee prompt principles**
- “Choose-only-from-candidates” mapping.
- Provide evidence for each chosen mapping.
- Emit red flags; do not propose fixes.

### 5.6 Tracing/observability
- Single correlation ID across:
  - Teams message → blob revision → committee run IDs → agent run IDs → Zoho request
- Store raw committee outputs in Blob (for audit) regardless of agreement.

---

## 6. Zoho Books integration design

### 6.1 Authentication and secret handling
- OAuth 2.0 with refresh token.
- Store refresh token + client secret in Key Vault.
- Token broker component caches access tokens in memory and (optionally) in Cosmos with short TTL.

### 6.2 Required API calls and sequence
1. Resolve customer:
   - search by name
   - if multiple matches, require user selection
2. Resolve items:
   - primary: SKU exact match (normalised)
   - fallback: GTIN/EAN (if stored)
   - last resort: fuzzy name → user selection
3. Create sales order:
   - `POST /salesorders` (verify draft behaviour in your tenant)
4. Optional: attach the original spreadsheet to the sales order (if allowed and desired) for traceability.

### 6.3 Idempotency strategy
- Compute idempotency key from:
  - file hash
  - Zoho organisation ID
  - normalised customer identifier
  - stable line signature (SKU + qty + price + total)
- Store the idempotency key in Cosmos DB (unique constraint) and refuse duplicates.

### 6.4 Error handling and retries
- Use Service Bus for the Zoho write step.
- Retry on transient failures with exponential backoff + jitter.
- On 429, reduce concurrency and back off.
- Dead-letter after max attempts and notify the user with the correlation ID.

### 6.5 When customer/item lookup fails
Even if the business assumption is “present”, implement:
- “Not found” path → ask the user to search/select the correct Zoho record.
- “Multiple found” path → ask user to select.
- Audit the decision.

---

## 7. Security, compliance, and governance

### 7.1 Least privilege model
- Managed Identity for Azure-to-Azure.
- Key Vault access restricted to the Zoho integration component.
- APIM egress allowlist to only Zoho API domains.

### 7.2 Committee-specific security considerations
- More model calls = more exposure.
- Mitigations:
  - send only bounded, summarised cell data (headers + sample rows), not full workbooks
  - prefer models deployed in Sweden Central / EU data zone
  - log every model invocation and response
  - treat committee outputs as advisory only

### 7.3 Data retention
- 24 months in Azure Blob.
- Use versioning + immutability (WORM) where required.

### 7.4 Audit storage (append-only)
- Store an append-only event log per correlation ID (JSON lines).
- Store artefacts in blob paths under the correlation ID.

---

## 8. Operational plan

### 8.1 Deployment approach
- IaC with Bicep or Terraform.
- Separate dev/test/prod.

### 8.2 Monitoring and alerting
- Parse failure rate
- Committee disagreement rate (leading indicator of new templates)
- Zoho 429/5xx rates
- DLQ depth

### 8.3 Scaling
- 100–200/day is modest.
- Committee adds latency but manageable.
- Run committee calls concurrently.

---

## 9. Implementation blueprint (v2 additions)

### 9.1 Step-by-step build plan (delta from v1)
1. Build v1 pipeline (deterministic extraction + agent Q&A + Zoho create).
2. Add Committee Engine:
   - define strict JSON schema for model outputs
   - implement 3 parallel model calls
   - implement adjudicator
3. Add “committee summary” and “committee-driven questions” in Teams cards.
4. Add committee artefact storage + audit events.

### 9.2 Example pseudo-code for committee adjudication
(Full snippets live in `MVP_AND_HOWTO.md`.)

---

## 10. Open questions and recommended discovery

See `WHAT_WE_NEED_TO_KNOW.md`.


---

## Appendix A. Relevant public samples and prior art (GitHub)

I did **not** find an end-to-end public repository that exactly matches **“Teams 1:1 Excel upload → Azure AI Foundry Agents → Zoho Books draft Sales Order”**, and I did not find anything public that already implements the **3-provider committee** pattern for this specific business flow.

What *is* available are high-quality “building block” repositories (mostly from Microsoft/Azure samples) that cover the key technical pieces you need:

### Azure AI Foundry Agents (tool calling, tracing, baseline architecture)
- `Azure-Samples/azure-ai-foundry-baseline`  
  https://github.com/Azure-Samples/azure-ai-foundry-baseline  
  Baseline enterprise wiring patterns for Foundry, helpful for repo layout, security posture, and observability structure.
- `Azure-Samples/get-started-with-ai-agents`  
  https://github.com/Azure-Samples/get-started-with-ai-agents  
  Smaller “getting started” examples for Agent Service concepts.
- `Azure-Samples/ai-agent-openai-web-app`  
  https://github.com/Azure-Samples/ai-agent-openai-web-app  
  Demonstrates agents calling **OpenAPI tools** (useful for how to structure tool contracts and responses).

### Governance / gatewaying (APIM in front of AI endpoints)
- `Azure-Samples/AI-Gateway`  
  https://github.com/Azure-Samples/AI-Gateway  
  Patterns for putting **APIM** in front of AI endpoints (routing, policy enforcement, logging).

### Teams bot file handling (receiving files in 1:1 chat)
- Teams samples collection (multiple languages):  
  https://github.com/OfficeDev/Microsoft-Teams-Samples  
  Look specifically for bot + file/attachment samples.
- Bot Framework attachment samples:  
  https://github.com/microsoft/BotBuilder-Samples  
  Useful for attachment download patterns and conversation state.

### Zoho Books API integration examples
There are community wrappers (various languages) for Zoho Books v3 APIs, but none are “audit-first” by default. Use them as references only, and keep your production integration code minimal and fully logged.

**How to use these repos safely**
- Treat them as **reference patterns**, not drop-in production code.
- Remove/avoid any hard-coded secrets; use Managed Identity + Key Vault in Azure.
- Ensure every step emits your correlation IDs and writes your append-only audit events.
