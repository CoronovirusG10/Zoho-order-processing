# MVP and how-to build plan (v2, implementation checklist)

This is a practical build plan for a **review-first** pilot that can be production-hardened.

**v2 requirement**: every uploaded workbook is interpreted by **three independent model deployments** (“3-provider committee”) to reduce single-model mapping mistakes.

Assumptions already decided in this thread
- Azure region: **Sweden Central** (use existing service there)
- Zoho Books data centre: **EU** (treat as a configuration value; verify your tenant)
- Retention: **24 months** for raw + derived artefacts in Azure Blob
- Matching strategy: **SKU-first**, with controlled fallbacks

---

## A. MVP definition (what to build first)

### MVP goal
Reduce manual entry while preventing incorrect Zoho draft Sales Order creation.

### MVP scope (v2, recommended)
1. Teams 1:1 bot receives `.xlsx` and returns a tracking ID.
2. Store original spreadsheet in Blob with immutability settings.
3. Deterministic scan of workbook → candidate tables/columns.
4. **3-model committee** proposes/validates the column mapping (choose-only-from-candidates).
5. Deterministically extract canonical order JSON *only* using the final adjudicated mapping.
6. Deterministic validation + Zoho customer/item lookups.
7. Teams correction loop (user selects/edits missing/ambiguous fields).
8. Explicit approval button.
9. Create **Draft** sales order in Zoho Books **only after approval**.
10. Full audit bundle (including committee outputs) stored in Blob for 24 months.

### MVP non-goals
- No creation of customers/items in Zoho.
- No invoices/shipments/fulfilment.
- No group chat support (personal chat only).
- No reliance on agent long-term memory for order data.

### Success criteria (MVP)
- ≥70% of orders require **no manual Zoho entry** (only review + approve), after initial tuning.
- 0 silent wrong orders: anything ambiguous is blocked and forced through correction/approval.
- All artefacts are retrievable by `correlation_id` for 24 months.

---

## B. Resource setup (Sweden Central)

### B1. Core Azure resources
- **Storage account (Blob)**
  - Containers:
    - `original/` (raw XLSX; immutable)
    - `artifacts/` (parsed tables, canonical JSON, validation reports)
    - `committee/` (per-model outputs + adjudicated mapping)
    - `audit/` (append-only event logs)
  - Enable: versioning, soft delete, immutable retention policy (24 months)

- **Azure Functions (Durable Functions)**
  - `orchestrator` function: state machine
  - `parser` activity: XLSX scan + table detection
  - `committee` activity: 3-model calls + adjudication
  - `validator` activity
  - `zoho` activity: token broker + API calls

- **Azure AI Foundry**
  - Project in Sweden Central (or your Foundry setup’s supported region)
  - Deploy **three** model endpoints (ideally three different providers)
  - Deploy **one** “conversation agent” for Teams correction dialogue (can be one of the models)

- **Azure Key Vault**
  - Zoho OAuth client id/secret, refresh token, org id
  - Foundry keys if needed (prefer managed identity when supported)

- **Azure API Management (recommended)**
  - Egress proxy to Zoho Books
  - Rate limiting, allowlist, request/response logging headers

- **Cosmos DB**
  - `OrderCase` operational state
  - idempotency keys
  - optional cache: Zoho items/customers lookup

- **Application Insights / Log Analytics**
  - end-to-end tracing with correlation id

### B2. Foundry model selection (committee)
You want three deployments that are **independent**.

**Target** (provider diversity):
- Model A: OpenAI family (e.g., GPT-4.1 / GPT-4o in Azure OpenAI)
- Model B: Meta Llama family
- Model C: Mistral or Cohere family (or Anthropic Claude if contractually allowed)

**Important**
- Verify each model is available in **Sweden Central** (or EU data zone) and is marked “Agent-supported” / “Tool calling supported” as needed.
- If you cannot get three providers in the required region, use three distinct models (even if same provider) but treat that as a weaker control.

---

## C. End-to-end implementation steps

