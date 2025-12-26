# Agent 10: Tests & Golden Files - Summary

**Date:** 2025-12-25
**Status:** COMPLETE

## Overview

Comprehensive test suite and golden file harness for the order processing application. The test infrastructure covers unit tests, integration tests, E2E tests, golden files, and contract tests.

## Test Suite Structure

```
/data/order-processing/app/tests/
  |-- vitest.config.ts          # Test configuration with coverage thresholds
  |-- setup.ts                  # Global test setup (env vars, mocks)
  |-- package.json              # Test dependencies
  |-- README.md                 # Comprehensive documentation
  |
  |-- unit/                     # Unit tests
  |   |-- parser/
  |   |   |-- header-detector.test.ts
  |   |   |-- formula-detector.test.ts
  |   |   |-- schema-inference.test.ts
  |   |   |-- normalizer.test.ts
  |   |-- validation/
  |   |   |-- gtin.test.ts
  |   |   |-- arithmetic.test.ts
  |   |-- crypto/
  |   |   |-- fingerprint.test.ts
  |   |-- committee/
  |       |-- weighted-voting.test.ts
  |       |-- consensus.test.ts
  |
  |-- integration/              # Integration tests
  |   |-- parser.integration.test.ts
  |   |-- committee.integration.test.ts
  |   |-- zoho-matcher.integration.test.ts
  |
  |-- e2e/                      # End-to-end tests
  |   |-- order-workflow.e2e.test.ts
  |   |-- setup/
  |       |-- mock-zoho.ts
  |       |-- mock-teams.ts
  |       |-- mock-providers.ts
  |
  |-- contract/                 # Contract tests (NEW)
  |   |-- zoho-api.contract.test.ts
  |   |-- committee-response.contract.test.ts
  |
  |-- golden-files/             # Golden file harness
  |   |-- README.md
  |   |-- runner.ts
  |   |-- generate-fixtures.ts
  |   |-- fixtures/             # Excel test files
  |   |-- expected/             # Expected JSON outputs
  |       |-- simple-english.json
  |       |-- simple-farsi.json
  |       |-- with-formulas.json
  |       |-- missing-sku.json
  |
  |-- mocks/                    # Mock data
  |   |-- zoho-responses.ts
  |   |-- committee-responses.ts
  |   |-- sample-orders.ts
  |
  |-- utils/                    # Test utilities
      |-- test-helpers.ts
      |-- excel-builder.ts
```

## Test Categories

### 1. Unit Tests

**Parser Tests:**
- `header-detector.test.ts` - Header row detection, scoring, Farsi support, multiple candidates
- `formula-detector.test.ts` - Excel formula detection, blocking policy
- `schema-inference.test.ts` - Column mapping, synonym matching, confidence scoring, adjacency heuristics
- `normalizer.test.ts` - Number formats (EU/US), Persian digits, GTIN validation, currency handling

**Validation Tests:**
- `gtin.test.ts` - GTIN-8/12/13/14 validation, check digit calculation, type detection
- `arithmetic.test.ts` - Line total validation, order total validation, tolerance handling

**Committee Tests:**
- `weighted-voting.test.ts` - Weight calculation, vote aggregation, 2/3 consensus, weighted scoring
- `consensus.test.ts` - Unanimous detection, majority detection, critical field policy, confidence thresholds

**Crypto Tests:**
- `fingerprint.test.ts` - Idempotency key generation, line items hash, file hash, date bucket

### 2. Integration Tests

- `parser.integration.test.ts` - Full parsing pipeline, schema inference, validation, issue aggregation
- `committee.integration.test.ts` - 3-provider committee, weight calibration, bounded extraction, error handling
- `zoho-matcher.integration.test.ts` - Customer matching (exact/fuzzy), item matching (SKU/GTIN), cache integration

### 3. E2E Tests

- `order-workflow.e2e.test.ts` - Complete workflow scenarios:
  - Happy path (English/Farsi)
  - User correction workflow
  - Committee decision workflow
  - Idempotency checking
  - Error scenarios (formulas, Zoho outage, empty spreadsheet)
  - Audit trail creation

**Mock Services:**
- `mock-zoho.ts` - MSW-based Zoho API mock (customers, items, sales orders, OAuth)
- `mock-teams.ts` - Teams bot adapter mock (file upload, card submission)
- `mock-providers.ts` - AI provider mock (GPT-4, Claude, Gemini responses)

### 4. Contract Tests (NEW)

- `zoho-api.contract.test.ts`:
  - Customer response schema validation
  - Item response schema validation
  - Sales order request/response validation
  - OAuth token response validation
  - Error code validation

