# Sales Order Intake (Excel → Teams → AI validation → Zoho Books Draft Sales Order) — v1 “Safest possible”

**Last updated:** 2025-12-21  
**Primary design goal:** minimise incorrect order creation while reducing manual entry.  
**Operating model:** **review-first** (human explicitly approves) + strong audit trail + strict, deterministic extraction.  
**Teams + hosting:** Teams users in **Tenant B**, Azure workload in **Tenant A** (Sweden Central).

This v1 is deliberately conservative: the agent can *suggest* mappings and corrections, but deterministic code performs parsing, validation, and payload construction. A **3-model committee** is used as a cross-check, not as an unconstrained extractor.

---

## Context decisions captured (from you)

These are treated as requirements for this version:

1. **Schema inference must be strict** (improve accuracy without adding LLM freedom).
2. **Teams experience:** 1:1 chat + **personal tab** (“My cases”); managers have wider access.
3. **Cross-tenant:** The Teams tenant differs from the Azure hosting tenant (see `CROSS_TENANT_TEAMS_DEPLOYMENT.md`).
4. **Region:** use existing Azure footprint in **Sweden Central**.
5. **Retention:** keep *all artefacts and logs* in **Azure Blob Storage for ≥ 5 years**.
6. **Item resolution:** primary by **SKU**, fallback by **GTIN/EAN stored as a Zoho item custom field**.
7. **Qty = 0:** normal and should **not** trigger a warning.
8. **Spreadsheet formulas:** **block** if formulas are present in relevant cells/ranges (safest).
9. **Zoho pricing prevails:** ignore spreadsheet prices for creating the order; use Zoho item rates.
10. **Fuzzy matching:** OK; bot can ask the user when uncertain.
11. **Multi-model committee:** run 3-provider committee; providers may be in Azure or external (Gemini/xAI/etc).
12. **Issues must be communicated clearly**; human intervenes and fixes in Teams when needed.

---

## 1. Executive summary

### 1.1 Proposed best architecture (v1)
**Recommended:** **Option B** — Teams bot → Azure Function (deterministic parser/validator) → Foundry Agent Service (conversation + decision support) → Zoho Books (API).  

**Why this is safest:**
- Parsing and validation are deterministic and reproducible (no “hallucinated” fields).
- LLMs are used for **bounded tasks**: column name normalisation, mapping suggestions, explaining issues in natural language (including Farsi), and guiding user corrections.
- Full auditability: every decision is backed by a cell reference (“evidence”) and stored.

### 1.2 “Agent-led” vs “deterministic-led” in this context
**Deterministic-led (v1):**
- Code decides what exists in the spreadsheet (cells → records).
- Code enforces rules (required fields, arithmetic checks, lookups, idempotency).
- The agent is not allowed to invent missing values; it only:
  - selects among candidates,
  - asks the user questions,
  - explains issues and next actions.

**Agent-led (not v1):**
- The agent orchestrates parsing + validation itself and directly calls tools to create orders.  
This is more flexible, but increases the risk of subtle extraction errors. We keep it for v2 or later.

### 1.3 Recommended workflow mode
**Review-first (explicit approval) — recommended for v1.**

- Even with a committee, spreadsheet variability + ERP quirks mean you will get edge cases.
- Review-first still saves time: the bot produces a filled draft ready for quick sanity check instead of manual entry.

> “Fastest” mode is documented in v2; v1 is “safest possible”.

---

## 2. Architecture options (compare at least 3)

### Common building blocks
- **Teams app**: bot (1:1 chat) + personal tab.
- **Ingress storage**: Azure Blob Storage (immutable audit bundles).
- **Compute**: Azure Functions (Python) for parsing/validation + Azure Container Apps (optional) for heavier components.
- **AI**: Azure AI Foundry Agent Service for conversational orchestration and tool calls.
- **State**: Cosmos DB (case state + agent thread state).
- **Integration**: APIM (front door), Key Vault (secrets), Monitor (App Insights + Log Analytics).

