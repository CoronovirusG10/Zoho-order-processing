# Excel Parser - Quick Start Guide

## Installation

```bash
cd /data/order-processing/app/services/parser
npm install
```

## Build

```bash
npm run build
```

## Run Tests

```bash
npm test
```

## Basic Usage

### 1. Parse from File Path

```typescript
import { parseExcelFile } from '@order-processing/parser';
import * as crypto from 'crypto';
import * as fs from 'fs';

// Calculate file hash
const buffer = fs.readFileSync('./order.xlsx');
const hash = crypto.createHash('sha256').update(buffer).digest('hex');

// Parse
const result = await parseExcelFile('./order.xlsx', {
  caseId: 'case-123',
  filename: 'order.xlsx',
  fileSha256: hash,
  tenantId: 'tenant-456'
});

console.log('Customer:', result.customer.input_name);
console.log('Lines:', result.line_items.length);
console.log('Issues:', result.issues.length);
```

### 2. Parse from Buffer

```typescript
import { parseExcelBuffer } from '@order-processing/parser';

const buffer = fs.readFileSync('./order.xlsx');
const result = await parseExcelBuffer(buffer, {
  caseId: 'case-123',
  filename: 'order.xlsx',
  fileSha256: hash
});
```

### 3. Parse from Stream

```typescript
import { parseExcelStream } from '@order-processing/parser';

const stream = fs.createReadStream('./order.xlsx');
const result = await parseExcelStream(stream, {
  caseId: 'case-123',
  filename: 'order.xlsx',
  fileSha256: hash
});
```

## Check Results

### Has Blocking Issues?

```typescript
const hasBlockers = result.issues.some(i => i.severity === 'blocker');

if (hasBlockers) {
  console.log('Cannot proceed - blocking issues found:');
  result.issues
    .filter(i => i.severity === 'blocker')
    .forEach(issue => console.log(`  - ${issue.message}`));
}
```

### Check Confidence

```typescript
const confidence = result.confidence.overall;

if (confidence >= 0.80) {
  console.log('High confidence parsing');
} else if (confidence >= 0.60) {
  console.log('Medium confidence - review recommended');
} else {
  console.log('Low confidence - manual review required');
}
```

### Access Line Items

```typescript
for (const item of result.line_items) {
  console.log(`Row ${item.source_row_number}:`);
  console.log(`  SKU: ${item.sku || 'N/A'}`);
  console.log(`  Product: ${item.product_name}`);
  console.log(`  Qty: ${item.quantity}`);
  console.log(`  Price: ${item.unit_price_source}`);

  // Evidence
  if (item.evidence.sku) {
    console.log(`  SKU from: ${item.evidence.sku.cell}`);
  }
}
```

### Review Issues

```typescript
// Group by severity
const bySize = {
  blocker: result.issues.filter(i => i.severity === 'blocker'),
  error: result.issues.filter(i => i.severity === 'error'),
  warning: result.issues.filter(i => i.severity === 'warning'),
  info: result.issues.filter(i => i.severity === 'info')
};

console.log('Blockers:', bySize.blocker.length);
console.log('Errors:', bySize.error.length);
console.log('Warnings:', bySize.warning.length);
console.log('Info:', bySize.info.length);

// Display with suggested actions
for (const issue of result.issues) {
  console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);

  if (issue.suggested_user_action) {
    console.log(`  → ${issue.suggested_user_action}`);
  }

  if (issue.evidence && issue.evidence.length > 0) {
    console.log(`  Evidence: ${issue.evidence[0].cell}`);
  }
}
```

## Common Patterns

### 1. Validate Before Processing

```typescript
const result = await parseExcelFile('./order.xlsx', options);

// Check for blockers
if (result.issues.some(i => i.severity === 'blocker')) {
  return {
    success: false,
    message: 'Cannot process - formulas present or file corrupted',
    issues: result.issues.filter(i => i.severity === 'blocker')
  };
}

// Check for errors
const errors = result.issues.filter(i => i.severity === 'error');
if (errors.length > 0) {
  return {
    success: false,
    message: 'Missing required data',
    issues: errors
  };
}

// Proceed with order creation
return {
  success: true,
  customer: result.customer.input_name,
  lineItems: result.line_items
};
```

### 2. Extract Evidence for Audit

```typescript
const auditTrail = {
  caseId: result.meta.case_id,
  filename: result.meta.source_filename,
  hash: result.meta.file_sha256,
  parsedAt: result.meta.received_at,

  evidence: {
    customer: result.customer.evidence?.map(e => ({
      cell: e.cell,
      value: e.raw_value
    })),

    lineItems: result.line_items.map(item => ({
      row: item.source_row_number,
      sku: item.evidence.sku?.cell,
      quantity: item.evidence.quantity?.cell,
      price: item.evidence.unit_price_source?.cell
    }))
  }
};

// Save for audit
fs.writeFileSync(
  './audit.json',
  JSON.stringify(auditTrail, null, 2)
);
```

### 3. Handle Low Confidence

