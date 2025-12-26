/**
 * Main parser orchestration
 *
 * Deterministic Excel parsing pipeline:
 * 1. Formula detection (strict by default)
 * 2. Sheet selection (with user choice for ambiguous cases)
 * 3. Header detection
 * 4. Schema inference with synonym dictionaries
 * 5. Row extraction with merged cell handling
 * 6. Normalization (numbers, currencies, SKUs, GTINs)
 * 7. Validation with arithmetic checks
 *
 * Outputs canonical JSON per SOLUTION_DESIGN.md section 4.8
 */

import { Workbook } from 'exceljs';
import {
  CanonicalSalesOrder,
  ParserOptions,
  ParserConfig,
  DEFAULT_PARSER_CONFIG,
  LineItem,
  Issue,
  Customer,
  Totals,
  EvidenceCell
} from './types';
import { detectFormulas } from './formula-detector';
import { selectBestSheet } from './sheet-selector';
import { detectHeaderRow } from './header-detector';
import { inferSchema } from './schema-inference';
import { extractRows, extractCustomer, ExtractedRowWithFlags } from './row-extractor';
import {
  normalizeNumber,
  normalizeSKU,
  normalizeGTIN,
  normalizeString,
  normalizeCurrency,
  detectLanguage
} from './normalizer';
import { validate } from './validator';

const PARSER_VERSION = '1.1.0';