> Cross-tenant deployment details are in `CROSS_TENANT_TEAMS_DEPLOYMENT.md`.

---

### Option A: Teams bot → Logic Apps → Foundry Agent → Zoho

**Diagram (text):**  
User → Teams bot → (event) Logic Apps → Foundry Agent (tools) → Zoho Books API

**Azure services used**
- Azure Bot Service / Bot Framework hosting
- Logic Apps Standard (workflow)
- Foundry Agent Service (agent)
- Key Vault, Blob, Monitor

**How Teams triggers it**
- Bot receives message/file → posts HTTP trigger to Logic App

**Where Foundry Agent fits**
- Agent decides mapping, prompts user, calls Zoho tool (OpenAPI)

**Operational complexity**
- Medium: Logic Apps are easy to wire but complex to version, test, and run deterministic parsers at scale.
- Deterministic Excel parsing in Logic Apps is awkward; you will still need Functions.

**Cost drivers**
- Logic Apps runs + connector actions
- Agent tokens
- Storage + logging

**Failure modes**
- Complex retries leading to duplicate Zoho orders if idempotency is not perfect
- Harder to do “evidence-first” extraction in Logic Apps alone

**Verdict**
- Not recommended for v1 as the primary backbone, unless you already run an enterprise Logic Apps platform and want strong workflow visibility.

---

### Option B (recommended): Teams bot → Azure Function parser/validator → Foundry Agent → Zoho

**Diagram (text):**  
User → Teams bot → upload file → Function parses + validates → Agent handles Q&A → Function constructs Zoho payload → Zoho API → results back to Teams

**Azure services used**
- Azure Bot Service (Teams channel)
- Azure Functions (Python) — parse/validate + Zoho calls (or call Zoho via APIM)
- Foundry Agent Service — conversation + tool calling
- Cosmos DB — case state + agent thread state
- Blob Storage — immutable audit bundles (5y retention)
- APIM + Key Vault + Monitor/Log Analytics

**How Teams triggers it**
- Bot receives file message → downloads file to Blob → enqueues message to Service Bus/Storage Queue → Functions pick up.

**Where Foundry Agent fits**
- The agent:
  - reads the structured parse output (canonical JSON + issues list),
  - asks user precise correction questions,
  - emits a strict “corrections patch” (JSON Patch style),
  - requests “create draft” only when issues resolved.

**Operational complexity**
- Medium (good): clear separations; deterministic code is unit-testable; agent is contained.

**Cost drivers**
- Foundry model usage (mapping assistant + explanation)
- Committee model calls (bounded, see section 5.6)
- Functions executions (light at 100–200/day)

**Failure modes**
- Bad schema inference → wrong mapping → wrong order. Mitigated by:
  - strict confidence thresholds
  - committee disagreement → force human correction
  - mandatory user approval in v1

**Verdict**
- **Recommended for v1**.

---

### Option C: Teams bot → Foundry Agent as primary orchestrator (tools for parsing + Zoho calls)

**Diagram (text):**  
User → Teams bot → Agent receives file reference → Agent calls “parse_excel” tool → Agent calls “validate_order” tool → Agent calls “zoho_create_draft” tool

**Azure services used**
- Foundry Agent Service (orchestrator)
- Tool endpoints: Functions/Container Apps
- Bot + Storage + Cosmos + Key Vault

**Pros**
- Faster feature iteration, fewer orchestration components.
- Agent can manage multi-turn with less custom code.

**Cons**
- Harder to prove determinism end-to-end (agent decides what tool calls to do and when).
- Requires careful prompt/tool schema design to avoid accidental tool misuse.

**Verdict**
- Better for v2 “hybrid/auto-create” once parsing is proven.

---

## 3. Teams 1:1 experience design (chat + personal tab)

### 3.1 User flow (happy path)
1. Salesperson opens 1:1 chat with the bot.
2. User uploads a single .xlsx file (one spreadsheet = one order).
3. Bot replies immediately:
   - acknowledges receipt,
   - shows a “Processing…” card with correlation ID,
   - creates a case record.
