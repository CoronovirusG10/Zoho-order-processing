# Sub-agent: Excel Parser & Schema Inference (deterministic)

## Deliverables
- Deterministic `.xlsx` parser that outputs canonical order JSON with evidence.
- Must:
  - detect formulas anywhere and flag as blocker
  - detect candidate line item table region(s)
  - support multi-sheet (choose best sheet, but record reasoning)
  - map headers (English + Farsi) to canonical fields with confidence scores
  - extract rows and normalise numbers/currency/digits (Arabic/Persian digits to ASCII)
  - remove totals rows heuristically
  - output issues list (missing sku, ambiguous header mapping, etc)

## No hallucinations
- Every extracted value must have evidence (sheet+cell).
- If not present, set null and add an issue.

## Logs
Write `_build_logs/.../subagent_excel.md`.
