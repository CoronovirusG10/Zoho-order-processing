# Order processing v2 (Teams → Excel → deterministic + 3-model committee → Foundry Agent → Zoho Books)

This folder contains **v2** of the Azure-only solution design.

**Change from v1**: every uploaded spreadsheet is interpreted by a **3-provider “committee”** (three different model deployments) to reduce the probability of a single-model mapping mistake. The committee never invents values; it only:
- proposes/validates **column mappings** (choose-only-from-candidates), and/or
- performs an independent **consistency review** of the extracted canonical order JSON.

The workflow still uses a **review-first** gate and creates **Draft** Sales Orders in **Zoho Books** only after explicit approval.

## What’s in this folder

- `SOLUTION_DESIGN.md` — Full end-to-end architecture and design, including the 3-model committee pattern.
- `MVP_AND_HOWTO.md` — Minimal viable pilot scope plus an implementation checklist, with v2-specific build steps.
- `WHAT_WE_NEED_TO_KNOW.md` — Open questions and discovery items (what to verify in your tenant / region / Zoho plan).
- `AZURE_MODEL_INVENTORY.md` — Same runbook, but required for the 3-provider committee in v2.
- `what we need to know.md` — same content as above (duplicate filename as requested).

## Hard non‑negotiables in the “safest possible” mode

- **Deterministic extraction is authoritative**. Every extracted field must be grounded in a workbook cell/range with provenance.
- **3-model committee outputs are non-authoritative**. They can only:
  - choose among precomputed candidate mappings, and/or
  - flag issues and ask questions.
  They cannot introduce new fields/values.
- **Explicit user approval in Teams before any Zoho write**.
- **Strong auditability**: original XLSX + extracted artefacts + validations + user corrections + committee outputs + Zoho request/response metadata retained in **Azure Blob for 24 months**.
- **SKU-first matching** with controlled fallbacks.
- **Idempotency** to prevent duplicate orders.

## Location

All content is stored in `/data/order-processing/v2`.