4. When parsing completes:
   - bot posts a summary card (“Detected customer: X, lines: N, total: Y (Zoho), confidence: High”).
5. User clicks **Create draft sales order**.
6. Bot creates draft in Zoho Books and posts:
   - Zoho Sales Order number + deep link,
   - audit bundle reference,
   - warning banner: “Draft created — verify in Zoho before confirming.”

### 3.2 User flow (issues)
1. Bot posts an **Issues card** listing:
   - missing customer,
   - ambiguous SKU matches,
   - arithmetic inconsistencies,
   - unmapped columns,
   - multiple candidate header rows, etc.
2. Each issue has a *specific question* and input:
   - choose customer from top matches
   - choose item for SKU/GTIN
   - enter missing quantity
   - confirm which sheet to use
3. User submits corrections.
4. Bot re-validates and loops until:
   - no blocking issues remain, then shows “Create draft” button.

### 3.3 Revised uploads vs inline corrections
- If the spreadsheet is structurally broken (e.g., formulas blocked, protected workbook, unreadable, multi-order detected):
  - bot asks for **re-upload** with guidance (e.g., “export values only”).
- If it is a mapping/data issue:
  - bot uses **inline corrections** (card inputs) and stores a patch.

### 3.4 Personal tab: “My cases” + manager view
- **My cases (SalesUser):** list status, last activity, customer, created Zoho link, download audit bundle.
- **Manager view (SalesManager):** see team’s cases (same fields), filter by salesperson/status/customer/date, export.

Auth is via Teams tab SSO (see `CROSS_TENANT_TEAMS_DEPLOYMENT.md`). Role enforcement uses Entra app roles.

### 3.5 How issues are communicated (explicit)
Issues are always communicated as:
- A short natural-language summary (English or Farsi depending on detected language), and
- A structured list with:
  - issue code,
  - severity (block/warn/info),
  - evidence (cell refs / sheet name),
  - suggested fix,
  - user input control if fix requires human decision.

---

## 4. Excel ingestion and extraction strategy

### 4.1 Libraries/services (Azure-friendly)
**Recommended (v1):**
- Python `openpyxl` for reading cell grid, merged cells, hidden rows/cols, formulas detection.
- `pandas` for dataframe-like operations once a tabular region is identified.
- Optional: `rapidfuzz` for deterministic fuzzy matching.

Avoid OCR or “document AI” for .xlsx unless customers send PDFs; Excel is structured.

### 4.2 Handle variable layouts (deterministic-first)
Pipeline:
1. **Load workbook** with `openpyxl` in a safe mode:
   - read values (`data_only=False` for formula detection; `data_only=True` only after passing formula policy).
2. **Block policy: formulas**
   - detect formulas in candidate data ranges; if found → case status “Blocked: formulas present” → ask user to export values-only.
3. **Sheet selection**
   - score each sheet for “order-like” structure (presence of headers, density, currency/qty patterns).
   - if multiple close candidates → ask user to pick.
4. **Header row detection**
   - scan first N rows for “headerness score”.
5. **Tabular region extraction**
   - identify contiguous region below header with consistent row structure.
6. **Schema inference (strict)**
   - map columns to canonical fields using deterministic scoring + bounded LLM selection (section 4.3).
7. **Row extraction**
   - extract only from mapped columns; store evidence (sheet, row, column, raw cell value).
8. **Normalisation**
   - parse numbers with locale/currency handling, trim whitespace, normalise SKU/GTIN.
9. **Validation**
   - arithmetic checks, missing required, Zoho lookups.
10. **Canonical JSON output**
   - emit schema + issues.

### 4.3 Robust schema inference without adding LLM freedom (strict)
We combine:
- **Deterministic candidate generation** (high recall)
- **Deterministic scoring** (precision)
- Optional **LLM bounded selection** only when still ambiguous

#### 4.3.1 Candidate field detection
For each canonical field (CustomerName, SKU, GTIN, Quantity, etc.), compute candidates from:
- Header text similarity:
  - token match, synonyms dictionary (English + Farsi),
  - edit distance,
  - multilingual embedding similarity (use the deployed multilingual embed model if available).
