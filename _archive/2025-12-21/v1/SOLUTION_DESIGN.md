# Secure order intake and draft Sales Order creation (Azure-only)

**Objective**: Salespeople send incoming **Excel (.xlsx) sales order spreadsheets** to a **dedicated 1:1 Microsoft Teams chat** (bot). The system extracts and validates the order, asks the salesperson for corrections in Teams when required, and then creates a **Draft Sales Order** in **Zoho Books** via API — with strong auditability and traceability.

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

**Recommendation**: A **deterministic-led** pipeline for parsing/validation and Zoho writes, with **Azure AI Foundry Agents** used for:
- schema inference decisions when spreadsheets are ambiguous,
- generating a precise, structured list of issues,
- running the multi-turn Teams correction dialogue,
- translating user corrections into structured patches.

**Core services**
- **Teams bot (personal chat)** via Bot Framework (Teams app manifest).
- **Azure Durable Functions** for orchestration + state machine (parse → validate → ask → approve → create).
- **Azure Blob Storage** for immutable raw spreadsheets and derived artefacts (24-month retention).
- **Azure Cosmos DB** for case state, idempotency keys, and lookup caches.
- **Azure Key Vault** for Zoho OAuth secrets and organisation IDs.
- **Azure API Management (APIM)** (recommended) as a controlled egress proxy to Zoho.
- **Azure AI Foundry Agent Service** for agent-run reasoning and conversation.
- **Application Insights / Log Analytics** for telemetry.

**Why this is best for correctness and auditability**
- **Variable Excel layouts** require deterministic extraction for facts, and controlled agent reasoning only where ambiguity remains.
- **Minimising incorrect order creation** requires hard validation gates and explicit user approval before any write.
- **Auditability** requires immutable storage of original inputs and every derived artefact and decision.

### 1.2 Agent-led vs deterministic-led

**Deterministic-led** (recommended):
- Code is authoritative for extraction and validation.
- The agent cannot invent values; it can only:
  - choose among candidate column mappings,
  - ask the user targeted questions,
  - produce structured correction patches.

**Agent-led** (fastest to prototype, higher risk):
- The agent orchestrates and may attempt to infer values or proceed with incomplete facts.
- Requires much heavier guardrails to prevent silent mis-mapping and hallucinations.

### 1.3 Recommended workflow mode

**Safest possible (explicit)**: **Review-first**
- Always show extracted order + validation results.
- Require explicit “Approve & create draft” in Teams.
- Any ambiguity blocks creation.

**Hybrid (recommended after pilot)**
- Auto-create only for:
  - known templates,
  - high extraction confidence,
  - zero blocking issues,
  - no ambiguous customer/item matches.
- Everything else remains review-first.

**Fastest mode (explicit)**: Auto-create when validation passes
- Creates draft immediately when all validations pass.
- Risk: wrong mapping can still pass numeric validations.
- Requires:
  - strong idempotency,
  - strict “choose-only-from-candidates” mapping,
  - ongoing QA sampling and alerts.

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

## 2. Architecture options (3+)

### Option A — Teams bot → Logic Apps → Foundry Agent → Zoho

**Text diagram**
1. Teams user uploads Excel file to bot.
2. Bot stores raw file in Blob and triggers Logic App.
3. Logic App calls Foundry Agent for mapping + issue generation.
4. Logic App calls parsing/validation (custom code) and then calls Zoho.
5. Bot replies with results.

**Azure services**
- Teams bot (Bot Framework)
- Azure Logic Apps
- Azure AI Foundry Agent Service
- Azure Blob Storage
- Azure Key Vault
- APIM (optional but recommended)
- App Insights/Log Analytics

**How Teams triggers it**
- Bot calls a Logic Apps HTTP trigger (or writes to a queue that triggers Logic Apps).

**Where Foundry Agent fits**
- Logic Apps invokes agent runs for mapping and message generation.

**Operational complexity**
- Moderate. Logic Apps is strong for orchestration but weak for complex XLSX parsing unless you embed Functions.

**Cost drivers**
- Logic Apps actions/connectors
- Foundry tokens
- Storage and logging

**Failure modes**
- Complex multi-turn Q&A and state machine are awkward in Logic Apps unless carefully designed.
- Excel parsing often becomes a “custom function” anyway.

**When to choose**
- If the organisation strongly prefers low-code and you are willing to keep parsing/validation in custom code components.