### Step 1 — Teams bot (personal chat)
**Work items**
- Create a Teams app manifest with bot entry.
- Handle:
  - message events
  - file attachments
  - adaptive card submissions

**Case model**
- Each upload creates an `OrderCase` keyed by `correlation_id`.
- All follow-up messages route to the same case until completion/cancellation.

### Step 2 — File ingestion and immutability
1. Download attachment bytes.
2. Compute SHA-256.
3. Store to Blob:
   - `original/<correlation_id>/revision_001/<filename>.xlsx`
4. Emit audit event `RECEIVED_FILE`.

### Step 3 — Deterministic workbook scan (parser)
Outputs a **WorkbookSummary** (JSON) that contains:
- workbook metadata (sheet names, counts)
- detected table candidates (each with header row, columns, sample rows)
- deterministic top-K candidate mappings per canonical field

Store:
- `artifacts/<correlation_id>/revision_001/workbook_summary.json`

### Step 4 — 3-model committee mapping
**Goal**: decide which table and columns correspond to canonical fields.

**Inputs** (minimised)
- `workbook_summary.json` (bounded sample rows)
- strict list of allowed `table_id` and `column_id`

**Per-model output** (store all three)
- `committee/<correlation_id>/revision_001/model_A_mapping.json`
- `committee/<correlation_id>/revision_001/model_B_mapping.json`
- `committee/<correlation_id>/revision_001/model_C_mapping.json`

**Adjudicated output**
- `committee/<correlation_id>/revision_001/adjudicated_mapping.json`

**Rules**
- majority vote per field
- enforce “same table” constraint for line items
- if ambiguous → create an issue and ask user

### Step 5 — Deterministic extraction (authoritative)
Use the adjudicated mapping to extract:
- `customer_name`
- `line_items[]` (sku, product_name, gtin, quantity, unit_price, line_total)
- order totals (if present)

Store:
- `artifacts/<correlation_id>/revision_001/extracted_order.json`

### Step 6 — Validation + Zoho lookups
Run deterministic validations:
- arithmetic consistency
- quantity >= 0
- quantity == 0 requires explicit confirmation

Run Zoho lookups:
- customer resolution
- item resolution (SKU-first, then GTIN, then name→user pick)

Store:
- `artifacts/<correlation_id>/revision_001/validation_report.json`
- `artifacts/<correlation_id>/revision_001/zoho_resolution.json`

### Step 7 — 3-model committee review (optional but recommended)
Even if mapping was confident, run a second committee pass that only reviews:
- extracted canonical JSON
- deterministic validation report
- Zoho resolution results

Each model returns:
- issue list (no changes)
- “looks wrong” flags

Adjudication:
- if any model flags a **blocking** issue → block and ask user
- otherwise merge warnings into the user-facing issues list

### Step 8 — Teams correction loop
Use Adaptive Cards to resolve issues:
- pick customer when ambiguous
- pick item when SKU/GTIN ambiguous
- choose which column is quantity/price/total if committee is ambiguous
- confirm quantity=0 lines

Every user input becomes a **JSON Patch** with actor + timestamp.

### Step 9 — Approval gate
Only show “Approve & create draft” when:
- no blocking issues
- all ambiguous mappings resolved
- Zoho customer and items resolved uniquely

### Step 10 — Zoho create (draft only)
- Compute idempotency key.
- Call Zoho `POST /salesorders`.
- Confirm the returned sales order is in **draft** state in your tenant.

Store:
- `artifacts/<correlation_id>/revision_001/zoho_request.json`
- `artifacts/<correlation_id>/revision_001/zoho_response.json`

### Step 11 — Close out + audit bundle
Write a final audit event:
- `SALESORDER_DRAFT_CREATED` (or `FAILED`)

---

## D. Canonical JSON schema (proposal)

This is the authoritative object the pipeline works on. Every value must have provenance.

