# What we need to know (v2 open questions and discovery)

These are the remaining unknowns that materially affect correctness, security, implementation effort, or the new **3-provider committee** requirement. Each item includes a concrete way to resolve it.

---

## 1) Which three model providers are acceptable (legal/procurement)

**Question**: Are you allowed to use non-Microsoft model providers (e.g., Meta, Mistral, Cohere, Anthropic) *via Azure AI Foundry* for production data?

**Why it matters**: “Azure-only” hosting can still include **Non-Microsoft Products** delivered through Azure, which may have different commercial terms and data-handling clauses.

**How to answer**
- Ask procurement/legal:
  - Are partner models via Azure AI Foundry approved for production?
  - Any prohibited vendors?
  - Any restrictions on customer/company names leaving Microsoft-only services?
- If uncertain, default to **three Azure OpenAI models** (weaker independence) until approved.

---

## 2) Region + data residency for the committee (Sweden Central / EU)

**Question**: Can you deploy all three committee models so that they meet your **region/data residency** constraints?

**Known (from Microsoft docs; verify in your tenant/project)**
- Agent-supported Azure OpenAI models are listed for Sweden Central (including gpt-4o and gpt-4.1 families) but project type matters (hub-based projects have a smaller allowed set).
- Some partner models in Foundry are offered as **Global Standard** deployments (traffic may be routed globally), even if the hub/project region is Sweden Central.

**Practical recommendation**
- Define your residency requirement explicitly:
  - “Processing must stay in Sweden Central” (strictest)
  - “Processing must stay within the EU” (common)
  - “Global routing is acceptable” (least strict)
- Then pick the committee accordingly.

**Concrete committee candidates (Sweden Central)**
- **Cohere Command R+ (08-2024)** is documented as deployable with hub/project region including Sweden Central.
- **Claude 4.5 family** (Opus/Sonnet/Haiku) is documented as available in Foundry via **global standard** deployment, with serverless availability including Sweden Central as a hub/project region.

(You still must confirm the exact model cards you can deploy in *your* Foundry hub/project, because offer availability and previews change.)

**How to answer (practical)**
1. In Azure AI Foundry, open the model catalogue for your Sweden Central hub/project.
2. Filter for “Deployable” and confirm three models from three providers are available.
3. Record:
   - model name + version
   - provider
   - deployment type (Standard vs Global Standard vs Provisioned)
   - any “preview” flags
   - pricing + quotas
4. From CLI, also list current deployments and deployable models:
   - `az cognitiveservices account deployment list ...`
   - `az cognitiveservices account list-models ...`

**If you cannot meet residency constraints**
- Keep the committee inside Azure OpenAI only (three different Azure OpenAI deployments), and compensate with stronger deterministic checks and higher sampling/review.

---

## 3\) Committee contract: what each model is allowed to see

**Question**: Are you comfortable sending sample line items (SKU/description/prices) and customer name to three separate model providers?

**Recommendation (safest)**
- Minimise what you send:
  - header text + type stats + 5–10 sample rows
  - **mask** customer name unless the mapping task requires it
- Never send the whole XLSX binary to models.

**How to answer**
- Confirm with DPO/security:
  - Is this data classified as PII or commercially sensitive?
  - Are redaction/masking requirements mandated?

---

## 4) How “Draft Sales Order” works on create in your Zoho Books EU tenant

**Question**: Does `POST /books/v3/salesorders` create a sales order in **Draft** status by default in your tenant, and can you *force* draft if not?

**How to answer (fast)**
1. In a Zoho sandbox/test org (or a safe test window in prod):
   - create a test order via API with a known customer + item.
2. Check the returned `status` field and confirm in the Zoho UI.
3. If it is not Draft:
   - confirm whether a request field controls it
   - or whether there’s an API to revert to draft

**What to store**
- Request payload + response payload (redact tokens)
- Screenshot of the resulting order status in UI

---

## 5) Zoho OAuth and EU endpoints

**Question**: Which Zoho OAuth endpoints and Books API base URL apply to your tenant (EU DC), and do you require “multi-DC” configuration?

**How to answer**
- Confirm in Zoho developer console:
  - data centre
  - authorised redirect URLs
- Use `GET /organizations` and record which base URL works.

---

## 6) Teams file download permissions (least privilege)

**Question**: Can the bot download user-uploaded files in a personal chat without broad Microsoft Graph application permissions?

**How to answer**
- Build a minimal bot that:
  - receives attachment metadata
  - attempts download using Bot Framework attachment APIs
- If Graph is required:
  - test the smallest permission set and document it.

---

## 7) Azure AI Foundry Agents feature availability in your tenant/region

**Questions to verify**
- Is **Agent Service** enabled in your subscription in Sweden Central?
- Are tracing/observability exports available?
- Are tool calling and OpenAPI tools supported as you need them?
- Is there an **Azure Logic Apps connector** for Agent Service, and is it preview or GA for your environment?

**How to answer**
- Create a proof-of-concept Foundry agent in Sweden Central.
- Validate:
  - tool calling
  - run tracing
  - exporting traces to Application Insights
  - any connector usage

---

## 8) Committee effectiveness targets

**Question**: What disagreement rate is acceptable before you classify a template as “needs onboarding”?

**Recommendation**
- Start with:
  - if committee disagrees on any of SKU/Qty/Price/Total → block
  - track disagreement rate per customer/template
  - after ≥20 clean runs for a template, allow “known template” shortcuts

**How to answer**
- Define KPIs:
  - % auto-approved (with review) vs % requiring correction
  - false-positive blocks
  - false-negative errors (should be 0)

---

## 9) SKU-first fallback rules (confirm details)

**Question**: When SKU is missing/ambiguous, which fallbacks are acceptable and in what order?

**Recommended default**
1. SKU exact match (normalised)
2. SKU normalised + known prefix/suffix rules (configurable per customer)
3. GTIN/EAN exact match (requires GTIN in Zoho item master)
4. Product name fuzzy match → **must require user selection**

**How to answer**
- Confirm whether GTIN/EAN exists in Zoho (standard field vs custom field).
- Collect 50–100 sample spreadsheets and measure match rates.

---

## 10) Retention + immutability specifics

**Known**: 24 months retention, everything in Azure Blob.

**Questions**
- Do you require WORM/immutability policy enforcement?
- Do you require legal hold?
- Who is allowed to read audit artefacts?

**How to answer**
- Confirm with compliance/legal.
- Decide the access model (RBAC roles + storage SAS prohibition, etc.).

---

## 11) Malware scanning requirement

**Question**: Do you require malware scanning for uploaded XLSX files?

**Recommendation**
- Treat it as required unless explicitly waived.

**How to answer**
- Confirm with security policy.
- Decide whether to enable Microsoft Defender for Storage (or a scanning function step).