---

### Option B — Teams bot → Durable Functions (parser + validator + orchestrator) → Foundry Agent → Zoho  **(recommended)**

**Text diagram**
1. Teams user uploads Excel file.
2. Bot stores raw file in Blob (immutable) and starts Durable Functions orchestration.
3. Orchestrator runs deterministic parse + validations.
4. Orchestrator calls Foundry Agent to resolve ambiguous mappings and generate correction questions.
5. Orchestrator waits for user responses in Teams.
6. After approval, orchestrator calls Zoho via an internal Zoho proxy (APIM/Function).
7. Stores all artefacts and sends final Teams confirmation.

**Azure services**
- Bot Framework (Teams)
- Azure Durable Functions
- Azure Blob Storage
- Azure Cosmos DB
- Azure Key Vault
- Azure API Management (recommended)
- Azure AI Foundry Agent Service
- App Insights/Log Analytics
- Service Bus (recommended for decoupling Zoho writes)

**How Teams triggers it**
- Bot receives activity → calls durable starter endpoint with message + attachment metadata.

**Where Foundry Agent fits**
- Used for schema inference (mapping choices) and user-facing correction prompts.

**Operational complexity**
- Medium. More code, but strongest control over correctness, idempotency and audit.

**Cost drivers**
- Functions compute
- Cosmos RU/s
- Foundry tokens
- APIM
- logging/storage

**Failure modes**
- Spreadsheet edge cases → mitigated via golden-file tests.
- Zoho throttling/rate limits → mitigated via queue, concurrency caps, retries.

**Why recommended**
- Best balance of implementability, correctness and auditability.

---

### Option C — Teams bot → Foundry Agent as primary orchestrator (tools: parse/validate/Zoho)

**Text diagram**
1. Bot forwards each message/file to the Agent thread.
2. Agent calls tools:
   - parseExcel()
   - validate()
   - lookupZohoCustomer/items()
   - createDraftSalesOrder()
3. Agent runs multi-turn Q&A, then requests approval.
4. After approval, tool creates draft in Zoho.

**Azure services**
- Bot Framework (Teams)
- Foundry Agent Service
- Azure Functions/Container Apps as tools
- Blob Storage + Cosmos DB + Key Vault
- App Insights/Log Analytics

**Operational complexity**
- Medium to prototype quickly.
- Harder to guarantee deterministic ordering unless tool contracts are strict.

**Cost drivers**
- Potentially higher token usage (agent orchestrates)

**Failure modes**
- Higher risk of unintended tool use and “reasonable sounding” but incorrect conclusions unless the tool layer is strict.

**When to choose**
- When you want the agent as the single orchestrator and can invest in very strict tool contracts and validations.

---

### Recommended option
**Option B** (Durable Functions orchestration, deterministic parsing/validation, agent for mapping + Q&A, deterministic Zoho write tool).

---

## 3. Teams 1:1 experience design

### 3.1 Interaction principles
- The bot must be usable in a **personal (1:1) Teams chat**.
- The bot must provide:
  - immediate acknowledgement + tracking ID,
  - a review card that is easy to validate,
  - correction prompts that are precise and bounded,
  - an explicit approval gate.

### 3.2 User flow (review-first)
1. User uploads `.xlsx` in the 1:1 chat.
2. Bot responds:
   - received file name
   - correlation ID
   - “processing” status
3. Bot posts an Adaptive Card with:
   - detected customer
   - extracted line items table
   - extracted totals (if present)
   - validation summary (pass/warn/fail)
   - issues list (with severity)
   - actions: Fix now / Upload revised / Cancel
4. Multi-turn corrections:
   - present a minimal set of questions to resolve blocking issues
   - capture each correction as a structured patch
5. Final review card:
   - full summary
   - “changes made” section
   - “Approve & create draft sales order” button
6. After approval:
   - create Zoho draft sales order
   - return Zoho ID/number + audit ID

### 3.3 Corrections model
- Each correction is a JSON Patch entry:
  - `path`, `old_value`, `new_value`, `actor`, `timestamp`.
- Corrections are applied to a canonical JSON schema.

### 3.4 Revised uploads vs inline corrections
- Treat each upload as a new revision under the same correlation ID.
- Store each revision immutably.
- When a revised file is uploaded, rerun extraction and show a diff.

---

## 4. Excel ingestion and extraction strategy