```json
{
  "correlation_id": "SO-2025-12-19-000123",
  "tenant": {
    "azure_region": "swedencentral",
    "zoho_dc": "EU"
  },
  "source": {
    "file_name": "customer_export.xlsx",
    "blob_uri": "https://.../original/...xlsx",
    "sha256": "...",
    "revision": 1,
    "received_utc": "2025-12-19T21:00:00Z",
    "sender_aad_object_id": "...",
    "sender_upn": "user@company.com"
  },
  "extraction": {
    "selected_table": {
      "sheet": "Sheet1",
      "table_id": "sheet1:r12c1:r48c9",
      "header_row": 12
    },
    "field_mapping": {
      "customer_name": {"source": "sheet1!B2", "confidence": 0.85},
      "line_items.sku": {"source": "col_id:sheet1!C12", "confidence": 0.92},
      "line_items.quantity": {"source": "col_id:sheet1!F12", "confidence": 0.88},
      "line_items.unit_price": {"source": "col_id:sheet1!G12", "confidence": 0.86},
      "line_items.line_total": {"source": "col_id:sheet1!H12", "confidence": 0.90}
    },
    "line_items": [
      {
        "row_index": 0,
        "sku": {"value": "ABC-123", "cell": "Sheet1!C13"},
        "product_name": {"value": "Widget", "cell": "Sheet1!D13"},
        "gtin": {"value": "", "cell": null},
        "quantity": {"value": 2, "cell": "Sheet1!F13"},
        "unit_price": {"value": 10.00, "cell": "Sheet1!G13", "currency": "EUR"},
        "line_total": {"value": 20.00, "cell": "Sheet1!H13", "currency": "EUR"}
      }
    ],
    "totals": {
      "subtotal": {"value": 20.00, "cell": "Sheet1!H49", "currency": "EUR"},
      "grand_total": {"value": 20.00, "cell": "Sheet1!H50", "currency": "EUR"}
    }
  },
  "validation": {
    "status": "BLOCKED",
    "issues": [
      {
        "code": "QTY_ZERO_CONFIRM",
        "severity": "BLOCK",
        "message": "Line 1 has quantity 0. Confirm keep as 0 or remove line.",
        "path": "/extraction/line_items/0/quantity",
        "evidence": ["Sheet1!F13"],
        "proposed_actions": ["confirm_keep", "edit_quantity", "remove_line"]
      }
    ]
  },
  "committee": {
    "models": [
      {"name": "model_A", "mapping_uri": "..."},
      {"name": "model_B", "mapping_uri": "..."},
      {"name": "model_C", "mapping_uri": "..."}
    ],
    "adjudicated_mapping_uri": "...",
    "review_outputs": []
  },
  "user_corrections": [
    {
      "timestamp_utc": "2025-12-19T21:05:00Z",
      "actor_aad_object_id": "...",
      "patch": [{"op": "replace", "path": "/extraction/line_items/0/quantity/value", "value": 1}]
    }
  ],
  "zoho": {
    "customer_id": null,
    "item_resolution": [],
    "request_uri": null,
    "response_uri": null,
    "salesorder_id": null,
    "status": null
  }
}
```

---

## E. Issue codes (starter set)

Blocking
- `MISSING_CUSTOMER`
- `AMBIGUOUS_CUSTOMER`
- `MISSING_SKU`
- `UNRESOLVED_ITEM`
- `AMBIGUOUS_MAPPING_QTY`
- `AMBIGUOUS_MAPPING_PRICE`
- `TOTALS_MISMATCH`
- `NEGATIVE_QUANTITY`
- `QTY_ZERO_CONFIRM`

Warnings
- `MISSING_TOTALS`
- `ROUNDING_DIFFERENCE`
- `UNEXPECTED_CURRENCY`

---

## F. Example code snippets (Python)

