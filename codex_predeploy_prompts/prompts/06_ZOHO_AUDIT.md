# Prompt 06 — Zoho Books Sandbox Readiness (Safe checks)

## Goal
Confirm Zoho Books sandbox integration is feasible:
- token material exists (but is not leaked)
- API base is reachable (`zohoapis.eu`)
- authentication flow is clear for production (refresh token -> access token)
- we can perform safe GET calls (no creation / mutation)

## Rules
- Do NOT create sales orders (no POST to /salesorders).
- Prefer GET-only.
- If any non-GET request is required (e.g., OAuth refresh), do NOT run it automatically — ask the operator for approval first and clearly explain why.

## Output files
- `/data/order-processing/_predeploy_codex/logs/06_ZOHO_AUDIT.md`
- `/data/order-processing/_predeploy_codex/evidence/zoho/token_file_metadata.json` (redacted)
- `/data/order-processing/_predeploy_codex/evidence/zoho/connectivity.txt`
- `/data/order-processing/_predeploy_codex/evidence/zoho/get_organizations.json` (redacted)
- `/data/order-processing/_predeploy_codex/artefacts/zoho_api_call_sequence.md`

## Steps

1) Locate Zoho token file(s)
- Search `/data/order-processing` for `zoho_books_tokens*.json`.
- If none found, record blocker.

2) Parse metadata (redacted)
- Read the JSON and write a **redacted** JSON to `token_file_metadata.json`:
  - keep: `api_base`, `accounts_base`, `region`, `scopes`, `client_id` (ok), `redirect_uri`, `issued_at_unix`, `expires_in`
  - redact: `client_secret`, `access_token`, `refresh_token` values (replace with `***REDACTED***`)
- Never print the raw token file in terminal output.

3) Connectivity probe
- `curl -I` to `api_base` (no auth) to confirm DNS/TLS.
- Save to `connectivity.txt`.

4) Safe authenticated GET test (if feasible)
- If the token file contains an `access_token`, attempt:
  - GET `/books/v3/organizations`
- Store the response in `get_organizations.json` (it’s ok to include org IDs; redact auth header; if org name is sensitive, redact it).
- If the call fails due to expiry:
  - Record that and produce a clear next-action: implement refresh-token flow in the app, storing refresh token in Key Vault.

5) Create `zoho_api_call_sequence.md`
Document the expected production call sequence (no execution here):
- refresh token -> access token (OAuth)
- organisations lookup -> pick org_id (configured)
- contacts search (customer matching)
- items search (SKU/GTIN/name)
- create draft sales order (POST)
- idempotency/duplicate checks

## Report
In `06_ZOHO_AUDIT.md` summarise:
- token file presence + hygiene status
- whether API base reachable
- whether GET /organizations works (or why not)
- blockers and next actions
- evidence file paths
