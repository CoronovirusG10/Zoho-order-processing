# MVP and how-to build plan (implementation checklist)

This is a practical build plan for a **review-first** pilot that can be production-hardened. It assumes:
- Azure region: **Sweden Central**
- Zoho Books data centre: **EU**
- Retention: **24 months** for raw + derived artefacts in Azure Blob
- Matching strategy: **SKU-first**, with controlled fallbacks

---

## A. MVP definition (what to build first)

### MVP goal
Reduce manual data entry while preventing incorrect Zoho draft sales order creation.

### MVP scope (recommended)
1. Teams 1:1 bot receives `.xlsx` and returns a tracking ID.
2. Store original spreadsheet in Blob with immutability settings.
3. Deterministically extract:
   - customer name (where present)
   - line items (SKU, description, quantity, unit price, line total)
   - totals (if present)
4. Deterministic validation with clear issue codes.
5. Teams correction loop (user selects/edits missing/ambiguous fields).
6. Explicit approval button.
7. Create **Draft** sales order in Zoho Books **only after approval**.
8. Full audit bundle stored in Blob for 24 months.

### MVP non-goals
- No creation of customers/items in Zoho.
- No invoices/shipments/fulfilment.
- No group chat support (personal chat only).
- No reliance on agent long-term memory.

---

## B. End-to-end build steps

### Step 1 — Set up Azure resources (Sweden Central)
**Recommended resources**
- Storage account (Blob) with containers:
  - `original/` (raw XLSX)
  - `artifacts/` (canonical JSON, validation report)
  - `audit/` (append-only event log)
- Azure Functions (Durable Functions) app
- Cosmos DB (case state + idempotency + lookup cache)
- Key Vault (Zoho secrets)
- Application Insights / Log Analytics
- (Recommended) Service Bus (queue) and APIM (Zoho proxy)

**IaC**
- Use Bicep or Terraform.

**Blob retention**
- Enable versioning + immutability policy for 24 months.
- Enable soft delete.

### Step 2 — Teams bot (personal chat)
**Work items**
- Create a Teams app manifest with a bot entry.
- Ensure file support is enabled in the manifest (Teams requires this for bot file workflows).
- Implement:
  - message handler
  - attachment download
  - reply with Adaptive Cards
  - handle submit actions from cards (“Approve”, “Fix”, “Cancel”)

**Key implementation pattern**
- Each upload creates/updates an `OrderCase` record keyed by `correlation_id`.
- All subsequent messages in the chat route to the same case until closed.

### Step 3 — File ingestion and immutability
**Work items**
- Download the attachment bytes.
- Compute SHA-256.
- Write to Blob at:
  - `original/<correlation_id>/revision_001/<filename>.xlsx`
- Emit audit event `RECEIVED_FILE`.

### Step 4 — Deterministic Excel parsing (Python)
**Work items**
- Workbook scan:
  - find likely line-item table(s) across sheets
  - score and pick best candidate (or ask user)
- Header mapping candidates:
  - synonyms + fuzzy match
  - sample value typing
- Extract rows into canonical JSON with evidence:
  - sheet + cell address

**Golden-file tests**
- Collect 30–50 real (sanitised) exports.
- Store expected extracted JSON and issue lists.

### Step 5 — Validation engine
**Blocking issues (fail)**
- missing customer
- missing SKU on any line (unless a deterministic GTIN fallback resolves)
- item lookup ambiguous/unresolved
- customer lookup ambiguous/unresolved
- totals mismatch beyond tolerance
- quantity < 0

**Warnings (warn)**
- quantity == 0 (requires explicit user decision)
- missing totals in file
- minor rounding mismatch

### Step 6 — Foundry Agent integration (mapping + issue generation + Q&A)
**MVP usage of the agent**
- agent receives:
  - candidate header mappings + scores
  - sample rows (masked if required)
  - current validation issue list
- agent outputs:
  - mapping decision (choose among candidates only)
  - a structured issue list (codes already present from validator)
  - a user-facing message + recommended next question

**Guardrail**
- The agent never outputs numeric values.
- The agent only chooses column IDs you provide.

### Step 7 — Correction loop in Teams
**Adaptive Cards**
- Use cards for:
  - selecting customer from a list
  - selecting item for ambiguous SKU
  - editing missing quantity/price
  - confirming quantity=0 policy

**Store corrections**
- Persist as JSON Patch operations:
  - who (AAD id)
  - when (UTC)
  - old/new values

### Step 8 — Zoho Books integration (EU)
**Core requirements**
- Use EU domain base URL: `https://www.zohoapis.eu/books/` (verify your tenant).
- Respect rate limits:
  - 100 requests/min/org
  - concurrency soft limit ~10 for paid orgs

**Implementation**
- Token broker:
  - cache access token
  - refresh only when needed
- Lookups:
  - customer by name
  - items by SKU
- Create sales order:
  - only after approval

**Critical verification**
- Confirm whether `POST /salesorders` creates a draft by default, and how to force draft if not.

### Step 9 — Audit bundle
For every case, store:
- original XLSX
- parsed table JSON (raw rows)
- canonical extracted order JSON
- validation report
- user correction patches
- Zoho payload snapshot
- Zoho response metadata

All stored in Blob under the same correlation_id.

---

## C. Recommended Azure CLI checks (run from your own VM)

> I cannot run commands on your VM from here. Use the commands below on your Sweden Central VM to confirm resources.

### Confirm region and resource inventory
```bash
az account show
az group list -o table
az resource list -g <rg> --query "[].{name:name,type:type,location:location}" -o table
```

### Confirm Storage immutability policy
```bash
az storage account show -n <storage> -g <rg>
az storage container immutability-policy show --account-name <storage> --container-name original
```

### Confirm Function App settings

### Confirm Azure OpenAI / Foundry model deployments (and what you can deploy)
```bash
# List deployed model deployments (names/versions/capacity)
az cognitiveservices account deployment list -g <rg> -n <openaiResourceName> -o table

# List models available to deploy for this resource (availability can be region/quota constrained)
az cognitiveservices account list-models -g <rg> -n <openaiResourceName> -o table
```

If you need a pure-REST alternative for automation/audit:
```bash
# Management plane list deployments (API version may change; verify in Microsoft docs)
curl -sS -H "Authorization: Bearer $(az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv)" \
  "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/deployments?api-version=2025-06-01"
```

```bash
az functionapp show -g <rg> -n <funcApp> --query "{name:name,location:location,state:state,kind:kind}" -o json
```

---

## D. MVP acceptance criteria

- Uploading an Excel file produces:
  - correlation_id
  - extracted preview card
  - clear issue list if problems exist
- User can correct issues and then approve.
- On approval, a Zoho draft sales order is created (and verified in Zoho UI).
- Duplicate re-upload of the same file does **not** create duplicates.
- All artefacts are present in Blob and queryable by correlation_id.