- Value-type compatibility:
  - Quantity: mostly integers/decimals, non-negative
  - GTIN: 8/12/13/14 digits; optional check digit
  - UnitPrice: currency-like decimals
- Positional heuristics:
  - SKU/Description adjacent columns common
  - Quantity near UnitPrice/LineTotal common

#### 4.3.2 Confidence scoring (deterministic)
For each (field, column) pair compute:
- header_score (0–1)
- type_score (0–1)
- pattern_score (0–1)
- adjacency_score (0–1)
Combine with fixed weights and output:
- best_candidate
- runner_up
- confidence

#### 4.3.3 Bounded LLM disambiguation
Only if:
- confidence < threshold (e.g., 0.80) AND
- there are <= K candidates (e.g., 5)

Call the agent/committee with a tool request:
- Inputs: list of candidates + header strings + 5 sample values per candidate (masked if needed)
- Output: must choose one candidate per field from provided IDs; cannot create new columns.

If the committee disagrees (section 5.6), the issue becomes “human must choose”.

### 4.4 Multi-sheet files
- If workbook has multiple plausible sheets:
  - show top 3 candidates in Teams (sheet name + preview stats).
- If order spans multiple sheets (rare but possible):
  - v1 blocks and asks for a single-sheet export.

### 4.5 Hidden rows, merged cells, totals rows, formats
- Hidden rows/cols: ignore unless user requests; still log presence.
- Merged cells: expand header merges; for body merges, treat as suspicious.
- Totals rows: detect by keywords (“Total”, “Grand total”, “جمع”, “مجموع”) and by being near end with non-empty line total but empty SKU.
- Currency/locale:
  - parse currency symbols; store currency as detected but do not rely on it for Zoho pricing.
  - normalise decimal separators.

### 4.6 Explicit validation rules (v1)
**Required to create draft:**
- Customer resolved to a Zoho `customer_id` (or user selected).
- Each line resolved to a Zoho `item_id` via SKU primary, GTIN fallback.
- Quantity present (>= 0) for each line.

**Arithmetic checks (tolerant):**
- If UnitPrice and LineTotal exist:
  - check `abs(qty * price - line_total) <= max(0.02, 0.01*line_total)` (configure).
- If order total exists:
  - compare to sum of line totals within tolerance.
- Qty=0:
  - allowed with no warning; only arithmetic mismatch is flagged (e.g., qty=0 but line_total != 0).

**Ambiguity always noted:**
- Multiple fuzzy matches for customer or item.
- Multiple plausible header rows.
- Missing columns (e.g., no GTIN; OK).

### 4.7 Prevent hallucinations (hard requirement)
- The extractor produces **only fields grounded in the workbook**:
  - every extracted value includes evidence (`sheet`, `cell`, `raw_value`).
- LLMs never see the full workbook as free-form text; they only see:
  - candidate headers
  - small sample values
  - deterministic stats
- Any value not present is explicitly `null` and surfaced as an issue.

