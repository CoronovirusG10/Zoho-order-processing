# MVP and how-to (v1 safest possible)

**Last updated:** 2025-12-30

This is a concrete build plan for a pilot MVP that is safe and auditable.

---

## Current Deployment Status (2025-12-29)

### ✅ DEPLOYED - 100% Complete

| Milestone | Status | Notes |
|-----------|--------|-------|
| 1. Storage + Audit | ✅ COMPLETE | 4 blob containers, lifecycle configured |
| 2. Case State + Idempotency | ✅ COMPLETE | 6 Cosmos containers created |
| 3. Zoho Connectivity | ✅ COMPLETE | Sandbox API 4/4 endpoints working |
| 4. Excel Parser | ✅ COMPLETE | Temporal fixed, workflow processing enabled |
| 5. Teams Bot UX | ✅ COMPLETE | Bot online, credentials validated |
| 6. Personal Tab UX | ✅ COMPLETE | Build passes, deployed |
| 7. Committee | ✅ PARTIAL | 10/12 AI models reachable |
| 8. Observability | ✅ COMPLETE | App Insights configured |

**Production Domain:** `https://processing.pippaoflondon.co.uk`

**Teams App:** Kozet (deployed to 13 users via KozetSales policy)

**Status:** All blockers resolved. Ready for production validation.

---

## MVP scope (what is in / out)

### In scope
- Teams 1:1 bot receives **.xlsx** files (one file = one order).
- Deterministic parsing + strict schema inference + evidence tracking.
- Bot posts an Issues card; user corrects; loop until “ready”.
- Create **Draft Sales Order** in Zoho Books (EU DC).
- Long-term retention of **all artefacts + logs** in Azure Blob (≥ 5 years).
- Personal tab: “My cases” (SalesUser) and “Team cases” (SalesManager).
- 3-model committee used for bounded mapping cross-check.

### Out of scope for MVP
- Creating new Zoho customers/items.
- Automatic invoicing/dispatch.
- Multi-order spreadsheets (blocked).
- Workbooks requiring formula evaluation (blocked).
- Non-Excel formats.

---

## Target Azure services (Sweden Central)

- Azure Bot Service (Teams channel) + Bot Framework runtime (Functions or Container Apps)
- Azure Functions (Python): parser/validator, Zoho client, committee wrapper
- Azure AI Foundry: Hub/Project + Agent Service
- Azure Storage account:
  - Blob containers: `orders-incoming`, `orders-audit`, `logs-archive`
  - Queue or Service Bus for case processing
- Cosmos DB (serverless or provisioned): `cases`, `fingerprints`, `agentThreads`
- Key Vault: Zoho OAuth secrets; optional external LLM keys
- API Management (optional for MVP; recommended for prod)
- Azure Monitor: Application Insights + Log Analytics + diagnostic archive to Blob

---

## Cross-tenant Teams deployment (Tenant A hosting, Tenant B users)

Follow `CROSS_TENANT_TEAMS_DEPLOYMENT.md`.

**MVP recommendation:** start with bot + tab as a **custom app uploaded by Tenant B admin** (not Teams store publishing).

---

## Step-by-step build plan

### Milestone 1 — Storage + audit foundations
1. Create Storage account (Sweden Central).
2. Create blob containers:
   - `orders-incoming` (raw xlsx)
   - `orders-audit` (immutable audit bundles)
   - `logs-archive` (exported platform logs)
3. Configure:
   - versioning (optional)
   - lifecycle: hot → cool → archive while retaining ≥ 5 years
   - immutable policy (if required)

### Milestone 2 — Case state + idempotency
1. Cosmos DB:
   - `cases` container (partition by `tenantId`)
   - `fingerprints` container with unique index on `fingerprint`
2. Define the case schema (see SOLUTION_DESIGN.md section 4.8).

### Milestone 3 — Zoho connectivity
1. Create Zoho OAuth client; obtain refresh token (manual auth code flow).
2. Store secrets in Key Vault.
3. Implement:
   - token refresh
   - customer lookup
   - item lookup (SKU primary; GTIN custom field fallback)
   - create draft sales order
4. Add idempotency fingerprint checks before create.

### Milestone 4 — Excel parser/validator (Functions)
1. Implement upload ingestion:
   - Bot downloads file using Teams attachment download URL.
   - Store to `orders-incoming/<caseId>/original.xlsx`
2. Parser:
   - detect formula cells; block if present in candidate data ranges
   - detect sheet + header row + tabular region
   - map columns using deterministic scoring
   - emit canonical JSON + issues list + evidence
3. Validator:
   - required fields
   - arithmetic tolerance checks
   - ambiguity flags

### Milestone 5 — Teams bot UX (chat)
1. Bot receives file message:
   - replies with “Processing…” + correlation ID
2. Bot posts:
   - summary card
   - issues card with inputs
3. Bot accepts card submissions:
   - store user patch in Cosmos
   - call re-validate
4. When ready:
   - show “Create draft” button
   - on click: call Zoho create tool and post result

### Milestone 6 — Personal tab UX (My cases + manager view)
1. Host tab web app (App Service / Static Web Apps).
2. Implement Teams tab SSO.
3. Show:
   - My cases list (user ID filter)
   - Team cases list for SalesManager role
4. Provide deep links:
   - to Teams chat message
   - to Zoho draft
   - to audit bundle (download via time-limited SAS)

### Milestone 7 — Committee (bounded mapping cross-check)
1. Implement committee wrapper:
   - call 3 models (start with Azure-deployed ones)
   - each returns mapping choices only
2. Aggregator:
   - detect disagreement
   - produce a “needs human choice” issue when required

### Milestone 8 — Observability and log retention
1. Add Application Insights instrumentation:
   - correlationId = caseId
   - log every event (download, parse, validate, committee, Zoho request/response)
2. Configure diagnostic settings to export logs to Blob for ≥ 5 years.

---

## How to operate the MVP pilot

### Golden files
- Collect 30–50 representative spreadsheets (include Farsi cases).
- Build expected canonical JSON for each.
- Run parser+validator nightly; track drift.

### Go/no-go criteria
- <1% of created drafts require rework due to mapping errors (target; adjust)
- 0 duplicate drafts from retries/resends (idempotency holds)
- Audit bundle completeness for 100% of cases

---

## What to verify early (risk reducers)
1. Cross-tenant Teams bot file download URL works reliably in your tenants.
2. Zoho API: exact fields needed to create “draft” sales order in your org.
3. GTIN custom field API identifier and best query strategy.

