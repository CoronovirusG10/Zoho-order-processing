# Excel Parser Service

Deterministic Excel parser for sales orders with multilingual support (English and Farsi).

## Features

- **Formula Blocking**: Detects and blocks spreadsheets containing formulas
- **Deterministic Extraction**: No LLM hallucination - all values grounded in cells
- **Evidence Tracking**: Every extracted value includes cell reference
- **Multilingual Support**: English and Farsi headers and values
- **Smart Schema Inference**: Automatic column mapping with confidence scores
- **Persian Digit Normalization**: Converts Persian/Arabic digits (۱۲۳ → 123)
- **Flexible Number Parsing**: Handles multiple locale formats (1,234.56 vs 1.234,56)
- **Totals Detection**: Automatically identifies and skips total rows
- **Arithmetic Validation**: Checks line totals with configurable tolerance
- **Qty=0 Support**: Zero quantity is valid (no warnings)

## Installation

```bash
npm install
```

## Usage

```typescript
import { parseExcelFile } from '@order-processing/parser';

const result = await parseExcelFile('./order.xlsx', {
  caseId: 'case-123',
  filename: 'order.xlsx',
  fileSha256: 'abc123...',
  tenantId: 'tenant-456'
});

console.log('Customer:', result.customer.input_name);
console.log('Line items:', result.line_items.length);
console.log('Issues:', result.issues);
```

## Parser Pipeline

### 1. Formula Detection
Scans all cells for formulas. If found, blocks processing with severity: blocker.

### 2. Sheet Selection
Scores each sheet based on:
- Presence of header row
- Density of data
- Numeric and text columns

### 3. Header Detection
Identifies header row by scoring first N rows on:
- Text variety
- Position (prefer rows 1-5)
- Keyword matches
- Data following pattern

### 4. Schema Inference
Maps columns to canonical fields using:
- Synonym dictionaries (English + Farsi)
- Fuzzy matching (Levenshtein distance)
- Type detection (numeric, text, currency)
- Confidence scoring

### 5. Row Extraction
Extracts data rows with evidence:
- Skips empty rows
- Identifies and skips total rows
- Handles merged cells
- Records cell references

### 6. Value Normalization
- Numbers: Handles locale variations, currency symbols
- SKU: Uppercase, trim
- GTIN: Validate format and check digit
- Persian digits: Convert to ASCII

### 7. Validation
- Required fields (quantity, customer)
- Arithmetic checks with tolerance
- GTIN validation
- Missing identifiers

## Canonical Fields

Supported fields with synonyms:

| Field | English Synonyms | Farsi Synonyms |
|-------|-----------------|----------------|
| sku | SKU, Item Code, Product Code | کد کالا, کد محصول |
| gtin | GTIN, EAN, UPC, Barcode | بارکد |
| product_name | Description, Product Name, Item | نام, شرح کالا |
| quantity | Qty, Quantity, Units | تعداد, مقدار |
| unit_price | Price, Unit Price, Rate | قیمت, قیمت واحد |
| line_total | Total, Amount, Line Total | جمع, مبلغ |
| customer | Customer, Client, Buyer | مشتری, خریدار |

## Output Schema

Returns a `CanonicalSalesOrder` object:

```typescript
{
  meta: {
    case_id: string,
    received_at: string,
    source_filename: string,
    file_sha256: string,
    language_hint: "en" | "fa" | null,
    parsing: {
      parser_version: string,
      contains_formulas: boolean,
      sheets_processed: string[]
    }
  },
  customer: {
    input_name: string | null,
    resolution_status: "unresolved" | "resolved" | "ambiguous" | "not_found",
    evidence: EvidenceCell[]
  },
  line_items: [{
    row: number,
    source_row_number: number,
    sku: string | null,
    gtin: string | null,
    product_name: string | null,
    quantity: number,
    unit_price_source: number | null,
    line_total_source: number | null,
    currency: string | null,
    evidence: {
      sku?: EvidenceCell,
      gtin?: EvidenceCell,
      product_name?: EvidenceCell,
      quantity?: EvidenceCell,
      unit_price_source?: EvidenceCell,
      line_total_source?: EvidenceCell
    }
  }],
  totals: {
    subtotal_source: number | null,
    tax_total_source: number | null,
    total_source: number | null,
    currency: string | null,
    evidence: Record<string, EvidenceCell>
  },
  schema_inference: {
    selected_sheet: string,
    table_region: string,
    header_row: number | null,
    column_mappings: ColumnMapping[],
    confidence: number
  },
  confidence: {
    overall: number,
    by_stage: {
      sheet_selection: number,
      header_detection: number,
      column_mapping: number
    }
  },
  issues: Issue[]
}
```

## Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| FORMULAS_BLOCKED | blocker | Formulas found in spreadsheet |
| NO_SUITABLE_SHEET | blocker | No sheet with order data found |
| NO_HEADER_ROW | error | Header row not detected |
| MISSING_CUSTOMER | error | Customer name not found |
| MISSING_QUANTITY | error | Line missing quantity |
| MISSING_ITEM_IDENTIFIER | error | Line missing SKU and GTIN |
| ARITHMETIC_MISMATCH | warning | Line total doesn't match qty × price |
| SUBTOTAL_MISMATCH | warning | Subtotal doesn't match sum of lines |
| NEGATIVE_QUANTITY | warning | Quantity is negative |

## Arithmetic Validation

Line totals are validated with tolerance:
```
abs(qty × price - line_total) ≤ max(0.02, 0.01 × line_total)
```

This allows for rounding differences while catching real errors.

## Testing

```bash
npm test
npm run test:watch
```

## Build

```bash
npm run build
```

## License

MIT
