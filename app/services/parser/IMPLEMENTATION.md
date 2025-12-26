# Excel Parser Implementation Summary

## Overview

A comprehensive, deterministic Excel parser for sales orders with multilingual support (English and Farsi). Built according to specifications in `/data/order-processing/SOLUTION_DESIGN.md` Section 4 and conforming to the canonical schema in `/data/order-processing/v7/specs/schemas/canonical-sales-order.schema.json`.

## Architecture

### Package Structure
```
services/parser/
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Jest test configuration
├── .eslintrc.js             # ESLint configuration
├── .gitignore               # Git ignore patterns
├── README.md                # User documentation
├── IMPLEMENTATION.md        # This file
├── example.ts               # Usage example
│
├── src/
│   ├── index.ts             # Main entry point
│   ├── types.ts             # TypeScript type definitions
│   ├── parser.ts            # Main parser orchestration
│   ├── formula-detector.ts  # Formula detection (blocker)
│   ├── sheet-selector.ts    # Sheet selection with scoring
│   ├── header-detector.ts   # Header row detection
│   ├── row-extractor.ts     # Data row extraction
│   ├── normalizer.ts        # Value normalization
│   ├── validator.ts         # Validation rules
│   │
│   └── schema-inference/
│       ├── index.ts         # Schema inference orchestration
│       ├── synonyms.ts      # English + Farsi synonym dictionaries
│       ├── header-matcher.ts # Header to field matching
│       ├── type-detector.ts  # Column type detection
│       └── scoring.ts       # Confidence scoring
│
└── __tests__/
    ├── formula-detector.test.ts
    ├── header-matcher.test.ts
    └── normalizer.test.ts
```

## Core Components

### 1. Formula Detector (`src/formula-detector.ts`)

**Purpose**: Detect and block spreadsheets containing formulas

**Key Features**:
- Scans all cells in all sheets
- Detects both formula objects and strings starting with "="
- Returns blocker severity if formulas found
- Provides cell references for all formula locations

**Implementation**:
```typescript
function detectFormulas(workbook: Workbook): FormulaReport {
  // Scans all sheets and cells
  // Checks cell.formula, cell.formulaType, and string values
  // Returns: hasFormulas, formulaCells[], severity
}
```

### 2. Sheet Selector (`src/sheet-selector.ts`)

**Purpose**: Select the best sheet for order data

**Scoring Criteria**:
- Density of data (0-0.3 points)
- Row count suitable for orders (0.2 points)
- Column count 3-20 (0.1 points)
- Has numeric columns (0.2 points)
- Has text columns (0.1 points)

**Implementation**:
```typescript
function selectBestSheet(workbook: Workbook): SheetSelection {
  // Scores each visible sheet
  // Returns: selectedSheet, confidence, candidates[]
}
```

### 3. Header Detector (`src/header-detector.ts`)

**Purpose**: Detect the header row in a sheet

**Scoring Criteria**:
- Position (row 1: +0.3, rows 2-3: +0.2, rows 4-5: +0.1)
- Variety of values (high variety: +0.3)
- Text cell count (3+ cells: +0.2)
- Data follows pattern (numeric below text: +0.2)
- Keyword matches (2+ matches: +0.2)

**Keywords**:
- English: sku, item, product, quantity, price, total, customer, gtin
- Farsi: کد، کالا، محصول، نام، تعداد، قیمت، جمع، مشتری، بارکد

**Implementation**:
```typescript
function detectHeaderRow(worksheet: Worksheet): HeaderDetection {
  // Scans first 10 rows
  // Returns: headerRow, confidence, candidates[]
}
```

### 4. Schema Inference (`src/schema-inference/`)

**Purpose**: Map spreadsheet columns to canonical fields

**Process**:
1. **Synonym Matching**: Check against English + Farsi dictionaries
2. **Fuzzy Matching**: Use Levenshtein distance for similar terms
3. **Type Detection**: Verify column type matches field expectation
4. **Confidence Scoring**: Combine header match (70%) + type compatibility (30%)