```typescript
const result = await parseExcelFile('./order.xlsx', options);

if (result.confidence.overall < 0.80) {
  // Get low-confidence mappings
  const lowConfMappings = result.schema_inference?.column_mappings
    .filter(m => m.confidence < 0.80);

  console.log('Low confidence mappings:');
  for (const mapping of lowConfMappings || []) {
    console.log(`  ${mapping.canonical_field}: ${mapping.source_header}`);
    console.log(`    Confidence: ${(mapping.confidence * 100).toFixed(0)}%`);

    if (mapping.candidates && mapping.candidates.length > 1) {
      console.log(`    Alternatives:`);
      mapping.candidates.slice(1, 3).forEach(c => {
        console.log(`      - ${c.header} (${c.score.toFixed(2)})`);
      });
    }
  }

  // Ask user to confirm or select alternatives
}
```

### 4. Multilingual Detection

```typescript
const result = await parseExcelFile('./order.xlsx', options);

console.log('Detected language:', result.meta.language_hint);

if (result.meta.language_hint === 'fa') {
  // Persian spreadsheet
  console.log('Persian order detected');

  // Use Persian messages for issues
  const messages = {
    MISSING_CUSTOMER: 'نام مشتری یافت نشد',
    MISSING_QUANTITY: 'تعداد وارد نشده است'
  };

  result.issues.forEach(issue => {
    console.log(messages[issue.code] || issue.message);
  });
}
```

## Run Example

The package includes a complete example:

```bash
npm run build
node dist/example.js
```

## Expected Output Structure

```typescript
{
  meta: {
    case_id: "case-123",
    received_at: "2025-12-25T10:30:00.000Z",
    source_filename: "order.xlsx",
    file_sha256: "abc123...",
    language_hint: "en",
    parsing: {
      parser_version: "1.0.0",
      contains_formulas: false,
      sheets_processed: ["Orders"]
    }
  },

  customer: {
    input_name: "Acme Corporation",
    resolution_status: "unresolved",
    evidence: [{
      sheet: "Orders",
      cell: "B2",
      raw_value: "Acme Corporation"
    }]
  },

  line_items: [
    {
      row: 0,
      source_row_number: 5,
      sku: "PROD-001",
      gtin: "1234567890123",
      product_name: "Widget A",
      quantity: 10,
      unit_price_source: 99.99,
      line_total_source: 999.90,
      currency: "USD",
      evidence: {
        sku: { sheet: "Orders", cell: "A5", raw_value: "PROD-001" },
        quantity: { sheet: "Orders", cell: "C5", raw_value: 10 }
      }
    }
  ],

  schema_inference: {
    selected_sheet: "Orders",
    table_region: "A4:F25",
    header_row: 4,
    column_mappings: [
      {
        canonical_field: "sku",
        source_header: "Item Code",
        source_column: "A",
        confidence: 0.95,
        method: "dictionary"
      }
    ],
    confidence: 0.88
  },

  confidence: {
    overall: 0.88,
    by_stage: {
      sheet_selection: 0.85,
      header_detection: 0.92,
      column_mapping: 0.88
    }
  },

  issues: []
}
```

## Common Issues and Solutions

### Issue: Formulas Blocked

```
[BLOCKER] FORMULAS_BLOCKED: Found 5 formula(s) in spreadsheet
→ Export the spreadsheet with values only (no formulas) and upload again
```

**Solution**: In Excel, use "Save As" and select "Values" format, or copy-paste values.

### Issue: Missing Customer

```
[ERROR] MISSING_CUSTOMER: Customer name not found in spreadsheet
→ Please provide the customer name
```

**Solution**: Add customer name to spreadsheet or provide it separately.

### Issue: Arithmetic Mismatch

```
[WARNING] ARITHMETIC_MISMATCH: Line 5: Calculated total (100.00) differs from spreadsheet total (99.50)
→ Please verify the quantity, unit price, and line total
```

**Solution**: Check for rounding errors or calculation mistakes in spreadsheet.

## Performance Tips

### 1. Stream Large Files

For files > 10MB, use streaming:

```typescript
const stream = fs.createReadStream('./large-order.xlsx');
const result = await parseExcelStream(stream, options);
```

### 2. Batch Processing

Process multiple files in parallel:

```typescript
const files = ['order1.xlsx', 'order2.xlsx', 'order3.xlsx'];

const results = await Promise.all(
  files.map(file => parseExcelFile(file, {
    caseId: `case-${file}`,
    filename: file,
    fileSha256: calculateHash(file)
  }))
);
```

### 3. Memory Management

For very large files, process in chunks if possible or increase Node.js heap:

```bash
node --max-old-space-size=4096 your-script.js
```

## Testing Your Integration

```typescript
import { parseExcelFile } from '@order-processing/parser';
import * as assert from 'assert';

// Test with known good file
const result = await parseExcelFile('./test-data/good-order.xlsx', {
  caseId: 'test-1',
  filename: 'good-order.xlsx',
  fileSha256: 'test-hash'
});

// Assertions
assert.strictEqual(result.issues.filter(i => i.severity === 'blocker').length, 0);
assert.ok(result.customer.input_name);
assert.ok(result.line_items.length > 0);
assert.ok(result.confidence.overall >= 0.60);

console.log('Integration test passed!');
```

## Next Steps

1. Review the [README.md](./README.md) for detailed features
2. Check [IMPLEMENTATION.md](./IMPLEMENTATION.md) for architecture details
3. See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagrams
4. Run tests: `npm test`
5. Build: `npm run build`
6. Integrate with your Azure Function or service

## Support

For issues or questions:
1. Check test files in `__tests__/` for examples
2. Review `example.ts` for complete usage
3. See documentation in `/data/order-processing/SOLUTION_DESIGN.md`
