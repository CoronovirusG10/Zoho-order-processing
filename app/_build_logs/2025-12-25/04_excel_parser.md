# Excel Parser Implementation Summary

**Agent:** AGENT 4 - Excel Parser & Schema Inference
**Date:** 2025-12-25
**Status:** COMPLETED

## Overview

Implemented deterministic Excel parsing with evidence tracking for sales order extraction. The parser follows the SOLUTION_DESIGN.md specifications and outputs canonical JSON per section 4.8.

## Files Modified/Created

### Core Parser Files (`/data/order-processing/app/services/parser/src/`)

| File | Status | Description |
|------|--------|-------------|
| `types.ts` | Enhanced | Added `ParserConfig`, `DEFAULT_PARSER_CONFIG`, extended `SheetSelection` with ambiguity detection |
| `formula-detector.ts` | Enhanced | Added config-driven formula policy (strict/warn/allow) |
| `sheet-selector.ts` | Enhanced | Added threshold-based selection with `requiresUserChoice` flag |
| `header-detector.ts` | Reviewed | Already complete - no changes needed |
| `schema-inference/synonyms.ts` | Enhanced | Comprehensive English + Farsi synonym dictionaries for all canonical fields |
| `schema-inference/header-matcher.ts` | Fixed | Changed from `rapidfuzz` (Python) to `fastest-levenshtein` (Node) |
| `row-extractor.ts` | Enhanced | Added merged cell handling with flags |
| `parser.ts` | Enhanced | Integrated config, added formula warning mode, sheet ambiguity handling |
| `index.ts` | Updated | Export new config types |

### Configuration Files

| File | Status | Description |
|------|--------|-------------|
| `package.json` | Fixed | Changed `rapidfuzz` to `fastest-levenshtein` |
| `tsconfig.json` | Updated | Removed explicit type requirements |

### Test Files

| File | Status | Description |
|------|--------|-------------|
| `../tests/package.json` | Fixed | Changed `rapidfuzz` to `fastest-levenshtein` |

## Implementation Details

### 1. Formula Detection (Strict by Default)

```typescript
interface FormulaDetectionOptions {
  policy?: 'strict' | 'warn' | 'allow';
}
```

- **strict** (default): Block file if formulas found - returns BLOCKED status
- **warn**: Continue processing but add warning issue
- **allow**: Ignore formulas entirely

Evidence tracking: Each formula cell is recorded with sheet, cell address, and formula text.

### 2. Sheet Selection with Ambiguity Detection

```typescript
interface SheetSelection {
  selectedSheet: string;
  confidence: number;
  candidates: SheetCandidate[];
  requiresUserChoice: boolean;  // NEW
  status: 'selected' | 'ambiguous' | 'none';  // NEW
}
```

Configurable thresholds:
- `sheetSelectionThreshold`: Minimum score for viability (default: 0.5)
- `sheetSelectionMinGap`: Minimum gap between top candidates (default: 0.15)

If multiple sheets score above threshold with small gap, `requiresUserChoice=true` and status='ambiguous'.

### 3. Header Detection

Already implemented with scoring based on:
- Position (rows 1-5 preferred)
- Text variety
- Keyword matching (English + Farsi)
- Data row detection (numeric cells below)

### 4. Schema Inference with Synonym Dictionaries

Canonical fields per SOLUTION_DESIGN.md section 4.8:
- **CustomerName** (internal: `customer`)
- **SKU** (internal: `sku`)
- **GTIN** (internal: `gtin`)
- **Quantity** (internal: `quantity`)
- **UnitPrice** (internal: `unit_price`)
- **LineTotal** (internal: `line_total`)
- **Description** (internal: `product_name`)

Comprehensive synonyms for each field covering:
- Common English variations
- Abbreviations and alternate formats
- Farsi translations and variations

Matching strategy:
1. Exact synonym match (dictionary lookup)
2. Substring synonym match (partial match)
3. Fuzzy match (Levenshtein distance via `fastest-levenshtein`)
4. Type compatibility scoring

Confidence scoring:
- Header score (0-1)
- Type score (0-1)
- Pattern score (0-1)
- Combined with fixed weights

### 5. Row Extraction with Merged Cell Handling

```typescript
interface ExtractedRowWithFlags extends ExtractedRow {
  flags: string[];  // NEW
}
```