- `committee-response.contract.test.ts`:
  - Vote schema validation
  - Committee result schema validation
  - Evidence pack schema validation
  - Model response schema validation
  - Weight calibration data schema validation
  - Aggregation rules validation

### 5. Golden Files Harness

**Fixtures (Excel files):**
- `simple-english.xlsx` - Basic English headers
- `simple-farsi.xlsx` - Farsi headers with Persian product names
- `with-formulas.xlsx` - Formulas in data (should BLOCK)
- `missing-sku.xlsx` - Missing SKU column
- Plus 10+ additional scenarios documented in README

**Expected Outputs:**
- `simple-english.json` - Ready status, all fields mapped
- `simple-farsi.json` - Farsi language detected, quantities converted
- `with-formulas.json` - Blocked status, FORMULAS_BLOCKED issue
- `missing-sku.json` - Blocked status, MISSING_COLUMN issue

**Runner Script Features:**
- Parses all fixtures, compares to expected output
- Calibration mode to update expected outputs
- Diff reporting for failures
- Ignores dynamic fields (timestamps, correlation IDs)
- Exit code 0/1 for CI integration

## Test Configuration

**Vitest Config (`vitest.config.ts`):**
```typescript
{
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    testTimeout: 30000
  }
}
```

**NPM Scripts:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:unit": "vitest run unit/",
  "test:integration": "vitest run integration/",
  "test:e2e": "vitest run e2e/",
  "test:golden": "tsx golden-files/runner.ts",
  "test:golden:calibrate": "tsx golden-files/runner.ts --calibrate"
}
```

## Test Utilities

**test-helpers.ts:**
- `deepEqual()` - Deep comparison with ignore paths
- `computeDiff()` - Object diff for debugging
- `createMockEvidence()` - Create evidence cells
- `validateGtinCheckDigit()` - GTIN validation
- `approxEqual()` - Floating point tolerance
- `normalizePersianDigits()` - Persian/Arabic digit conversion

**excel-builder.ts:**
- `ExcelBuilder` class for programmatic Excel creation
- Methods for formulas, merged cells, Farsi, Persian digits, hidden rows
- Used for fixture generation and test data

## Mock Data

**zoho-responses.ts:**
- 5 mock customers (including Farsi)
- 4 mock items with GTINs
- Sales order response template
- Error response templates

**committee-responses.ts:**
- Unanimous high/low confidence scenarios
- 2-of-3 consensus scenarios
- Complete disagreement scenarios
- Provider timeout scenarios
- Weight calibration data

**sample-orders.ts:**
- Simple English/Farsi orders
- Mixed language orders
- Orders with GTINs, zero quantity
- Arithmetic mismatch orders
- Large order (50 lines)
- Canonical JSON example

## CI Integration

Tests designed for CI/CD:
- No real external API calls
- All mocked with MSW
- Coverage thresholds enforced
- Exit codes for pass/fail
- Golden files for regression

**Recommended CI Workflow:**
```yaml
- run: npm run test:coverage
- run: npm run test:golden
```

## Coverage Targets

| Metric | Target | Status |
|--------|--------|--------|
| Lines | 80% | Configured |
| Functions | 80% | Configured |
| Branches | 75% | Configured |
| Statements | 80% | Configured |

## Files Created/Modified

### New Files:
- `/data/order-processing/app/tests/contract/zoho-api.contract.test.ts`
- `/data/order-processing/app/tests/contract/committee-response.contract.test.ts`

### Existing Files Verified:
- All unit tests (9 files)
- All integration tests (3 files)
- E2E tests and mocks (4 files)
- Golden files infrastructure (6 files)
- Test utilities (2 files)
- Mock data (3 files)
- Configuration files (4 files)

## Key Design Decisions

1. **Vitest over Jest** - Faster, ESM native, better TypeScript support
2. **MSW for mocking** - Network-level mocking, no code changes needed
3. **Golden files for regression** - Parser changes caught early
4. **Contract tests for schemas** - API compatibility guaranteed
5. **No real external calls** - All tests CI-safe
6. **Persian/Farsi support** - All tests include RTL and digit conversion scenarios

## Recommendations

1. Run `npm run test:golden:calibrate` after parser changes
2. Add new golden files for each major format variation
3. Re-calibrate committee weights quarterly using golden files
4. Monitor test execution time (<5min total)
5. Review coverage reports monthly

## Conclusion

The test suite provides comprehensive coverage:
- **Unit tests** for all core logic
- **Integration tests** for service interactions
- **E2E tests** for complete workflows
- **Contract tests** for API compatibility
- **Golden files** for regression prevention

All tests run without external dependencies, making them suitable for CI/CD pipelines.
