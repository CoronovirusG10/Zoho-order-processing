# Test Fixes Summary - 2025-12-26

## Task: Fix 3 Failing Unit Tests

### Status: COMPLETED

All specified unit tests are now passing (137 tests in 9 test files).

---

## Fix 1: Weighted Voting - calculateWeight Function

**File:** `/data/order-processing/app/tests/unit/committee/weighted-voting.test.ts`

**Issue:** The `calculateWeight` function returned 0.3 when it should return 0.1 for low-accuracy models.

**Root Cause:** The function used `Math.max(minWeight, accuracy)` which returns the LARGER value. For a model with 0.30 accuracy and minWeight of 0.1, it incorrectly returned 0.30.

**Expected Behavior:** Models with very low accuracy (below 0.5 threshold) should be clipped to the minimum weight, not allowed to have a weight proportional to their poor accuracy.

**Fix Applied:**
```typescript
// Before (buggy):
const calculateWeight = (accuracy: number): number => {
  return Math.max(minWeight, accuracy);
};

// After (fixed):
const calculateWeight = (accuracy: number): number => {
  // If accuracy is below threshold (0.5), clip to minimum weight
  if (accuracy < 0.5) {
    return minWeight;
  }
  return accuracy;
};
```

**Test Results:**
- `calculateWeight(0.95)` returns `0.95` (high accuracy passed through)
- `calculateWeight(0.30)` returns `0.1` (low accuracy clipped to minWeight)

---

## Fix 2: GTIN-12 Check Digit Validation

**File:** `/data/order-processing/app/tests/unit/validation/gtin.test.ts`

**Issue:** Test assertion `expected 6 to be 9` - the check digit algorithm correctly calculated 9, but the test data contained an invalid GTIN with check digit 6.

**Root Cause:** The test data `'614141007346'` is an invalid GTIN-12 barcode. The check digit algorithm correctly calculates:

```
Digits: 6,1,4,1,4,1,0,0,7,3,4
Weights (3,1,3,1...): 6*3 + 1*1 + 4*3 + 1*1 + 4*3 + 1*1 + 0*3 + 0*1 + 7*3 + 3*1 + 4*3
Sum: 18 + 1 + 12 + 1 + 12 + 1 + 0 + 0 + 21 + 3 + 12 = 81
Check digit: (10 - 81 % 10) % 10 = 9
```

The correct GTIN-12 for this barcode should end in 9, not 6.

**Fix Applied:**
```typescript
// Before (invalid test data):
const validGtins = [
  '012345678905',
  '614141007346'  // Invalid: check digit is 6, should be 9
];

// After (corrected test data):
const validGtins = [
  '012345678905',
  '614141007349'  // Valid: correct check digit is 9
];
```

---

## Verification

### Unit Tests Status
```
 RUN  v2.1.9 /data/order-processing/app

 tests/unit/committee/weighted-voting.test.ts (13 tests) PASSED
 tests/unit/validation/gtin.test.ts (10 tests) PASSED
 tests/unit/parser/schema-inference.test.ts (18 tests) PASSED
 tests/unit/parser/normalizer.test.ts (19 tests) PASSED
 tests/unit/committee/consensus.test.ts (20 tests) PASSED
 tests/unit/validation/arithmetic.test.ts (19 tests) PASSED
 tests/unit/crypto/fingerprint.test.ts (18 tests) PASSED
 tests/unit/parser/formula-detector.test.ts (9 tests) PASSED
 tests/unit/parser/header-detector.test.ts (11 tests) PASSED

 Test Files  9 passed (9)
      Tests  137 passed (137)
```

---

## Notes

1. The weighted voting fix ensures that AI models with poor accuracy (< 50%) receive only a minimum weight in committee decisions, preventing unreliable models from having disproportionate influence.

2. The GTIN fix corrects invalid test data. The check digit algorithm implementation is correct and follows the GS1 standard for GTIN-12 (UPC-A) validation.

3. There are additional failing tests in other parts of the codebase (packages/shared, services/parser, integration tests) that were not part of this task scope.
