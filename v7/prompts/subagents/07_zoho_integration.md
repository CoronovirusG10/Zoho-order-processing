# Sub-agent: Zoho Books Integration

## Deliverables
- Zoho OAuth helper:
  - refresh token flow
  - token caching
- API wrappers:
  - lookup customer by name (fuzzy)
  - lookup item by SKU/GTIN/name
  - create draft sales order
- Idempotency:
  - use custom unique field `external_order_key` (or configured field)
  - ensure duplicates prevented even across retries
- Resilience:
  - retry/backoff
  - outbox queue for Zoho down
  - caching layer for items/customers

## Logs
Write `_build_logs/.../subagent_zoho.md`.
