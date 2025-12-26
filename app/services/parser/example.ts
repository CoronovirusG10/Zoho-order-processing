/**
 * Example usage of the Excel parser
 */

import { parseExcelFile } from './src';
import * as crypto from 'crypto';
import * as fs from 'fs';

async function example() {
  // Example 1: Parse a file
  const filePath = './test-orders/order1.xlsx';

  // Calculate file hash
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Parse the file
  const result = await parseExcelFile(filePath, {
    caseId: `case-${Date.now()}`,
    filename: 'order1.xlsx',
    fileSha256: hash,
    tenantId: 'tenant-demo',
    parserVersion: '1.0.0'
  });

  // Display results
  console.log('=== PARSER RESULTS ===\n');

  console.log('Meta Information:');
  console.log(`  Case ID: ${result.meta.case_id}`);
  console.log(`  Filename: ${result.meta.source_filename}`);
  console.log(`  Language: ${result.meta.language_hint}`);
  console.log(`  Contains formulas: ${result.meta.parsing?.contains_formulas}`);
  console.log(`  Parser version: ${result.meta.parsing?.parser_version}`);
  console.log();

  console.log('Customer:');
  console.log(`  Name: ${result.customer.input_name || 'NOT FOUND'}`);
  console.log(`  Status: ${result.customer.resolution_status}`);
  if (result.customer.evidence && result.customer.evidence.length > 0) {
    console.log(`  Evidence: ${result.customer.evidence[0].cell} = "${result.customer.evidence[0].raw_value}"`);
  }
  console.log();

  console.log('Schema Inference:');
  console.log(`  Sheet: ${result.schema_inference?.selected_sheet}`);
  console.log(`  Region: ${result.schema_inference?.table_region}`);
  console.log(`  Header row: ${result.schema_inference?.header_row}`);
  console.log(`  Overall confidence: ${(result.confidence.overall * 100).toFixed(1)}%`);
  console.log();

  console.log('Column Mappings:');
  if (result.schema_inference?.column_mappings) {
    for (const mapping of result.schema_inference.column_mappings) {
      console.log(`  ${mapping.canonical_field.padEnd(20)} <- "${mapping.source_header}" (${mapping.source_column}) [${(mapping.confidence * 100).toFixed(0)}%]`);
    }
  }
  console.log();

  console.log(`Line Items (${result.line_items.length}):`)
  for (const item of result.line_items.slice(0, 5)) {
    console.log(`  Row ${item.source_row_number}:`);
    console.log(`    SKU: ${item.sku || 'N/A'}`);
    console.log(`    GTIN: ${item.gtin || 'N/A'}`);
    console.log(`    Product: ${item.product_name || 'N/A'}`);
    console.log(`    Quantity: ${item.quantity}`);
    console.log(`    Unit Price: ${item.unit_price_source !== null ? item.unit_price_source.toFixed(2) : 'N/A'}`);
    console.log(`    Line Total: ${item.line_total_source !== null ? item.line_total_source.toFixed(2) : 'N/A'}`);
    console.log();
  }

  if (result.line_items.length > 5) {
    console.log(`  ... and ${result.line_items.length - 5} more items\n`);
  }

  if (result.totals) {
    console.log('Totals:');
    if (result.totals.subtotal_source !== null) {
      console.log(`  Subtotal: ${result.totals.subtotal_source.toFixed(2)}`);
    }
    if (result.totals.tax_total_source !== null) {
      console.log(`  Tax: ${result.totals.tax_total_source.toFixed(2)}`);
    }
    if (result.totals.total_source !== null) {
      console.log(`  Total: ${result.totals.total_source.toFixed(2)}`);
    }
    console.log();
  }

  console.log(`Issues (${result.issues.length}):`);
  if (result.issues.length === 0) {
    console.log('  No issues found!');
  } else {
    for (const issue of result.issues) {
      const severity = issue.severity.toUpperCase().padEnd(8);
      console.log(`  [${severity}] ${issue.code}: ${issue.message}`);
      if (issue.suggested_user_action) {
        console.log(`              → ${issue.suggested_user_action}`);
      }
    }
  }
  console.log();

  // Export to JSON
  const outputPath = './test-orders/parsed-output.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Full output saved to: ${outputPath}`);
}

// Run example
if (require.main === module) {
  example().catch(console.error);
}

export { example };