export async function parseExcel(
  workbook: Workbook,
  options: ParserOptions
): Promise<CanonicalSalesOrder> {
  // Merge provided config with defaults
  const config: ParserConfig = {
    ...DEFAULT_PARSER_CONFIG,
    ...options.config
  };

  const issues: Issue[] = [];

  // Step 1: Formula detection (strict by default per config)
  const formulaReport = detectFormulas(workbook, { policy: config.formulaPolicy });

  if (formulaReport.hasFormulas && formulaReport.severity === 'blocker') {
    issues.push({
      code: 'FORMULAS_BLOCKED',
      severity: 'blocker',
      message: `Found ${formulaReport.formulaCells.length} formula(s) in spreadsheet. Please export as values only.`,
      evidence: formulaReport.formulaCells.slice(0, 10).map(fc => ({
        sheet: fc.sheet,
        cell: fc.cell,
        raw_value: fc.formula
      })),
      suggested_user_action: 'Export the spreadsheet with values only (no formulas) and upload again'
    });

    // Return early with blocker
    return createEmptyOrder(options, issues, formulaReport.hasFormulas, config);
  } else if (formulaReport.hasFormulas && formulaReport.severity === 'warning') {
    // Policy is 'warn' - add warning but continue processing
    issues.push({
      code: 'FORMULAS_WARNING',
      severity: 'warning',
      message: `Found ${formulaReport.formulaCells.length} formula(s) in spreadsheet. Values will be used but consider exporting without formulas.`,
      evidence: formulaReport.formulaCells.slice(0, 10).map(fc => ({
        sheet: fc.sheet,
        cell: fc.cell,
        raw_value: fc.formula
      })),
      suggested_user_action: 'For best results, export the spreadsheet with values only'
    });
  }

  // Step 2: Sheet selection with ambiguity detection
  const sheetSelection = selectBestSheet(workbook, {
    threshold: config.sheetSelectionThreshold,
    minGap: config.sheetSelectionMinGap
  });

  if (sheetSelection.status === 'none' || !sheetSelection.selectedSheet) {
    issues.push({
      code: 'NO_SUITABLE_SHEET',
      severity: 'blocker',
      message: 'Could not find a suitable sheet with order data',
      suggested_user_action: 'Please ensure the spreadsheet contains a sheet with order line items'
    });

    return createEmptyOrder(options, issues, formulaReport.hasFormulas, config);
  }

  // If multiple sheets are viable candidates, flag for user choice
  if (sheetSelection.requiresUserChoice) {
    issues.push({
      code: 'MULTIPLE_SHEET_CANDIDATES',
      severity: 'warning',
      message: `Multiple sheets appear to contain order data. Using "${sheetSelection.selectedSheet}" but please confirm.`,
      evidence: sheetSelection.candidates.map(c => ({
        sheet: c.name,
        cell: 'A1',
        raw_value: `Score: ${(c.score * 100).toFixed(0)}% - ${c.reason}`
      })),
      suggested_user_action: `Please confirm which sheet contains the order: ${sheetSelection.candidates.map(c => c.name).join(', ')}`
    });
  }

  const worksheet = workbook.getWorksheet(sheetSelection.selectedSheet);
  if (!worksheet) {
    issues.push({
      code: 'SHEET_NOT_FOUND',
      severity: 'blocker',
      message: `Selected sheet "${sheetSelection.selectedSheet}" not found`,
      suggested_user_action: 'Please check the spreadsheet structure'
    });

    return createEmptyOrder(options, issues, formulaReport.hasFormulas, config);
  }

  // Step 3: Header detection
  const headerDetection = detectHeaderRow(worksheet);
  if (!headerDetection.headerRow) {
    issues.push({
      code: 'NO_HEADER_ROW',
      severity: 'error',
      message: 'Could not detect header row in selected sheet',
      suggested_user_action: 'Please ensure the sheet has a header row with column names'
    });

    return createEmptyOrder(options, issues, formulaReport.hasFormulas, config);
  }

  // Step 4: Schema inference
  const schema = inferSchema(
    worksheet,
    headerDetection.headerRow,
    sheetSelection.confidence,
    headerDetection.confidence
  );

  // Check if we have required mappings
  const hasQuantity = schema.column_mappings.some(m => m.canonical_field === 'quantity');
  if (!hasQuantity) {
    issues.push({
      code: 'MISSING_QUANTITY_COLUMN',
      severity: 'error',
      message: 'Could not find a quantity column',
      suggested_user_action: 'Please ensure the sheet has a quantity column'
    });
  }

  // Step 5: Extract customer
  const customerData = extractCustomer(worksheet, headerDetection.headerRow, schema.column_mappings);

  const customer: Customer = {
    input_name: customerData.value,
    resolution_status: customerData.value ? 'unresolved' : 'not_found',
    evidence: customerData.evidence
  };

  // Step 6: Extract rows
  const extractedRows = extractRows(worksheet, headerDetection.headerRow, schema.column_mappings);

  // Filter out total rows
  const dataRows = extractedRows.filter(row => !row.isTotal);

  // Step 7: Normalize and build line items
  const lineItems: LineItem[] = [];
  const headerTexts: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineItem = buildLineItem(row, i, schema.column_mappings);

    // Skip rows with no quantity
    if (lineItem.quantity === null) {
      continue;
    }

    lineItems.push(lineItem);

    // Collect texts for language detection
    if (lineItem.product_name) {
      headerTexts.push(lineItem.product_name);
    }
  }

  // Step 8: Extract totals
  const totals = extractTotals(extractedRows, schema.column_mappings, worksheet.name);

  // Step 9: Detect language
  schema.column_mappings.forEach(m => headerTexts.push(m.source_header));
  const languageHint = detectLanguage(headerTexts);

  // Step 10: Validate
  const order: CanonicalSalesOrder = {
    meta: {
      case_id: options.caseId,
      tenant_id: options.tenantId,
      received_at: new Date().toISOString(),
      source_filename: options.filename,
      file_sha256: options.fileSha256,
      language_hint: languageHint,
      parsing: {
        parser_version: options.parserVersion || PARSER_VERSION,
        contains_formulas: formulaReport.hasFormulas,
        sheets_processed: [sheetSelection.selectedSheet]
      }
    },
    customer,
    line_items: lineItems,
    totals,
    schema_inference: schema,
    confidence: {
      overall: schema.confidence,
      by_stage: {
        sheet_selection: sheetSelection.confidence,
        header_detection: headerDetection.confidence,
        column_mapping: schema.confidence
      }
    },
    issues: [...issues, ...validate({
      meta: {
        case_id: options.caseId,
        received_at: new Date().toISOString(),
        source_filename: options.filename,
        file_sha256: options.fileSha256
      },
      customer,
      line_items: lineItems,
      confidence: { overall: schema.confidence },
      issues: []
    })]
  };

  return order;
}

