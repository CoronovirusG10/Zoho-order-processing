# Runbook: Adding New Spreadsheet Template

## When to Use

- New customer with different Excel format
- Existing customer changed their export format
- Adding Farsi-only template support

## Discovery

### 1. Collect Sample Files

Get 5-10 representative files from the customer:
- Different order sizes
- Edge cases (zero quantity, missing fields)
- Both typical and problematic examples

### 2. Analyze Structure

```bash
# Run parser in debug mode
npm run parse:debug -- --file samples/new-customer.xlsx

# Output shows:
# - Detected sheets
# - Header candidates
# - Column type inference
# - Unmapped columns
# - Confidence scores
```

### 3. Document Format

Create format documentation:
```markdown
## Customer: ACME Corp

### Sheet Structure
- Sheet name: "Order" or "سفارش"
- Header row: 2 (row 1 is title)
- Data starts: row 3

### Column Mapping
| Their Header | Canonical Field | Notes |
|--------------|-----------------|-------|
| Item Code    | sku             | Always present |
| کد کالا      | sku             | Farsi variant |
| QTY          | quantity        | Integer only |
| Amount       | line_total      | Includes VAT |
```

## Implementation

### 1. Update Synonym Dictionary

Edit `services/parser/src/schema-inference/synonyms.ts`:

```typescript
export const SYNONYMS = {
  sku: [
    // ... existing
    'item code',      // New customer
    'کد کالا',        // Farsi variant
  ],
  quantity: [
    // ... existing
    'qty',
    'تعداد',
  ],
  // Add any new field mappings
};
```

### 2. Add Golden File

1. Copy a representative file to `tests/golden-files/fixtures/`:
```bash
cp samples/acme-order.xlsx tests/golden-files/fixtures/acme-english.xlsx
```

2. Create expected output:
```bash
npm run parse -- --file tests/golden-files/fixtures/acme-english.xlsx \
  --output tests/golden-files/expected/acme-english.json
```

3. Manually verify and adjust the expected JSON

### 3. Run Tests

```bash
# Unit tests for synonyms
npm test -- --filter "synonyms"

# Golden file tests
npm run test:golden

# Full regression
npm test
```

### 4. Calibrate Committee Weights

```bash
npm run calibrate -- --include-new-golden-files
```

## Deployment

1. Create PR with changes
2. Run CI pipeline (all tests)
3. Deploy to staging
4. Process test file from customer
5. Verify output
6. Deploy to production

## Troubleshooting

### Low Confidence on New Format

If parser shows low confidence:
1. Add more synonyms
2. Adjust type detection patterns
3. Add positional hints if columns are consistent

### Committee Disagrees on New Format

If committee disagrees:
1. Check if headers are ambiguous
2. Add more sample values to golden file
3. Consider adding format-specific hints

### Customer Uses Formulas

If files contain formulas:
1. Confirm with customer this is intentional
2. If yes, set `block_if_formulas: false` for this customer (future feature)
3. If no, ask them to export as values-only
