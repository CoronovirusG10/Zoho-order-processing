# 14 — Post-Manual Validation: Verify Admin Work Completed

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Validate that the manual admin work (11_PIPPA_TENANT_CHECKLIST) was completed correctly by verifying:
- Bot credentials exist in environment
- Bot service can obtain a token from Microsoft
- Teams messaging endpoint is reachable

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `14_POST_MANUAL_VALIDATION_REPORT.md`
- `14_POST_MANUAL_VALIDATION_COMMANDS.log`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print full secrets (redact all but last 4 characters).
- If validation fails, provide clear guidance on what admin needs to fix.
- This is a critical gate before building the Teams package.

## Dependencies
- MUST run AFTER admin completes 11_PIPPA_TENANT_CHECKLIST
- MUST run AFTER DevOps updates .env with credentials

## Validation Checks

| Check | Pass Criteria |
|-------|---------------|
| MicrosoftAppId exists | Non-empty GUID format |
| MicrosoftAppPassword exists | Non-empty string |
| Token acquisition | 200 response from Microsoft login |
| Bot service running | pm2 shows online |
| Messaging endpoint | 200 or 405 (method not allowed) on /api/messages |

## Steps
1) Setup logging helper.
2) Verify environment variables:
   - Read `.env` file or environment
   - Check for `MICROSOFT_APP_ID` or `MicrosoftAppId`:
     - `grep -E "^MICROSOFT_APP_ID=|^MicrosoftAppId=" .env 2>/dev/null || echo "NOT FOUND"`
   - Check for `MICROSOFT_APP_PASSWORD` or `MicrosoftAppPassword`:
     - `grep -E "^MICROSOFT_APP_PASSWORD=|^MicrosoftAppPassword=" .env 2>/dev/null | sed 's/=.*/=[REDACTED]/'`
   - Validate format:
     - App ID should be GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
     - Password should be non-empty
3) Validate MicrosoftAppId format:
   - Extract value (without printing full value)
   - Verify GUID pattern
   - Print only: "MicrosoftAppId: ****-****-****-****-[last4chars]"
4) Test token acquisition from Microsoft:
   - Use Bot Framework authentication endpoint
   - Request:
     ```bash
     curl -s -X POST "https://login.microsoftonline.com/23da91a5-0480-4183-8bc1-d7b6dd33dd2e/oauth2/v2.0/token" \
       -H "Content-Type: application/x-www-form-urlencoded" \
       -d "grant_type=client_credentials" \
       -d "client_id=${MICROSOFT_APP_ID}" \
       -d "client_secret=${MICROSOFT_APP_PASSWORD}" \
       -d "scope=https://api.botframework.com/.default" \
       | jq -r 'if .access_token then "TOKEN_ACQUIRED" else "ERROR: " + .error_description end'
     ```
   - PASS: "TOKEN_ACQUIRED"
   - FAIL: Capture error message for troubleshooting
5) Verify bot service is running:
   - `pm2 ls | grep teams-bot`
   - Check process status is "online"
   - Check restart count (high count indicates issues)
6) Verify bot is listening:
   - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3978/api/messages`
   - Expected: 405 (Method Not Allowed) - POST required
   - Or: 200/401/403 all indicate service is responding
7) Verify external endpoint:
   - `curl -s -o /dev/null -w "%{http_code}" https://processing.pippaoflondon.co.uk/api/messages`
   - Same expectations as above
8) Check pm2 logs for recent errors:
   - `pm2 logs teams-bot --lines 50 --nostream | grep -i error | tail -10`
   - If errors found, include in report
9) Generate validation summary:

   | Check | Status | Details |
   |-------|--------|---------|
   | MicrosoftAppId | PASS/FAIL | Format valid/invalid |
   | MicrosoftAppPassword | PASS/FAIL | Present/missing |
   | Token Acquisition | PASS/FAIL | Success/error message |
   | Bot Service | PASS/FAIL | online/stopped |
   | Local Endpoint | PASS/FAIL | HTTP status |
   | External Endpoint | PASS/FAIL | HTTP status |

10) If any check fails:
    - Provide specific remediation steps
    - Indicate what admin needs to redo
    - Do not proceed to 10_TEAMS_PACKAGE_BUILD
11) If all checks pass:
    - Confirm ready for 10_TEAMS_PACKAGE_BUILD
    - Output: "VALIDATION PASSED - Ready to build Teams package"
12) Write report with full validation results.
13) Print Paste-Back Report block.
