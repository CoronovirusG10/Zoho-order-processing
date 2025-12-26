# Excel Parser Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Excel Parser                             │
│                                                                  │
│  Input: .xlsx file                                              │
│  Output: CanonicalSalesOrder + Issues                          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Parser (parser.ts)                   │
│                                                                  │
│  Orchestrates the entire parsing pipeline                       │
│  Returns: CanonicalSalesOrder                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ Formula Detector │      │  Sheet Selector  │
│                  │      │                  │
│ • Scan all cells │      │ • Score sheets   │
│ • Detect formulas│      │ • Pick best      │
│ • BLOCK if found │      │ • Return choices │
└──────────────────┘      └──────────┬───────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │ Header Detector  │
                          │                  │
                          │ • Scan first 10  │
                          │ • Score headers  │
                          │ • Find best row  │
                          └──────────┬───────┘
                                     │
                                     ▼
                          ┌──────────────────────────┐
                          │   Schema Inference       │
                          │                          │
                          │ ┌─────────────────────┐ │
                          │ │ Synonym Matcher     │ │
                          │ │ • English + Farsi   │ │
                          │ │ • Fuzzy matching    │ │
                          │ └─────────────────────┘ │
                          │                          │
                          │ ┌─────────────────────┐ │
                          │ │ Type Detector       │ │
                          │ │ • Column types      │ │
                          │ │ • Compatibility     │ │
                          │ └─────────────────────┘ │
                          │                          │
                          │ ┌─────────────────────┐ │
                          │ │ Confidence Scorer   │ │
                          │ │ • Overall score     │ │
                          │ │ • Stage scores      │ │
                          │ └─────────────────────┘ │
                          └──────────┬───────────────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │  Row Extractor   │
                          │                  │
                          │ • Extract rows   │
                          │ • Skip totals    │
                          │ • Add evidence   │
                          └──────────┬───────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │   Normalizer     │
                          │                  │
                          │ • Numbers        │
                          │ • SKU/GTIN       │
                          │ • Persian digits │
                          │ • Currency       │
                          └──────────┬───────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │    Validator     │
                          │                  │
                          │ • Required       │
                          │ • Arithmetic     │
                          │ • Totals         │
                          └──────────────────┘
