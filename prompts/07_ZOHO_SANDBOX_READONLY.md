Read-only Zoho sandbox readiness.

- Locate any Zoho config/token files under /data/order-processing.
- Confirm they are ignored by git (do not print content).
- Confirm SOLUTION_DESIGN specifies:
  - EU endpoints
  - Draft Sales Order only
  - strict Zoho pricing prevails
  - idempotency (custom unique field)

Output: is Zoho integration plan complete? what needs to be configured (Key Vault secrets, org id, custom field id).
