# Golden Files Test Suite

## Purpose

Golden files are representative Excel spreadsheets with expected parser outputs. They serve as:

1. **Regression tests** - Ensure parser changes don't break existing functionality
2. **Calibration dataset** - Calculate committee model weights based on accuracy
3. **Documentation** - Show real-world examples of supported spreadsheet formats
4. **Quality assurance** - Validate parser behavior on edge cases

## Directory Structure

```
golden-files/
  fixtures/          # Excel files (.xlsx)
  expected/          # Expected JSON outputs (.json)
  runner.ts          # Test runner script
  results.json       # Latest test results
  README.md          # This file
```

## Included Golden Files

### Basic Scenarios

- **simple-english.xlsx** - Basic English headers, 2-3 line items
- **simple-farsi.xlsx** - Farsi headers, Persian product names
- **mixed-language.xlsx** - Mixed English/Farsi headers and data

### Data Variations

- **with-formulas.xlsx** - Contains formulas (should be BLOCKED)
- **multi-sheet.xlsx** - Multiple worksheets (requires user selection)
- **merged-cells.xlsx** - Merged header cells
- **hidden-rows.xlsx** - Hidden data rows
- **missing-sku.xlsx** - Missing SKU column (should create issue)
- **missing-customer.xlsx** - Missing customer field
- **zero-quantity.xlsx** - Lines with qty=0 (allowed, no warning)
- **persian-digits.xlsx** - Persian/Arabic numerals (۱۲۳۴)

### Arithmetic Scenarios

- **arithmetic-mismatch.xlsx** - Line total doesn't match qty × price
- **order-total-mismatch.xlsx** - Order total doesn't match sum of lines
- **within-tolerance.xlsx** - Slight rounding differences (should pass)

### GTIN Scenarios

- **with-gtin.xlsx** - Items with GTIN/EAN codes
- **invalid-gtin.xlsx** - Invalid GTIN check digits (should warn)

### Complex Scenarios

- **title-rows.xlsx** - Company header before data
- **multiple-header-candidates.xlsx** - Ambiguous header row
- **large-order.xlsx** - 50+ line items

## Running Golden Files

### Run all tests

```bash
npm run test:golden
```

### Run with verbose output

```bash
tsx golden-files/runner.ts
```

### Calibrate (update expected outputs)

```bash
npm run test:golden:calibrate
```

or

```bash
tsx golden-files/runner.ts --calibrate
```

**⚠️ Warning:** Calibration overwrites expected outputs. Only use when parser changes are intentional.

## Adding New Golden Files

### 1. Create the Excel file

Add a new `.xlsx` file to `fixtures/` directory. File should:

- Be representative of a real customer spreadsheet
- Test a specific scenario or edge case
- Have a descriptive filename (e.g., `arabic-headers.xlsx`)

### 2. Generate expected output

Run calibration mode to create the expected JSON:

```bash
tsx golden-files/runner.ts --calibrate
```

This will:
- Parse your new fixture
- Save output to `expected/your-file.json`

### 3. Review the output

Manually inspect `expected/your-file.json` to ensure:
- Parsing is correct
- Evidence cells are captured
- Issues are appropriate
- Status is correct

### 4. Commit both files

```bash
git add fixtures/your-file.xlsx expected/your-file.json
git commit -m "Add golden file for [scenario]"
```

## Expected JSON Format

Each expected output should follow the canonical JSON schema:

```json
{
  "meta": {
    "detected_language": "en|fa",
    "sheet_name": "string",
    "header_row": 0,
    "data_rows": 2
  },
  "customer": {
    "raw": {
      "value": "string",
      "evidence": [...]
    },
    "resolved": {
      "zohoCustomerId": "string|null",
      "confidence": 0.0
    }
  },
  "lines": [...],
  "issues": [...],
  "status": "needs-input|ready|blocked"
}
```

## Interpreting Results

### All tests pass ✅

```
═══════════════════════════════════════
GOLDEN FILE TEST SUMMARY
═══════════════════════════════════════
Total files:    15
Passed:         15 ✅
Failed:         0 ❌
Success rate:   100.0%
═══════════════════════════════════════
```

Parser is working correctly for all test cases.

### Some tests fail ❌

```
Failed files:
  - simple-english.xlsx
    Diff detected in lines[0].quantity.value
```

1. Check `results.json` for detailed diffs
2. Determine if failure is due to:
   - **Bug** → Fix parser
   - **Intentional change** → Re-calibrate
   - **Bad expected output** → Re-calibrate specific file

### Re-calibrating specific files

If you only want to update one file's expected output:

1. Delete the old expected JSON: `rm expected/simple-english.json`
2. Run calibration: `tsx golden-files/runner.ts --calibrate`
3. Review the new output
4. Commit if correct

## Committee Calibration

Golden files are used to calculate model weights for the committee:

1. Run golden files through committee
2. Track which model chose correct field for each test
3. Calculate per-model accuracy
4. Compute normalized weights

Example:

```typescript
const calibrationData = {
  'gpt-4o': { fieldsCorrect: 46, fieldsTotal: 50 },      // 92% accuracy
  'claude-opus-4': { fieldsCorrect: 44, fieldsTotal: 50 }, // 88% accuracy
  'gemini-pro': { fieldsCorrect: 42, fieldsTotal: 50 }    // 85% accuracy
};

// Weights: 0.35, 0.33, 0.32
```

## Best Practices

### ✅ Do

- Add golden files for each major parser change
- Include both happy path and edge cases
- Use realistic customer data (anonymized)
- Test both English and Farsi scenarios
- Cover all blocking conditions
- Name files descriptively

### ❌ Don't

- Include PII or sensitive data
- Create giant files (>100 lines)
- Duplicate existing test scenarios
- Calibrate without reviewing output
- Commit without testing

## Maintenance

### Regular Updates

- Add new golden files when supporting new formats
- Re-calibrate after major parser refactoring
- Archive obsolete files that no longer reflect reality
- Keep expected outputs in sync with schema changes

### Quarterly Review

1. Run full suite
2. Check success rate (target: >95%)
3. Add missing scenarios
4. Remove redundant files
5. Update documentation

## Debugging Failed Tests

If a golden file test fails:

### 1. Check the diff

```bash
cat golden-files/results.json | jq '.results[] | select(.passed == false)'
```

### 2. Compare actual vs expected

```bash
# Parse the file manually
tsx -e "import { parseExcel } from '../services/parser/src'; parseExcel('fixtures/failed-file.xlsx')"
```

### 3. Determine root cause

- Parser bug?
- Schema change?
- Expected output wrong?
- Dynamic field mismatch?

### 4. Fix appropriately

- **Bug**: Fix parser code
- **Intentional change**: Re-calibrate
- **Bad expected**: Delete and re-calibrate
- **Dynamic field**: Update ignore list in runner

## CI/CD Integration

Golden files run automatically on:

- Every pull request
- Before deployment
- Nightly regression tests

CI will fail if:
- Any golden file test fails
- Success rate drops below 95%
- New fixtures added without expected outputs

## Questions?

See `SOLUTION_DESIGN.md` section 9.3 for test strategy overview.