### F1. Read XLSX into a normalised grid (merged cells expanded)
```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import openpyxl

@dataclass
class CellValue:
    value: Any
    number_format: str | None
    is_merged: bool


def load_workbook_grid(path: str) -> Dict[str, Dict[Tuple[int, int], CellValue]]:
    """Return a per-sheet sparse grid keyed by (row, col) 1-based indices.

    IMPORTANT: This keeps cell provenance and expands merged ranges by copying the
    top-left value into the merged area *in-memory*.
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    out: Dict[str, Dict[Tuple[int, int], CellValue]] = {}

    for ws in wb.worksheets:
        grid: Dict[Tuple[int, int], CellValue] = {}

        # Load raw cells
        for row in ws.iter_rows(values_only=False):
            for cell in row:
                if cell.value is None and (cell.number_format is None or cell.number_format == 'General'):
                    continue
                grid[(cell.row, cell.column)] = CellValue(
                    value=cell.value,
                    number_format=getattr(cell, "number_format", None),
                    is_merged=False,
                )

        # Expand merged cells
        for merged in ws.merged_cells.ranges:
            min_row, min_col, max_row, max_col = merged.min_row, merged.min_col, merged.max_row, merged.max_col
            top_left = grid.get((min_row, min_col), CellValue(None, None, True))
            for r in range(min_row, max_row + 1):
                for c in range(min_col, max_col + 1):
                    grid[(r, c)] = CellValue(
                        value=top_left.value,
                        number_format=top_left.number_format,
                        is_merged=True,
                    )

        out[ws.title] = grid

    return out
```

### F2. Candidate header detection (very simplified)
```python
import re

HEADER_KEYWORDS = {
    "sku": ["sku", "item", "item code", "itemcode", "product code"],
    "qty": ["qty", "quantity", "order qty"],
    "price": ["unit price", "price", "rate"],
    "total": ["line total", "amount", "total", "ext price"],
}


def normalise(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def header_score(row_values: List[str]) -> float:
    tokens = [normalise(v) for v in row_values if isinstance(v, str) and v.strip()]
    if not tokens:
        return 0.0
    score = 0.0
    for t in tokens:
        for group in HEADER_KEYWORDS.values():
            if any(k in t for k in group):
                score += 1.0
                break
    return score / max(len(tokens), 1)
```

### F3. Committee adjudication (majority vote)
```python
from collections import Counter
from typing import Optional

Field = str
ColumnId = str


def majority_vote(choices: list[Optional[ColumnId]], confidences: list[float], threshold: float = 0.70) -> Optional[ColumnId]:
    """Return a chosen ColumnId if at least 2 models agree and mean confidence >= threshold."""
    non_null = [c for c in choices if c is not None]
    if not non_null:
        return None

    counts = Counter(non_null)
    top, top_count = counts.most_common(1)[0]
    if top_count < 2:
        return None

    # mean confidence only across models that picked 'top'
    conf = [confidences[i] for i, c in enumerate(choices) if c == top]
    if sum(conf) / len(conf) < threshold:
        return None

    return top
```

### F4. Zoho create call (outline)
```python
import requests


def zoho_create_salesorder(base_url: str, access_token: str, org_id: str, payload: dict) -> dict:
    url = f"{base_url}/books/v3/salesorders"
    resp = requests.post(
        url,
        params={"organization_id": org_id},
        headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()
```

---

## G. Recommended Azure CLI checks (run from your own VM)

> I can run shell commands in this environment, but I **cannot** run commands on your Azure VM from here. Use the commands below on your Sweden Central VM to confirm resources.

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

### Confirm Azure OpenAI / Foundry model deployments (committee prerequisites)
```bash
# List deployed model deployments (names/versions/capacity)
az cognitiveservices account deployment list -g <rg> -n <openaiResourceName> -o table

# List models available to deploy for this resource / region
az cognitiveservices account list-models -g <rg> -n <openaiResourceName> -o table
```

For committee (3-provider) readiness, also record:
- which Foundry hub/project region you are using (must align to Sweden Central for your requirement)
- which partner models are visible/deployable in the Foundry model catalogue under that hub/project

```bash
az functionapp show -g <rg> -n <funcApp> --query "{name:name,location:location,state:state,kind:kind}" -o json
```
