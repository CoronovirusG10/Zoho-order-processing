# 04 — Zoho Books Sandbox Smoke Tests (EU) + Optional Draft Creation

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Verify Zoho Books sandbox integration readiness:
- auth token availability (without printing secrets)
- EU endpoints used
- GET-only connectivity tests by default
- optional: create ONE clearly labelled test Draft Sales Order if `ALLOW_ZOHO_WRITE=1`

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `04_ZOHO_SANDBOX_SMOKES_REPORT.md`
- `04_ZOHO_SANDBOX_SMOKES_COMMANDS.log`

Then print a **Paste‑Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- NEVER print refresh_token / access_token / client_secret.
- Prefer to use the repo’s Zoho integration code/scripts.
- If you must call Zoho directly, redact headers.

## Steps
1) Setup logging helper.
2) Locate Zoho config sources:
   - check for files matching `zoho*token*` and env usage:
     - `ls -la /data/order-processing | rg -n "zoho" || true`
     - `rg -n "(zohoapis|accounts\.zoho|ZohoBooks|organization_id)" app -S || true`
   - confirm EU base URLs (accounts.zoho.eu, zohoapis.eu).
3) Run GET-only checks:
   - Prefer existing scripts/endpoints (e.g., internal `/health/zoho` or similar).
   - Otherwise call minimal Zoho endpoints using existing access token in a safe way.
   - Record: HTTP status, error codes (redacted), latency.
4) If `ALLOW_ZOHO_WRITE=1`:
   - attempt to create ONE TEST draft Sales Order using a known test customer/item from config.
   - If you cannot identify a safe test customer/item automatically, DO NOT guess: document what IDs are needed and stop.
5) Write report + paste-back summary.
