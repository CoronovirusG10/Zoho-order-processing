# Order processing (Teams → Excel → Foundry Agent → Zoho Books)

This folder contains an implementation-grade solution design for an Azure-only workflow that allows salespeople to upload an Excel sales order spreadsheet to a dedicated 1:1 Microsoft Teams chat (bot). The system extracts and validates the order and, after explicit approval, creates a **Draft** Sales Order in **Zoho Books**.

## What’s in this folder

- `SOLUTION_DESIGN.md` — Full end-to-end architecture and design (all technical details, including security, observability, parsing strategy, and Zoho integration).
- `MVP_AND_HOWTO.md` — Minimal viable pilot scope plus a concrete build/how-to checklist.
- `WHAT_WE_NEED_TO_KNOW.md` — Open questions and discovery items that must be confirmed (especially anything that may vary by Zoho plan/tenant or Azure AI Foundry region features).
- `AZURE_MODEL_INVENTORY.md` — Runbook to capture “what models are deployed” and “what can be deployed” in your Azure subscription (needed to lock down the final model choices).

## Key non-negotiables in the “safest possible” mode

- Deterministic extraction: the LLM/agent is not allowed to invent or directly extract values; every extracted field must be grounded in the spreadsheet with cell/range provenance.
- Explicit user approval in Teams before any Zoho write.
- Strong auditability: original XLSX + extracted JSON + validation report + correction patches + Zoho request/response metadata retained in Azure Blob for **24 months**.
- SKU-first matching with controlled fallbacks.
- Idempotency to prevent duplicate orders.

## Location

This content is also copied to `/data/order-processing` in the runtime container.