### 4.8 Canonical JSON schema (proposed)
```json
{
  "caseId": "GUID",
  "source": {
    "teams": {
      "tenantId": "GUID",
      "userAadId": "GUID",
      "chatId": "string",
      "messageId": "string"
    },
    "file": {
      "blobUri": "https://...",
      "sha256": "hex",
      "originalFileName": "string"
    }
  },
  "detectedLanguage": "en|fa|...",
  "customer": {
    "raw": { "value": "string|null", "evidence": [{"sheet":"S","cell":"A1","raw":"..."}] },
    "resolved": { "zohoCustomerId": "string|null", "zohoDisplayName": "string|null", "match": "exact|fuzzy|user-selected|null", "confidence": 0.0 }
  },
  "lines": [
    {
      "lineNo": 1,
      "sku": { "value": "string|null", "evidence": [] },
      "gtin": { "value": "string|null", "evidence": [] },
      "description": { "value": "string|null", "evidence": [] },
      "quantity": { "value": 0.0, "evidence": [] },
      "unitPriceSpreadsheet": { "value": 0.0, "evidence": [] },
      "lineTotalSpreadsheet": { "value": 0.0, "evidence": [] },
      "resolved": {
        "zohoItemId": "string|null",
        "match": "sku|gtin|user-selected|null",
        "confidence": 0.0,
        "zohoRateUsed": 0.0
      }
    }
  ],
  "totalsSpreadsheet": {
    "subtotal": { "value": 0.0, "evidence": [] },
    "total": { "value": 0.0, "evidence": [] }
  },
  "issues": [
    {
      "code": "MISSING_CUSTOMER|AMBIGUOUS_ITEM|FORMULAS_BLOCKED|ARITHMETIC_MISMATCH|...",
      "severity": "block|warn|info",
      "message": "string",
      "evidence": [{"sheet":"S","cell":"B12","raw":"..."}],
      "suggestedFix": "string",
      "requiresUserInput": true
    }
  ],
  "status": "needs-input|ready|draft-created|failed"
}
```

---

## 5. Foundry Agent design (deep dive)

### 5.1 Responsibilities (v1)
Agent:
- Reads parse output (canonical JSON + issues)
- Chooses among candidate mappings (bounded)
- Asks the user targeted questions / provides correction cards
- Produces correction patches in strict JSON format
- Calls tools to:
  - re-validate
  - (when approved) create Zoho draft via a deterministic “create_draft” tool

Deterministic components:
- Excel parsing and evidence creation
- Validation logic
- Zoho payload construction and idempotency
- Audit bundle persistence

### 5.2 Tooling approach
Expose tools to the agent via:
- OpenAPI tool definition(s) for:
  - `get_case(caseId)`
  - `revalidate_case(caseId, patch)`
  - `create_zoho_draft(caseId)`
  - `lookup_candidates(caseId, kind=customer|item, query=...)`
- Committee tool:
  - `committee_map_fields(caseId)` (bounded mapping only; no free-form extraction)

**Auth for tools (verify Foundry capabilities in Dec 2025):**
- Prefer Managed Identity for calling internal Azure APIs.
- Use APIM to enforce per-tool auth, throttling, and request/response logging.

### 5.3 State/memory handling
Persist across conversation:
- caseId and status
- user-provided corrections (patches)
- chosen customer/item resolutions
- committee votes + weights used
- correlation IDs

Do **not** store long-term in agent “memory”:
- full spreadsheet contents
- PII beyond what is needed for audit (you still retain artefacts in Blob per your retention policy)

### 5.4 Prompting strategy (v1)
System prompt principles:
- You are a “validator assistant”, not an extractor.
- You must not invent values; only select from candidates or ask the user.
- All corrections must be returned as strict JSON Patch operations.

Refusal / clarification behaviour:
- If the file is blocked (formulas/protected/multi-order): instruct re-upload with precise steps.
- If mapping ambiguous: ask user to select from options; always show evidence.

### 5.5 Tracing/observability plan
- Use Foundry Agent tracing for:
  - tool call spans
  - model call spans
  - conversation turn IDs
- Mirror critical events to application logs with the same `correlationId`.

### 5.6 3-provider committee (bounded, not over-engineered)
**Goal:** reduce single-model mapping mistakes while keeping determinism and avoiding complexity.

#### Inputs to committee
A compact “evidence pack” only:
- candidate header strings
- sample values
- column statistics
- language detection (English/Farsi)
- constraints (“must choose from candidate IDs only”)

#### Committee output
- per-field selected column ID
- per-field confidence
- list of disagreements (fields where votes differ)

#### Decision rule (v1)
- If all 3 agree and confidence >= threshold → accept.
- If 2/3 agree and the loser’s confidence is low → accept but mark as “verified by committee” (still review-first).
- If disagreement on **customer** or **item** mapping → require user selection.