function buildLineItem(
  row: ExtractedRowWithFlags,
  index: number,
  columnMappings: any[]
): LineItem {
  const evidence: any = {};

  // Extract and normalize each field
  const skuCell = row.cells['sku'];
  const sku = skuCell ? normalizeSKU(skuCell.value) : null;
  if (skuCell) evidence.sku = skuCell.evidence;

  const gtinCell = row.cells['gtin'];
  const gtin = gtinCell ? normalizeGTIN(gtinCell.value) : null;
  if (gtinCell) evidence.gtin = gtinCell.evidence;

  const productNameCell = row.cells['product_name'];
  const productName = productNameCell ? normalizeString(productNameCell.value) : null;
  if (productNameCell) evidence.product_name = productNameCell.evidence;

  const quantityCell = row.cells['quantity'];
  const quantity = quantityCell ? normalizeNumber(quantityCell.value) : null;
  if (quantityCell) evidence.quantity = quantityCell.evidence;

  const unitPriceCell = row.cells['unit_price'];
  const unitPrice = unitPriceCell ? normalizeNumber(unitPriceCell.value) : null;
  if (unitPriceCell) evidence.unit_price_source = unitPriceCell.evidence;

  const lineTotalCell = row.cells['line_total'];
  const lineTotal = lineTotalCell ? normalizeNumber(lineTotalCell.value) : null;
  if (lineTotalCell) evidence.line_total_source = lineTotalCell.evidence;

  // Detect currency
  let currency: string | null = null;
  if (unitPriceCell?.evidence?.number_format) {
    const currencyResult = normalizeCurrency(unitPriceCell.value);
    currency = currencyResult.currency;
  }

  return {
    row: index,
    source_row_number: row.rowNumber,
    sku,
    gtin,
    product_name: productName,
    quantity: quantity ?? 0,
    unit_price_source: unitPrice,
    line_total_source: lineTotal,
    currency,
    evidence,
    flags: row.flags || []
  };
}

function extractTotals(
  extractedRows: any[],
  columnMappings: any[],
  sheetName: string
): Totals | undefined {
  // Find total rows
  const totalRows = extractedRows.filter(row => row.isTotal);

  if (totalRows.length === 0) {
    return undefined;
  }

  let subtotal: number | null = null;
  let tax: number | null = null;
  let total: number | null = null;
  const evidence: Record<string, EvidenceCell> = {};

  // Look for subtotal, tax, and total in total rows
  for (const row of totalRows) {
    const subtotalCell = row.cells['subtotal'] || row.cells['line_total'];
    const taxCell = row.cells['tax'];
    const totalCell = row.cells['total'] || row.cells['line_total'];

    if (subtotalCell && subtotal === null) {
      subtotal = normalizeNumber(subtotalCell.value);
      if (subtotal !== null) {
        evidence.subtotal_source = subtotalCell.evidence;
      }
    }

    if (taxCell && tax === null) {
      tax = normalizeNumber(taxCell.value);
      if (tax !== null) {
        evidence.tax_total_source = taxCell.evidence;
      }
    }

    if (totalCell && total === null) {
      total = normalizeNumber(totalCell.value);
      if (total !== null) {
        evidence.total_source = totalCell.evidence;
      }
    }
  }

  return {
    subtotal_source: subtotal,
    tax_total_source: tax,
    total_source: total,
    currency: null,
    evidence
  };
}

function createEmptyOrder(
  options: ParserOptions,
  issues: Issue[],
  hasFormulas: boolean,
  config: ParserConfig
): CanonicalSalesOrder {
  return {
    meta: {
      case_id: options.caseId,
      tenant_id: options.tenantId,
      received_at: new Date().toISOString(),
      source_filename: options.filename,
      file_sha256: options.fileSha256,
      parsing: {
        parser_version: options.parserVersion || PARSER_VERSION,
        contains_formulas: hasFormulas,
        sheets_processed: []
      }
    },
    customer: {
      input_name: null,
      resolution_status: 'not_found'
    },
    line_items: [],
    confidence: {
      overall: 0
    },
    issues
  };
}