### 4.1 Deterministic extraction first
**Non-negotiable**: extracted values must come from the spreadsheet cells; the agent must not produce values.

**Recommended stack (Python)**
- `openpyxl` (cell-level extraction; merged cells; hidden rows/cols)
- `pandas` (optional for working with extracted rectangular tables)
- `rapidfuzz` (fuzzy header matching)
- `decimal.Decimal` (currency-safe arithmetic)

### 4.2 Handling variable column names/layouts

#### Step A — Workbook normalisation
For each sheet:
- expand merged cells (propagate the top-left merged value)
- record hidden rows/columns (metadata)
- preserve number formats and raw string representations

#### Step B — Candidate line-item table detection
- scan rows for header-like patterns:
  - high string density
  - contains SKU/Qty/Price/Total/Description synonyms
- grow a table range downward until blank threshold
- score each candidate table and pick the best (keep alternates as fallback)

#### Step C — Schema inference (hybrid)
- deterministic: synonym dictionary + regex + type consistency scoring
- agent-assisted: only to break ties or handle unfamiliar headers

**Guardrail**: agent selects only from *explicit candidates* provided by the parser (column headers + sample values + numeric/text stats). The agent may return “unknown” and request user input; it must not invent.

### 4.3 Multi-sheet files
- score each sheet for order-likeness
- if ambiguous, ask user to choose sheet
- always retain all sheet scores and rationale in audit

### 4.4 Hidden rows, merged cells, totals rows, currency formats
- ignore hidden rows/cols by default in table detection
- merged cells normalised
- totals rows detected via keywords (“total”, “subtotal”, “grand total”)
- parse currency symbols and/or currency codes; store both raw and normalised numeric value

### 4.5 Validation rules

**Blocking (must resolve)**
- customer cannot be resolved to a single Zoho customer
- any line item cannot be resolved to a single Zoho item
- missing quantity / missing unit price (unless policy says default 0 is allowed; recommended: ask)

**Arithmetic consistency**
- if quantity, unit price, line total exist:
  - `abs(qty × unit_price − line_total) <= tolerance`
- if totals exist:
  - compare sum(line totals) vs subtotal/grand total within tolerance (account for taxes/discounts if present)

**Quantity = 0 policy (safest)**
- quantity=0 is allowed (hard requirement), but treat as a **blocking confirmation**:
  - user must explicitly confirm “keep as 0” or edit/remove line

### 4.6 Preventing hallucinations
- enforce “evidence required” for every value:
  - sheet + cell/range + raw value
- agent never outputs extracted values; only mapping choices and correction patches

### 4.7 Canonical JSON schema
Use a schema that includes:
- correlation metadata
- file hash
- extracted fields with evidence
- validation results + issue list
- user corrections as patches
- Zoho mapping results + final Zoho IDs

(See `MVP_AND_HOWTO.md` for an example canonical schema and sample issue codes.)

---

## 5. Azure AI Foundry Agent design (deep dive)

> **Verification note (Dec 2025)**: Sweden Central is listed as a supported region for Agent Service, with a note that access may require authorisation. Private networking guidance also indicates workspace resources must be in the same region as the VNet. You must verify the full Agent capability set (tool calling/connector maturity/tracing/memory) against the Microsoft Learn “Agents overview” and linked pages in your tenant and region.

### 5.1 Responsibilities split

**Deterministic components (code)**
- file download + hashing + storage
- XLSX parsing and extraction
- validation and gating
- Zoho API calls and idempotency
- audit artefact persistence

**Agent responsibilities**
- schema inference tie-breaking
- generating a structured issues list
- prompting the user for corrections (multi-turn)
- converting user input into structured patches

### 5.2 Tooling approach (recommended)
Expose narrow internal tools (Functions behind APIM) and allow the agent to call only these tools.

Suggested tools:
- `ParseExcel(blob_uri, correlation_id)` → candidates + mapping proposals + evidence
- `ValidateOrder(canonical_json)` → issues list + computed totals
- `LookupZohoCustomer(name)` → candidate customers
- `LookupZohoItems(sku_list, gtin_list, name_list)` → candidate items
- `CreateZohoDraftSalesOrder(canonical_json, idempotency_key, approval_record)` → Zoho ID
- `WriteAuditArtifact(type, uri, sha256)` → write-only audit record