#### Weight calibration using golden files (explained)
- Maintain a “golden set” of representative spreadsheets with ground truth mappings and expected canonical JSON.
- For each model, compute per-field accuracy and overall mapping accuracy.
- Compute weights, e.g.:
  - `w_model = logit(accuracy_model)` clipped to bounds
  - or simple normalised weights proportional to accuracy
- Use weighted voting when 2/3 disagree frequently (optional in v1, default in v2).

---

## 6. Zoho Books integration design

### 6.1 Authentication and secret handling
- Zoho Books uses OAuth 2.0 with refresh tokens (verify current Zoho flow).
- Store:
  - client_id / client_secret
  - refresh_token
  - organisation_id
  - EU DC base URL
in **Azure Key Vault**.

### 6.2 Required API calls (sequence)
1. Resolve customer:
   - exact/fuzzy by name (and user selection if ambiguous)
2. Resolve items:
   - primary: SKU/item_code
   - fallback: GTIN custom field value
3. Create draft sales order:
   - construct payload with `customer_id`, `line_items` with `item_id` and `quantity`
   - set status as “draft” according to Zoho Books API contract (verify exact field)

### 6.3 Idempotency / duplicate prevention
- Compute `orderFingerprint = sha256(fileSha256 + resolvedCustomerId + normalisedLineHash + orderDateBucket)`
- Store fingerprint in Cosmos with unique constraint.
- On retry/resend:
  - if fingerprint exists with Zoho salesorder_id → return existing link, do not recreate.
  - if fingerprint exists without Zoho id (in-flight) → continue same case.

### 6.4 Cache if Zoho API breaks (explicit requirement)
Two caches:
1. **Master data cache** (customers/items + rates) refreshed periodically:
   - used for validation and mapping when Zoho is down
2. **Draft-create queue**:
   - if Zoho create fails due to outage:
     - store payload + fingerprint in queue and mark case “Zoho unavailable”
     - retry with exponential backoff
     - notify user in Teams when succeeded/failed

### 6.5 What if lookup fails
Even though “customers/items exist” is assumed:
- If customer not found:
  - present top fuzzy matches; ask user to choose or re-enter customer name.
- If item not found:
  - ask user to confirm SKU or pick from candidates; allow user to type SKU that exists in Zoho (validated live).

### 6.6 Mapping extracted JSON → Zoho payload
- Use Zoho item rate; ignore spreadsheet unit price.
- Preserve spreadsheet unit price/line totals as custom fields or comments only if you want audit visibility (optional).

---

## 7. Security, compliance, and governance

### 7.1 Least privilege
- Azure:
  - Managed Identity for Functions/Container Apps.
  - Storage access via RBAC + SAS only for temporary internal use.
- Teams:
  - Bot only needs Teams channel; avoid Graph unless fallback needed.
- Zoho:
  - OAuth scopes limited to Sales Orders + Items/Contacts read (verify exact scopes in Zoho).

### 7.2 Data retention and blob storage design (≥ 5 years)
- Store all artefacts in Blob Storage:
  - original xlsx
  - extracted canonical JSON
  - committee votes + prompts (bounded packs)
  - user correction patches
  - Zoho request/response payloads
  - debug logs export (see 7.3)
- Use:
  - immutable storage policy (WORM) if you want tamper-evidence
  - lifecycle management to tier to cool/archive while retaining 5y

### 7.3 Debug-level audit of every transaction (explicit)
- Application-level audit events (append-only JSON lines) written per case.
- Enable Azure diagnostic settings for:
  - Functions, APIM, Storage, Cosmos, Foundry
to Log Analytics **and** archive to Blob Storage.

### 7.4 Threat model (key risks)
- Wrong customer/item mapping → mitigated by deterministic + committee + user approval.
- Duplicate Zoho orders → mitigated by idempotency fingerprint.
- Data leakage to external LLMs → mitigate by:
  - minimised evidence packs
  - allow-list providers
  - record in audit which provider received what
- Cross-tenant sign-in failures → mitigated by onboarding runbook and fallback.

---

## 8. Operational plan