Features:
- Detect merged cells and get value from master cell
- Flag `MERGED_CELL_VALUE` when using merged cell data
- Flag `MULTI_ROW_MERGE` for suspicious body merges
- Totals row detection with English + Farsi keywords
- Pattern detection (empty SKU + non-empty total = likely totals row)

### 6. Value Normalization

Already implemented:
- Number parsing with locale handling (1,234.56 vs 1.234,56)
- Persian/Arabic digit conversion
- Currency symbol detection and removal
- SKU normalization (uppercase, trim)
- GTIN validation (8/12/13/14 digits, check digit)

### 7. Validation

Already implemented:
- Required fields check
- Arithmetic tolerance checks (configurable)
- Qty=0 is valid (no warning)
- Missing customer/item issues

## Configuration Options

```typescript
interface ParserConfig {
  formulaPolicy: 'strict' | 'warn' | 'allow';
  sheetSelectionThreshold: number;
  sheetSelectionMinGap: number;
  maxHeaderSearchRows: number;
  mappingConfidenceThreshold: number;
  arithmeticAbsoluteTolerance: number;
  arithmeticRelativeTolerance: number;
}

const DEFAULT_PARSER_CONFIG: ParserConfig = {
  formulaPolicy: 'strict',
  sheetSelectionThreshold: 0.5,
  sheetSelectionMinGap: 0.15,
  maxHeaderSearchRows: 10,
  mappingConfidenceThreshold: 0.80,
  arithmeticAbsoluteTolerance: 0.02,
  arithmeticRelativeTolerance: 0.01
};
```

## Canonical JSON Output

The parser outputs `CanonicalSalesOrder` matching SOLUTION_DESIGN.md section 4.8:

```typescript
interface CanonicalSalesOrder {
  meta: {
    case_id: string;
    tenant_id?: string;
    received_at: string;
    source_filename: string;
    file_sha256: string;
    language_hint?: string | null;
    parsing?: {
      parser_version: string;
      contains_formulas: boolean;
      sheets_processed: string[];
    };
  };
  customer: Customer;
  line_items: LineItem[];
  totals?: Totals;
  schema_inference?: SchemaInference;
  confidence: {
    overall: number;
    by_stage?: Record<string, number>;
  };
  issues: Issue[];
}
```

Every extracted value includes evidence:
```typescript
interface EvidenceCell {
  sheet: string;
  cell: string;
  raw_value: any;
  display_value?: string | null;
  number_format?: string | null;
}
```

## Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| FORMULAS_BLOCKED | blocker | Formulas found in strict mode |
| FORMULAS_WARNING | warning | Formulas found in warn mode |
| NO_SUITABLE_SHEET | blocker | No sheet with order-like structure |
| MULTIPLE_SHEET_CANDIDATES | warning | Multiple viable sheets detected |
| SHEET_NOT_FOUND | blocker | Selected sheet not accessible |
| NO_HEADER_ROW | error | Could not detect header row |
| MISSING_QUANTITY_COLUMN | error | No quantity column mapped |
| MISSING_CUSTOMER | error | Customer not found |
| NO_LINE_ITEMS | blocker | No line items extracted |
| MISSING_QUANTITY | error | Line missing quantity |
| MISSING_ITEM_IDENTIFIER | error | Line missing SKU and GTIN |
| NEGATIVE_QUANTITY | warning | Negative quantity |
| ARITHMETIC_MISMATCH | warning | Qty * Price != LineTotal |
| SUBTOTAL_MISMATCH | warning | Sum of lines != subtotal |
| TOTAL_MISMATCH | warning | Expected total != actual |

## Dependencies

```json
{
  "dependencies": {
    "exceljs": "^4.4.0",
    "fastest-levenshtein": "^1.0.16"
  }
}
```

## Verification Notes

- Code follows TypeScript strict mode
- All functions have proper type annotations
- Evidence tracking implemented for all extracted values
- Configuration is fully documented with defaults
- Farsi/Persian language support throughout

## Integration Points

1. **Upstream:** Receives Excel buffer/file from Teams bot upload
2. **Downstream:**
   - Committee engine receives schema inference for validation
   - Zoho service receives line items for item resolution
   - Agent service receives issues for user clarification

## Next Steps for Other Agents

1. **Committee Engine:** Use `schema_inference.column_mappings` for mapping validation
2. **Agent Service:** Handle issues with `requiresUserInput: true`
3. **Zoho Service:** Resolve `customer.input_name` and `line_items[].sku/gtin`