```

## Data Flow

```
┌──────────────┐
│ Excel File   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 1. Load Workbook                             │
│    ExcelJS parses .xlsx into object model    │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 2. Formula Detection                         │
│    ✓ No formulas → Continue                  │
│    ✗ Formulas found → BLOCK                  │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 3. Sheet Selection                           │
│    Score: density, rows, cols, types         │
│    Pick: highest scoring sheet               │
│    Output: SheetSelection {                  │
│      selectedSheet: "Orders",                │
│      confidence: 0.85                        │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 4. Header Detection                          │
│    Score: position, variety, keywords        │
│    Pick: highest scoring row                 │
│    Output: HeaderDetection {                 │
│      headerRow: 1,                           │
│      confidence: 0.92                        │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 5. Schema Inference                          │
│    For each canonical field:                 │
│      • Match synonyms                        │
│      • Fuzzy match                           │
│      • Check type compatibility              │
│      • Score confidence                      │
│    Output: SchemaInference {                 │
│      column_mappings: [                      │
│        {field: "sku", column: "A", conf: 1.0}│
│        {field: "qty", column: "C", conf: 0.9}│
│      ]                                       │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 6. Customer Extraction                       │
│    Search: header area, data rows            │
│    Output: {                                 │
│      value: "Acme Corp",                     │
│      evidence: [{cell: "A1", ...}]           │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 7. Row Extraction                            │
│    For each row after header:                │
│      • Skip if empty                         │
│      • Skip if total row                     │
│      • Extract mapped columns                │
│      • Attach evidence                       │
│    Output: ExtractedRow[] {                  │
│      rowNumber, cells, isTotal               │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 8. Normalization                             │
│    For each extracted value:                 │
│      • Numbers: locale-aware parsing         │
│      • SKU: uppercase, trim                  │
│      • GTIN: digits only, validate           │
│      • Persian: convert to ASCII             │
│    Output: LineItem[] {                      │
│      sku, gtin, quantity, prices, evidence   │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 9. Validation                                │
│    Check:                                    │
│      • Required fields present               │
│      • Arithmetic: qty × price ≈ total       │
│      • Totals: sum(lines) ≈ subtotal         │
│      • No negative quantities                │
│    Output: Issue[] {                         │
│      code, severity, message, evidence       │
│    }                                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 10. Return CanonicalSalesOrder               │
│     {                                        │
│       meta: {...},                           │
│       customer: {...},                       │
│       line_items: [...],                     │
│       schema_inference: {...},               │
│       confidence: {...},                     │
│       issues: [...]                          │
│     }                                        │
└──────────────────────────────────────────────┘
```

## Evidence Chain

Every extracted value maintains an audit trail:

```
Cell Reference Chain
─────────────────────

Excel Cell: B12
    │
    ▼
┌───────────────────────┐
│ Raw Value: "1,234.56" │
│ Display: "1,234.56"   │
│ Format: "#,##0.00"    │
└───────────────────────┘
    │
    ▼ [Normalization]
┌───────────────────────┐
│ Normalized: 1234.56   │
│ Type: number          │
└───────────────────────┘
    │
    ▼ [Attachment]
┌────────────────────────┐
│ LineItem.unit_price = │
│   1234.56             │
│                       │
│ evidence: {           │
│   sheet: "Orders",    │
│   cell: "B12",        │
│   raw_value: "1,234.56"│
│   display_value: ...  │
│   number_format: ...  │
│ }                     │
└───────────────────────┘
```

## Confidence Calculation

```
Stage Confidences
─────────────────

Sheet Selection    ──→  0.85  ──┐
                                │
Header Detection   ──→  0.92  ──┤
                                ├──→ Overall
Column Mapping     ──→  0.88  ──┤      0.88
                                │
    Weights:                    │
    • Sheet:    20%  ───────────┘
    • Header:   30%
    • Mapping:  50%

Overall = (0.85 × 0.20) + (0.92 × 0.30) + (0.88 × 0.50)
        = 0.17 + 0.276 + 0.44
        = 0.886
        ≈ 0.89 (High Confidence)
```

## Issue Severity Flow

```
Issue Detection & Classification
─────────────────────────────────

Issue Detected
    │
    ├──→ Formulas Present?        → BLOCKER
    ├──→ No Sheet Found?          → BLOCKER
    ├──→ Missing Customer?        → ERROR
    ├──→ Missing Quantity?        → ERROR
    ├──→ Missing SKU + GTIN?      → ERROR
    ├──→ Arithmetic Mismatch?     → WARNING
    ├──→ Negative Quantity?       → WARNING
    └──→ Low Confidence?          → INFO

Severity Impact:
─────────────────
BLOCKER  → Stop processing immediately
ERROR    → Cannot create order without resolution
WARNING  → Can proceed but requires attention
INFO     → Informational only
```

## Multilingual Support

```
Header Matching Flow
────────────────────

Input Header: "کد کالا"
    │
    ▼
┌─────────────────────────┐
│ Normalize:              │
│ • Lowercase             │
│ • Trim spaces           │
│ • Replace separators    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Match Against Synonyms: │
│                         │
│ sku: [                  │
│   "sku",                │
│   "item code",          │
│   "کد کالا",  ← MATCH! │
│   "کد محصول"           │
│ ]                       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Check Type:             │
│ Column contains text    │
│ Compatible with SKU ✓   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Calculate Confidence:   │
│ • Exact match: 1.0      │
│ • Type compatible: 1.0  │
│ • Final: 1.0            │
└─────────────────────────┘
```

## Type Detection

```
Column Type Detection
─────────────────────

Sample Values:
[10, 20, 15, 8, 12]
    │
    ▼
┌─────────────────────────┐
│ Analyze:                │
│ • 100% numeric          │
│ • 100% integer          │
│ • 0% decimal            │
│ • 0% text               │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Result:                 │
│ type: "integer"         │
│ confidence: 1.0         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Check Compatibility:    │
│ Field: "quantity"       │
│ Requires: [integer,     │
│            number,      │
│            decimal]     │
│ Match: ✓                │
└─────────────────────────┘
```

## Performance Characteristics

```
Complexity Analysis
───────────────────

Operation                   Complexity      Notes
────────────────────────────────────────────────────
Formula Detection          O(R × C)        R=rows, C=cols
Sheet Selection            O(S × R × C)    S=sheets
Header Detection           O(10 × C)       First 10 rows
Schema Inference           O(F × C × N)    F=fields, N=samples
Row Extraction             O(R × M)        M=mapped cols
Normalization              O(R × M)
Validation                 O(R)

Total: O(S × R × C + R × M)
       Dominated by sheet scanning
       Linear in total cells
```

## Memory Usage

```
Memory Footprint
────────────────

Component                  Est. Size
──────────────────────────────────────
Workbook Object           ~10-100 MB (depends on file)
Extracted Data            ~1-10 MB
Evidence Cells            ~100 KB - 1 MB
Issues Array              ~10-100 KB
Output JSON               ~1-5 MB

Peak Memory: ~15-115 MB per file
```

## Extension Points

```
Future Extension Architecture
─────────────────────────────

┌─────────────────────────────────┐
│      Parser Core (stable)       │
└────────┬────────────────────────┘
         │
         ├──→ [Plugin: LLM Committee]
         │    • Ambiguous mappings
         │    • Tie-breaking
         │
         ├──→ [Plugin: Template Learning]
         │    • Golden file training
         │    • Pattern recognition
         │
         ├──→ [Plugin: Multi-sheet]
         │    • Related sheet detection
         │    • Cross-sheet references
         │
         └──→ [Plugin: Custom Fields]
              • User-defined mappings
              • Industry-specific fields
```

## Integration Points

```
System Integration
──────────────────

Azure Function Handler
    │
    ▼
┌─────────────────────┐
│  Download from Blob │
│  Calculate SHA256   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Excel Parser       │
│  (this service)     │
└──────────┬──────────┘
           │
           ├──→ Issues? → Send to Teams (corrections needed)
           │
           └──→ Success → Send to Zoho Lookup Service
                              │
                              ▼
                         Resolve Customer/Items
                              │
                              ▼
                         Create Draft Order
```

## Error Recovery

```
Error Handling Strategy
───────────────────────

Try Block                  Catch Block
──────────                 ───────────

Load Workbook       →      File corrupted?
                           → Return BLOCKER issue

Formula Detection   →      Never fails
                           (worst case: no formulas)

Sheet Selection     →      No suitable sheet?
                           → Return BLOCKER issue

Header Detection    →      No header found?
                           → Return ERROR issue

Schema Inference    →      Low confidence?
                           → Continue with candidates

Row Extraction      →      Malformed data?
                           → Skip row, add WARNING

Normalization       →      Invalid value?
                           → null + WARNING

Validation          →      Always succeeds
                           (produces issues)
```
