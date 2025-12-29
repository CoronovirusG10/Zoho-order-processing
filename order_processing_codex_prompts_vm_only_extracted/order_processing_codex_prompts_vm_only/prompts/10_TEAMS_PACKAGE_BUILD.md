# 10 — Teams Package Build: Create teams-app.zip

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Build the Teams app package (.zip) with the correct App ID from the Pippa of London tenant registration, ready for manual upload by antonio@pippaoflondon.co.uk.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `10_TEAMS_PACKAGE_BUILD_REPORT.md`
- `10_TEAMS_PACKAGE_BUILD_COMMANDS.log`
- `teams-app.zip` (the built package)

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Requires MicrosoftAppId in .env (depends on admin completing 11_PIPPA_TENANT_CHECKLIST).
- Do not upload the package - this is manual step for Pippa admin.

## Dependencies
- MUST run AFTER 11_PIPPA_TENANT_CHECKLIST and admin work completes
- MUST run AFTER 14_POST_MANUAL_VALIDATION confirms credentials are set

## Manifest Requirements

The manifest must include:
- Bot with personal scope
- Personal tab for "My Cases" and "Manager View"
- Messaging endpoint: `https://processing.pippaoflondon.co.uk/api/messages`
- File upload support enabled

## Steps
1) Setup logging helper.
2) Verify MicrosoftAppId is set:
   - Check `.env` file for `MICROSOFT_APP_ID` or `MicrosoftAppId`
   - If not set, fail with message: "MicrosoftAppId not found in .env. Admin must complete 11_PIPPA_TENANT_CHECKLIST first."
3) Locate Teams app manifest:
   - `find . -maxdepth 6 -type f -name 'manifest.json' | head -5`
   - Expected location: `app/teams-app/manifest.json` or similar
4) Locate icon files:
   - `find . -maxdepth 6 -type f \( -name 'color.png' -o -name 'outline.png' \) | head -10`
   - Verify icons meet Teams requirements (192x192 color, 32x32 outline)
5) Read and validate manifest:
   - Parse manifest.json
   - Verify required fields:
     - `$schema` is Teams manifest schema
     - `version` is valid semver
     - `id` placeholder exists or matches App ID
     - `developer.name` and other required fields
   - Verify bot configuration:
     - `bots[0].botId` placeholder: `{{BOT_APP_CLIENT_ID}}` or `${{MICROSOFT_APP_ID}}`
     - `bots[0].scopes` includes "personal"
   - Verify personal tab configuration:
     - `staticTabs` array exists
     - Tab `contentUrl` points to correct endpoint
6) Replace placeholders with actual values:
   - Read MicrosoftAppId from .env
   - Replace `{{BOT_APP_CLIENT_ID}}` or `${{MICROSOFT_APP_ID}}` with actual value
   - Validate the replaced manifest is valid JSON
7) Validate manifest against Teams schema:
   - If validation tools available, run them
   - Otherwise, verify all required fields present
8) Create teams-app.zip:
   - Package: manifest.json, color.png, outline.png
   - `cd <manifest_dir> && zip -r ${OUTPUT_DIR}/teams-app.zip manifest.json color.png outline.png`
   - Verify zip contents: `unzip -l ${OUTPUT_DIR}/teams-app.zip`
9) Write report with:
   - Manifest validation results
   - Placeholder replacement status
   - Package location and contents
   - Instructions for antonio@pippaoflondon.co.uk:
     - "Upload teams-app.zip to Teams Admin Center"
     - "Navigate to: Teams apps > Manage apps > Upload new app"
     - "Choose 'Upload custom app' and select teams-app.zip"
10) Print Paste-Back Report block.
