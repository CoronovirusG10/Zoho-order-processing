# What we need to know (open questions and discovery)

These are the remaining unknowns that materially affect correctness, security, or implementation effort. Each item includes a concrete way to resolve it.

---

## 1) Zoho “Draft sales order” behaviour on create

**Question**: Does `POST /books/v3/salesorders` create a Sales Order in **Draft** state in your Zoho Books EU tenant, or does it default to `open`?

**Why this matters**: Your hard requirement is “create draft only”. If create defaults to open, we need an alternative path (e.g., a parameter/field to force draft, or an API to move from open back to draft, or an internal process change).

**How to answer (fast)**
1. Create a test customer + test item (already present per your assumption, or pick existing ones).
2. Call the create endpoint once with a minimal payload.
3. Inspect the returned `status` field in the response and confirm the state in the Zoho UI.
4. Check whether any request field (e.g., `status`) is accepted on create.

**What to record**
- Request payload and response payload (redact secrets)
- Status value returned
- Screenshot/confirmation in UI

---

## 2) Zoho API limits for your plan

**Known** (from Zoho Books docs): 100 requests/min per organisation, daily limits by plan, and concurrency guidance (Free: 5, Paid: 10 soft limit).

**Question**: Which plan are you on, and what is your current baseline API usage?

**How to answer**
- Check Zoho subscription plan.
- In Zoho Books, locate API usage / developer console metrics.
- Run a load test for 200 orders/day with worst-case lookup patterns and confirm you stay under limits.

---

## 3) Zoho OAuth EU endpoints and multi-DC configuration

**Question**: Which OAuth authorisation/token endpoints must be used for your EU tenant (accounts domain), and do you require any special configuration for EU DC?

**How to answer**
- Confirm the exact Zoho EU OAuth endpoints in Zoho’s OAuth documentation.
- Confirm your Books API base URL is `https://www.zohoapis.eu/books/`.
- Verify your app registration in the Zoho API Console has the correct server.

---

## 4) Teams file download permissions and least-privilege approach

**Question**: Can the bot download user-uploaded files in personal chat without broad Microsoft Graph application permissions? If Graph is required, what is the narrowest permission set that still works?

**How to answer**
1. Build a minimal bot that logs the attachment metadata and attempts to fetch the file.
2. If it fails, capture the error and determine whether Graph is needed.
3. If Graph is needed, test least-privilege options and document the minimum.

**Why it matters**: Graph permissions can be high-risk; you want the smallest surface area possible.

---

## 5) Azure AI Foundry Agents + model availability confirmation (Sweden Central, Dec 2025)

**Known (Microsoft docs, must be verified in your tenant)**:
- Sweden Central is listed as a supported region for Foundry Agent Service.
- Hub-based projects are limited to a smaller model set (notably gpt-4o/gpt-4o-mini/gpt-4/gpt-35-turbo).
- In Agent Service, gpt-5 models are restricted to Code Interpreter + File Search tools only (so they cannot be your main “tool-calling orchestrator” agent).

**Questions to verify**
- What **project type** are you using in Foundry (hub-based vs other)? This determines which agent models you can pick.
- Which **agent models** are actually selectable in your project in Sweden Central (gpt-4o vs gpt-4.1, etc.)?
- Is **tool calling to custom OpenAPI tools** enabled and working end-to-end?
- Is **tracing/observability** enabled, and can you export traces to your telemetry sink (Application Insights / Log Analytics)?
- Are any **connectors** you want (Logic Apps, OpenAPI tool import, storage tools) available/GA in your tenant?

**How to answer (practical)**
1. In Foundry (Sweden Central), create a tiny test agent and confirm:
   - the model picker options you see
   - tool calling works to a trivial internal API
   - a trace is produced and exportable
2. From CLI, list your deployments and the models available to deploy:
   - `az cognitiveservices account deployment list ...`
   - `az cognitiveservices account list-models ...`
3. Record:
   - model names + versions
   - deployment types (Standard vs Global Standard vs Provisioned)
   - upgrade policy (auto-upgrade on/off)

---

## 6\) Agent memory best practice (should we use it?)

**Question**: Do you want any long-term memory (e.g., user preferences), and if so, what is safe to retain?

**Recommendation (best practice)**
- Default to **no long-term memory** for order data and customer PII.
- If you use memory, restrict to low-risk preferences (e.g., preferred currency display, default tolerance settings) and ensure per-user scoping.

**How to answer**
- Confirm with your DPO/security team what may be stored long-term.
- Confirm the Foundry “memory” feature status (preview/GA), retention controls, and export/audit options.

---

## 7) Data retention and immutability details

**Known**: You want 24 months retention of everything in Azure Blob.

**Questions**
- Do you also require WORM/immutability (recommended for audit)?
- Do you need legal hold support?
- Who needs access to audit artefacts?

**How to answer**
- Confirm with compliance/legal.
- Decide whether to use storage immutability policies and what access model applies.

---

## 8) SKU-first fallback rules (implementation decisions)

**Question**: When SKU is missing/ambiguous, what fallbacks are acceptable?

**Recommended fallback order**
1. SKU exact match (normalised)
2. SKU normalised + known prefix/suffix rules (configurable per customer)
3. GTIN/EAN match (requires GTIN field in Zoho item master data)
4. Product name fuzzy match → must require user selection

**How to answer**
- Confirm whether GTIN/EAN is stored in Zoho (standard field or custom field).
- Collect 50–100 sample spreadsheets and measure match rates.

---

## 9) Spreadsheet format coverage

**Question**: How many distinct ERP/export formats do you need to support initially?

**How to answer**
- Collect a representative sample set (e.g., top 10 customers by volume).
- Classify by template/layout and prioritise.

---

## 10) Malware scanning requirement

**Question**: Do you require malware scanning for uploaded Excel files (strongly recommended)?

**How to answer**
- Confirm with security policy.
- Decide whether to enable Microsoft Defender for Storage, or implement a scanning function step.