### 8.1 Deployment approach
- IaC: Bicep or Terraform.
- CI/CD: GitHub Actions or Azure DevOps.
- Separate environments: dev/test/prod (separate resource groups and Key Vaults).

### 8.2 Monitoring/alerting
- Alerts on:
  - parse failures
  - Zoho outage / queue growth
  - committee disagreement spikes
  - duplicate fingerprint attempts
  - Teams bot errors

### 8.3 Runbooks
- “Zoho down” runbook: enable queue-only mode and inform users.
- “New customer format” runbook: add template mapping and golden file.
- “Model change” runbook: run golden files regression before switching model deployments (see v2 for canary policy).

### 8.4 Scaling
100–200 orders/day is light:
- Functions Consumption/Premium is sufficient.
- Use queue-based ingestion to smooth bursts.
- Committee can be limited to uncertain cases if cost ever rises (optional).

---

## 9. Implementation blueprint

### 9.1 Milestones (v1)
1. **Foundations**: storage, Key Vault, Cosmos, APIM, monitoring.
2. **Teams app**: bot + personal tab skeleton; cross-tenant install.
3. **Excel parser**: deterministic extraction + evidence + formula blocking.
4. **Zoho integration**: auth + customer/item lookups + create draft.
5. **Agent**: issue explanation + correction cards + tool calling.
6. **Committee**: bounded mapping tool + golden file calibration.
7. **Audit bundle**: write all artefacts and logs; retention policies.
8. **Pilot**: 20–50 real spreadsheets; expand golden set; harden.

### 9.2 Repo structure (suggested)
- `/apps/teams-bot/` (Bot Framework)
- `/apps/teams-tab/` (React/Next.js + Teams JS)
- `/services/parser/` (Functions Python)
- `/services/zoho/` (client + cache)
- `/services/committee/` (multi-provider wrapper)
- `/infra/` (Bicep/Terraform)
- `/tests/golden/` (xlsx + expected JSON)

### 9.3 Test strategy
- Unit tests: header detection, type parsing, validation, idempotency.
- Golden files: representative spreadsheets (English + Farsi headers).
- E2E: Teams upload → blob → parse → user correction → Zoho sandbox/prod test org.

### 9.4 Example code snippets (illustrative)

#### Read Excel (openpyxl) and detect formulas
```python
from openpyxl import load_workbook

def has_formulas(path: str) -> bool:
    wb = load_workbook(path, data_only=False, read_only=True)
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and cell.value.startswith("="):
                    return True
    return False
```

#### Simple header scoring sketch
```python
import re
from rapidfuzz import fuzz

SYNONYMS = {
  "sku": ["sku", "itemcode", "item code", "کد کالا"],
  "qty": ["qty", "quantity", "تعداد", "مقدار"],
}

def header_similarity(header: str, field: str) -> float:
    header_n = re.sub(r"\s+", " ", header.strip().lower())
    best = 0
    for syn in SYNONYMS.get(field, []):
        best = max(best, fuzz.token_set_ratio(header_n, syn)/100.0)
    return best
```

#### Validate totals (tolerance)
```python
def approx_equal(a: float, b: float, abs_tol=0.02, rel_tol=0.01) -> bool:
    return abs(a-b) <= max(abs_tol, rel_tol*max(abs(a), abs(b), 1.0))
```

#### Zoho call (pseudo)
```python
import requests

def zoho_create_sales_order(base_url, org_id, access_token, payload):
    r = requests.post(
        f"{base_url}/books/v3/salesorders",
        params={"organization_id": org_id},
        headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
```

---

## 10. Open questions and recommended discovery (still material)

See `WHAT_WE_NEED_TO_KNOW.md` for the detailed list. Key ones for this version:
- Confirm the exact Zoho item custom field identifier used for GTIN/EAN and how best to query it.
- Confirm cross-tenant Teams file download URL behaviour in your two tenants (preferred path vs Graph fallback).
- Confirm exact Zoho API fields required to create a “draft” Sales Order in your edition/DC and how to set it.

