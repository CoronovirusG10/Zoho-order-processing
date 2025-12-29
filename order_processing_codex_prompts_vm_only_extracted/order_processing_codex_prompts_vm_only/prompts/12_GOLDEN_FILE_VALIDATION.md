# 12 — Golden File Validation: Parser and Committee Tests

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Test the Excel parser and AI committee against golden file spreadsheets to validate extraction accuracy.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `12_GOLDEN_FILE_VALIDATION_REPORT.md`
- `12_GOLDEN_FILE_VALIDATION_COMMANDS.log`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Gracefully handle missing golden files (skip with warning, document requirement).
- Do not modify golden files.
- Read-only testing mode.

## Dependencies
- Requires workflow services running (workflow-api, workflow-worker)
- Requires AI model connectivity confirmed (03_FOUNDRY_MODEL_SMOKES)

## Expected Golden File Location
- Primary: `/data/order-processing/test/fixtures/golden/`
- Alternative: `/data/order-processing/tests/fixtures/golden/`
- Alternative: `/data/order-processing/app/tests/golden/`

## Steps
1) Setup logging helper.
2) Verify services are running:
   - `pm2 ls | grep -E "(workflow-api|workflow-worker)"`
   - If not running, warn but continue (may use direct testing)
3) Locate golden files:
   - `find . -maxdepth 6 -type d -name 'golden' 2>/dev/null`
   - `find . -maxdepth 6 -type f -name '*.xlsx' -path '*golden*' -o -name '*.xlsx' -path '*fixture*' 2>/dev/null | head -20`
4) If golden files not found:
   - Document this as a requirement
   - Output message: "Golden files not found. Expected at: /data/order-processing/test/fixtures/golden/"
   - List what golden files should contain:
     - Sample order spreadsheets with known good data
     - Expected extraction results (JSON or markdown)
   - Skip remaining tests with SKIP status (not FAIL)
   - Continue to report generation
5) If golden files found:
   - List all discovered files
   - For each .xlsx file:
     a) Read file metadata (sheets, row counts)
     b) Run parser extraction:
        - If test script exists: `npm run test:golden` or similar
        - Otherwise: Call parser API endpoint if available
     c) Capture extraction results
     d) Compare against expected output if exists:
        - `*.expected.json` or `*.expected.md` companion files
     e) Calculate accuracy metrics:
        - Fields correctly extracted
        - Fields with errors
        - Missing fields
6) Committee validation (if applicable):
   - For complex cases, verify AI committee produces expected verdicts
   - Compare against documented expected outcomes
7) Generate accuracy summary:
   - Total files tested
   - Pass/Fail per file
   - Overall accuracy percentage
   - List of discrepancies
8) Write report with:
   - Golden files tested (or "NOT FOUND - SETUP REQUIRED")
   - Per-file results
   - Overall accuracy
   - Recommendations for missing/failing tests
9) Print Paste-Back Report block.
