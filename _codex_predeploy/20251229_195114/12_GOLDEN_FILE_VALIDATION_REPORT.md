# 12 - Golden File Validation Report

**Run ID:** 20251229_195114
**Timestamp:** 2025-12-29T19:51:14Z
**Status:** SKIPPED

---

## Summary

| Metric | Value |
|--------|-------|
| **Overall Status** | SKIPPED |
| **Golden Excel Files Found** | 0 |
| **Expected Output Files** | 4 |
| **Committee Golden Files** | 3 |
| **Reason** | Fixtures directory empty - setup required |

---

## Service Status

| Service | Status |
|---------|--------|
| workflow-api | ONLINE (2 instances) |
| workflow-worker | ERRORED (2 instances) |

> Note: workflow-worker in errored state, but golden file validation does not require live services.

---

## Golden Files Infrastructure Assessment

### Parser Golden Files (`app/tests/golden-files/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `runner.ts` | EXISTS | Test runner script present (236 lines) |
| `generate-fixtures.ts` | EXISTS | Fixture generator script present |
| `README.md` | EXISTS | Comprehensive documentation |
| `fixtures/` | EMPTY | Only contains `.gitkeep` placeholder |
| `expected/` | PARTIAL | 4 JSON files without matching fixtures |

**Expected JSON files (no matching .xlsx):**
- `simple-english.json`
- `simple-farsi.json`
- `missing-sku.json`
- `with-formulas.json`

### Committee Golden Files (`app/services/committee/tests/golden/`)

| File | Description | Referenced XLSX |
|------|-------------|-----------------|
| `golden-001-english.json` | Standard English order | `./golden-files/order-001-english.xlsx` (MISSING) |
| `golden-002-farsi.json` | Farsi headers with mixed data | `./golden-files/order-002-farsi.xlsx` (MISSING) |
| `golden-003-ambiguous.json` | Ambiguous quantity columns | `./golden-files/order-003-ambiguous.xlsx` (MISSING) |

### Test Fixtures Available (Non-Golden)

These Excel files exist in `app/tests/fixtures/` but are not part of the golden file suite:

| File | Purpose |
|------|---------|
| `simple-order.xlsx` | Basic unit tests |
| `multi-line-order.xlsx` | Multi-line scenarios |
| `farsi-headers.xlsx` | Farsi header detection |
| `mixed-language.xlsx` | Mixed language handling |
| `order-with-formulas.xlsx` | Formula detection/blocking |
| `persian-digits.xlsx` | Persian numeral conversion |

---

## Why Validation Was Skipped

1. **No Golden Excel Files**: The `fixtures/` directory under `golden-files/` contains only a placeholder `.gitkeep` file
2. **Expected Outputs Without Inputs**: The `expected/` directory has 4 JSON files defining expected parser outputs, but no corresponding `.xlsx` input files exist
3. **Committee Files Reference Missing XLSX**: The committee golden JSON files reference Excel files in a `./golden-files/` subdirectory that does not exist

---

## Setup Required

To enable golden file validation, the following must be completed:

### Option 1: Generate Fixtures from Expected Outputs

```bash
cd /data/order-processing/app/tests
tsx golden-files/generate-fixtures.ts
```

This should create `.xlsx` files that match the expected JSON outputs.

### Option 2: Manually Create Golden Files

1. Create Excel spreadsheets matching the documented scenarios in `README.md`
2. Place them in `app/tests/golden-files/fixtures/`
3. Run calibration to generate expected outputs:
   ```bash
   npm run test:golden:calibrate
   ```

### Option 3: Copy Test Fixtures

Copy existing fixtures from `app/tests/fixtures/` to golden directory:
```bash
cp app/tests/fixtures/*.xlsx app/tests/golden-files/fixtures/
npm run test:golden:calibrate
```

---

## Expected Golden File Content

Per the `README.md`, golden files should cover:

### Basic Scenarios
- `simple-english.xlsx` - Basic English headers
- `simple-farsi.xlsx` - Farsi headers
- `mixed-language.xlsx` - Mixed English/Farsi

### Data Variations
- `with-formulas.xlsx` - Formulas (should be BLOCKED)
- `multi-sheet.xlsx` - Multiple worksheets
- `missing-sku.xlsx` - Missing SKU column
- `persian-digits.xlsx` - Persian numerals

### Arithmetic Scenarios
- `arithmetic-mismatch.xlsx` - Line total discrepancy
- `order-total-mismatch.xlsx` - Order total discrepancy
- `within-tolerance.xlsx` - Rounding tolerance

### GTIN Scenarios
- `with-gtin.xlsx` - GTIN/EAN codes
- `invalid-gtin.xlsx` - Invalid GTIN check digits

---

## Committee Golden Files Content

The committee golden files define expected mappings for schema inference:

### golden-001-english.json
- Language: English
- Expected mappings: customer_name -> col 0, sku -> col 1, quantity -> col 2, unit_price -> col 3, line_total -> col 4

### golden-002-farsi.json
- Language: Farsi (fa)
- Headers: (Customer Name), (SKU), (Quantity), (Unit Price), (Total)
- Expected mappings: Same column positions as English

### golden-003-ambiguous.json
- Scenario: Multiple quantity-like columns (Qty Ordered, Qty Shipped)
- Challenge: Disambiguate between `Qty Ordered` (col 3) vs `Qty Shipped` (col 4)
- Expected: quantity -> col 3 (Qty Ordered)

---

## npm Test Scripts Available

| Script | Command | Status |
|--------|---------|--------|
| `test:golden` | `tsx golden-files/runner.ts` | SKIP (no fixtures) |
| `test:golden:calibrate` | `tsx golden-files/runner.ts --calibrate` | SKIP (no fixtures) |
| `fixtures:generate` | `tsx fixtures/generate-fixtures.ts` | Available |

---

## Recommendations

1. **Priority: Generate Golden Fixtures**
   - Run `tsx golden-files/generate-fixtures.ts` to create the missing Excel files
   - This is a pre-deployment requirement for regression testing

2. **Establish Golden File Pipeline**
   - Include golden file generation in CI/CD setup scripts
   - Add validation to deployment checklist

3. **Document Expected Outcomes**
   - Ensure each golden file has corresponding `.json` in `expected/`
   - Document committee calibration weights after running

---

## Conclusion

**Status: SKIPPED** - Golden file validation could not be performed because the required Excel fixture files do not exist. The infrastructure (runner, expected outputs, documentation) is in place, but the actual test data files need to be generated or created.

This is a **setup requirement**, not a failure. Golden file validation should be re-run after fixtures are generated.

---

## Paste-Back Report

```
============================================================
GOLDEN FILE VALIDATION - SKIPPED
============================================================
Run ID:     20251229_195114
Timestamp:  2025-12-29T19:51:14Z
Status:     SKIPPED

REASON: Golden Excel files not found

INFRASTRUCTURE STATUS:
  [OK] runner.ts exists
  [OK] generate-fixtures.ts exists
  [OK] README.md exists
  [OK] expected/ has 4 JSON files
  [OK] committee/tests/golden/ has 3 JSON files
  [!!] fixtures/ directory is EMPTY

SETUP REQUIRED:
  1. Run: tsx golden-files/generate-fixtures.ts
  2. OR: Copy test fixtures and calibrate
  3. Re-run this validation after setup

SERVICES:
  workflow-api:    ONLINE (2 instances)
  workflow-worker: ERRORED (2 instances)

FILES WRITTEN:
  - 12_GOLDEN_FILE_VALIDATION_REPORT.md
  - 12_GOLDEN_FILE_VALIDATION_COMMANDS.log

RESULT: SKIP (not FAIL) - Setup required
============================================================
```

---

*Generated by Codex pre-deployment validation*