**Key guardrails**
- `CreateZohoDraftSalesOrder` tool refuses unless:
  - validation status is pass (or warn with explicit acceptance rules)
  - user approval exists
  - idempotency key not already used

### 5.3 State/memory handling
- Treat agent memory as *non-authoritative*.
- Authoritative state stored in Cosmos DB:
  - correlation ID
  - step/state
  - references to blob artefacts
  - user corrections

### 5.4 Prompting strategy
System prompt principles:
- never invent values
- only choose from tool-provided candidates
- ask clarifying questions when ambiguous
- output strict JSON for:
  - mapping decisions
  - issue list
  - correction patches

### 5.5 Observability and tracing
- propagate a single correlation ID across:
  - Teams message
  - storage artefacts
  - function logs
  - agent runs
  - Zoho calls
- store tool inputs/outputs as hashed artefacts in blob

---

## 6. Zoho Books integration design (EU)

### 6.1 Verified limits (must design for)
- **100 requests per minute per organisation** and daily limits depend on plan.
- Concurrency limit: 5 (Free) / 10 (Paid soft limit).

### 6.2 Base URL for EU
Use the EU domain for Zoho Books APIs (verify your tenant DC):
- `https://www.zohoapis.eu/books/v3/...`

### 6.3 Authentication
- OAuth 2.0 with refresh token.
- Store refresh token + client secret in Azure Key Vault.
- Cache access token and refresh only when needed.

### 6.4 Required call sequence
1. Resolve customer (search by name; if ambiguous, user selection required).
2. Resolve items (SKU first; fallback GTIN; last resort fuzzy name + user selection).
3. Create Sales Order via API.
4. Confirm returned status is **draft** (draft-only requirement).

**Draft-only requirement**
- Draft status appears in Zoho workflow, but you must verify whether create defaults to draft or open in your tenant and whether a create parameter controls status.

### 6.5 Idempotency and duplicates
- Compute idempotency key from file hash + organisation + (optional) normalised customer + line signatures.
- Store key in Cosmos DB to prevent duplicates.
- Optionally use Zoho custom-field unique identifier upsert if validated in your tenant.

### 6.6 Error handling and retries
- Use queue-based Zoho write step.
- Handle 429 with backoff + jitter.
- Dead-letter after max attempts and notify user.

---

## 7. Security, compliance, and governance

### 7.1 Least privilege
- Managed Identity for Azure-to-Azure calls.
- Key Vault secrets only accessible by Zoho integration component.
- Bot identity cannot read Key Vault secrets.

### 7.2 Data retention
- Retain all artefacts in Azure Blob for **24 months**.
- Use immutability policies and versioning.

### 7.3 Audit design (append-only)
- Write a structured audit event for every transition.
- Store as append-only artefacts in blob + operational logs in Log Analytics.

### 7.4 Threat model
Key risks:
- hallucination or mis-mapping → deterministic extraction + evidence requirement + approval gate
- duplicate orders → idempotency
- data leakage → strict egress allowlist and private endpoints where possible
- malware in uploads → scan and reject macros by default

---

## 8. Operational plan

### 8.1 IaC and deployment
- Use Bicep/Terraform to deploy all Azure resources.
- Separate dev/test/prod with separate app registrations and Key Vault.

### 8.2 Monitoring/alerting
- alerts for parsing failure rate spikes
- Zoho 429 spike alerts
- DLQ depth
- high duplicate detection rate

### 8.3 Runbooks
- Zoho throttling: reduce concurrency, replay from queue
- customer/item mismatch: request user selection
- parse failures: request revised export and add golden-file case

### 8.4 Scaling
- 100–200/day is modest; design for burst.
- queue + capped concurrency is sufficient.

---

## 9. Implementation blueprint

### 9.1 Milestones
1. Foundations: bot + storage + audit + correlation ID.
2. Parser/validator MVP with golden-file tests.
3. Agent integration for mapping + correction prompts.
4. Zoho integration with idempotency and retry.
5. Production hardening (security, monitoring, DLQ, retention policies).

### 9.2 Repo structure
(see `MVP_AND_HOWTO.md` for a suggested repository layout)

### 9.3 Test strategy
- unit tests for parsing/validation
- golden-file regression suite
- end-to-end tests against Zoho test org

### 9.4 Code snippets
See `MVP_AND_HOWTO.md` for runnable pseudo-code and implementation patterns.

---

## 10. Open questions and discovery

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