**Canonical Fields**:
- customer, sku, gtin, product_name
- quantity, unit_price, line_total
- subtotal, tax, total

**Synonym Examples**:
```typescript
sku: ['sku', 'item code', 'product code', 'کد کالا']
quantity: ['qty', 'quantity', 'units', 'تعداد', 'مقدار']
unit_price: ['price', 'unit price', 'rate', 'قیمت']
```

**Implementation**:
```typescript
function inferSchema(
  worksheet: Worksheet,
  headerRow: number,
  sheetConfidence: number,
  headerConfidence: number
): SchemaInference
```

### 5. Row Extractor (`src/row-extractor.ts`)

**Purpose**: Extract data rows with evidence

**Features**:
- Skips empty rows
- Detects and skips total rows
- Handles merged cells
- Records evidence for every value

**Total Row Detection**:
- Keywords: "total", "grand total", "subtotal", "جمع", "مجموع"
- Pattern: Empty SKU/product but has line_total value

**Evidence Structure**:
```typescript
{
  sheet: string,
  cell: string,        // e.g., "B12"
  raw_value: any,
  display_value?: string,
  number_format?: string
}
```

### 6. Normalizer (`src/normalizer.ts`)

**Purpose**: Normalize values to canonical formats

**Capabilities**:

**Numbers**:
- US format: 1,234.56
- European format: 1.234,56
- French format: 1 234,56
- Swiss format: 1'234.56
- Persian digits: ۱۲۳۴ → 1234
- Currency symbols: $, €, £, ¥, ریال

**SKU**:
- Uppercase
- Trim whitespace
- Normalize internal spaces

**GTIN**:
- Extract digits only
- Convert Persian/Arabic digits
- Validate length (8, 12, 13, or 14 digits)
- Validate check digit

**Language Detection**:
- Detect Persian characters (U+0600-U+06FF)
- Returns 'fa' if >30% Persian, else 'en'

### 7. Validator (`src/validator.ts`)

**Purpose**: Validate extracted data

**Rules**:

1. **Required Fields**:
   - Customer name (error if missing)
   - Quantity for each line (error if missing)
   - SKU or GTIN for each line (error if both missing)

2. **Arithmetic Checks**:
   ```
   abs(qty × unit_price - line_total) ≤ max(0.02, 0.01 × line_total)
   ```
   - Allows for rounding differences
   - Warning severity

3. **Qty=0 Handling**:
   - Zero quantity is VALID
   - No warning issued for qty=0
   - Only flag negative quantities

4. **Totals Validation**:
   - Subtotal = sum of line totals
   - Total = subtotal + tax
   - Same tolerance as line arithmetic

**Issue Severity Levels**:
- **blocker**: Cannot proceed (e.g., formulas present)
- **error**: Missing required data
- **warning**: Suspicious but not blocking
- **info**: Informational only

## Parser Pipeline

### Complete Flow

```
1. Load Workbook
   ↓
2. Formula Detection → BLOCKER if formulas found
   ↓
3. Sheet Selection → Score all sheets, pick best
   ↓
4. Header Detection → Find header row
   ↓
5. Schema Inference → Map columns to fields
   ↓
6. Customer Extraction → Find customer name
   ↓
7. Row Extraction → Extract data rows
   ↓
8. Normalization → Convert to canonical format
   ↓
9. Validation → Check all rules
   ↓
10. Return CanonicalSalesOrder
```

## Key Design Principles

### 1. Deterministic Extraction
- **No LLM invention**: All values must exist in cells
- **Evidence required**: Every value has cell reference
- **Reproducible**: Same input always produces same output

### 2. Multilingual Support
- **English + Farsi**: Synonym dictionaries for both
- **Persian digits**: Automatic conversion
- **Locale-aware**: Number format detection

### 3. Conservative Approach
- **Formula blocking**: Absolute blocker
- **Confidence scores**: Track uncertainty
- **Multiple candidates**: Show alternatives when ambiguous

### 4. User-Friendly Issues
- **Clear messages**: Explain what's wrong
- **Suggested actions**: Tell user how to fix
- **Evidence included**: Show which cells are problematic

## Dependencies

```json
{
  "exceljs": "^4.4.0",      // Excel file parsing
  "rapidfuzz": "^3.0.0"     // Fuzzy string matching
}
```

## Usage

### Basic Usage

```typescript
import { parseExcelFile } from '@order-processing/parser';

const result = await parseExcelFile('./order.xlsx', {
  caseId: 'case-123',
  filename: 'order.xlsx',
  fileSha256: 'abc123...',
  tenantId: 'tenant-456'
});

// Check for blocking issues
const hasBlockers = result.issues.some(i => i.severity === 'blocker');

if (!hasBlockers) {
  console.log('Customer:', result.customer.input_name);
  console.log('Lines:', result.line_items.length);
}
```

### From Buffer

```typescript
import { parseExcelBuffer } from '@order-processing/parser';

const buffer = fs.readFileSync('./order.xlsx');
const result = await parseExcelBuffer(buffer, options);
```

### From Stream

```typescript
import { parseExcelStream } from '@order-processing/parser';

const stream = fs.createReadStream('./order.xlsx');
const result = await parseExcelStream(stream, options);
```

## Testing

### Test Coverage

- Formula detection with various formula types
- Header matching for English and Farsi
- Number normalization across locales
- Persian digit conversion
- GTIN validation
- Language detection

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
```

## Output Format

The parser returns a `CanonicalSalesOrder` conforming to the schema in `/data/order-processing/v7/specs/schemas/canonical-sales-order.schema.json`.

### Key Fields

```typescript
{
  meta: {
    case_id: string,
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
    evidence: { /* cell references */ }
  }],

  schema_inference: {
    selected_sheet: string,
    header_row: number,
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

## Confidence Scoring

### Overall Confidence
```
overall = sheet_confidence × 0.2
        + header_confidence × 0.3
        + mapping_confidence × 0.5
```

### Mapping Confidence
Based on:
- Required fields found (quantity: 40%)
- Important fields found (sku/gtin/product/customer: 15% each)
- Optional fields found (price/total: 7.5% each)

### Thresholds
- **High**: ≥ 0.80
- **Medium**: 0.60 - 0.79
- **Low**: < 0.60

## Error Handling

### Blocker Issues
- Formulas present
- No suitable sheet found
- Sheet not found

### Error Issues
- No header row
- Missing customer
- Missing quantity
- Missing SKU and GTIN
- No line items

### Warning Issues
- Arithmetic mismatch
- Subtotal/total mismatch
- Negative quantity

## Future Enhancements

### Potential Improvements
1. **LLM Integration**: Optional committee for ambiguous mappings
2. **Multi-sheet Orders**: Support orders spanning multiple sheets
3. **Template Learning**: Learn from golden files
4. **Custom Fields**: Support additional custom fields
5. **Date Detection**: Parse order dates
6. **Address Extraction**: Extract shipping/billing addresses

### Optimization Opportunities
1. **Caching**: Cache type detection results
2. **Streaming**: Stream large files
3. **Parallel Processing**: Process sheets in parallel
4. **Lazy Loading**: Only load selected sheet

## Compliance

### Design Requirements Met

✅ **Formula blocking**: Severity blocker if formulas exist
✅ **Deterministic extraction**: No LLM inventing values
✅ **Evidence for every value**: All fields have cell references
✅ **Multilingual**: English AND Farsi headers supported
✅ **Qty=0 is valid**: No warning on zero quantity
✅ **Synonym dictionaries**: Comprehensive English + Farsi
✅ **Persian digits**: Converted to ASCII
✅ **Arithmetic validation**: Configurable tolerance
✅ **Total row detection**: Keywords + pattern matching
✅ **Confidence scores**: All stages tracked
✅ **Hidden rows**: Properly handled
✅ **Merged cells**: Detected and handled

## License

MIT
