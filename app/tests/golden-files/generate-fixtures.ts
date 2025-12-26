#!/usr/bin/env tsx
/**
 * Generate placeholder Excel fixtures for golden files
 * Run this script to create example .xlsx files
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { ExcelBuilder } from '../utils/excel-builder';

async function generateFixtures() {
  console.log('📝 Generating golden file fixtures...\n');

  const builder = new ExcelBuilder();
  const fixturesDir = join(__dirname, 'fixtures');

  // 1. Simple English
  console.log('Creating: simple-english.xlsx');
  const simpleEnglish = await builder.createSimpleWorkbook({
    headers: ['SKU', 'Description', 'Qty', 'Unit Price', 'Total'],
    rows: [
      ['Customer: ACME Corporation', '', '', '', ''],
      ['', '', '', '', ''],
      ['SKU', 'Description', 'Qty', 'Unit Price', 'Total'],
      ['SKU-001', 'Widget A', 10, 25.50, 255.00],
      ['SKU-002', 'Widget B', 5, 40.00, 200.00],
      ['', '', '', 'Total:', 455.00]
    ]
  });
  await writeFile(join(fixturesDir, 'simple-english.xlsx'), simpleEnglish);

  // 2. Simple Farsi
  console.log('Creating: simple-farsi.xlsx');
  const simpleFarsi = await builder.createFarsiWorkbook();
  await writeFile(join(fixturesDir, 'simple-farsi.xlsx'), simpleFarsi);

  // 3. Mixed Language
  console.log('Creating: mixed-language.xlsx');
  const mixedLanguage = await builder.createSimpleWorkbook({
    headers: ['SKU', 'نام محصول', 'Quantity', 'قیمت', 'Total'],
    rows: [
      ['SKU-001', 'Widget A - محصول الف', 10, 25.50, 255.00],
      ['SKU-002', 'Widget B - محصول ب', 5, 40.00, 200.00]
    ],
    sheetName: 'Orders'
  });
  await writeFile(join(fixturesDir, 'mixed-language.xlsx'), mixedLanguage);

  // 4. With Formulas (should block)
  console.log('Creating: with-formulas.xlsx');
  const withFormulas = await builder.createWorkbookWithFormulas();
  await writeFile(join(fixturesDir, 'with-formulas.xlsx'), withFormulas);

  // 5. Multi-sheet
  console.log('Creating: multi-sheet.xlsx');
  const multiSheet = await builder.createMultiSheetWorkbook([
    {
      name: 'Summary',
      headers: ['Report Date', 'Total Orders'],
      rows: [['2025-12-25', 2]]
    },
    {
      name: 'Orders',
      headers: ['SKU', 'Product', 'Qty', 'Price'],
      rows: [
        ['SKU-001', 'Widget A', 10, 25.50],
        ['SKU-002', 'Widget B', 5, 40.00]
      ]
    },
    {
      name: 'Archive',
      headers: ['SKU', 'Product', 'Qty'],
      rows: [['OLD-001', 'Old Product', 0]]
    }
  ]);
  await writeFile(join(fixturesDir, 'multi-sheet.xlsx'), multiSheet);

  // 6. Merged Cells
  console.log('Creating: merged-cells.xlsx');
  const mergedCells = await builder.createWorkbookWithMergedCells();
  await writeFile(join(fixturesDir, 'merged-cells.xlsx'), mergedCells);

  // 7. Hidden Rows
  console.log('Creating: hidden-rows.xlsx');
  const hiddenRows = await builder.createWorkbookWithHiddenRows();
  await writeFile(join(fixturesDir, 'hidden-rows.xlsx'), hiddenRows);

  // 8. Missing SKU
  console.log('Creating: missing-sku.xlsx');
  const missingSku = await builder.createWorkbookWithMissingColumns();
  await writeFile(join(fixturesDir, 'missing-sku.xlsx'), missingSku);

  // 9. Persian Digits
  console.log('Creating: persian-digits.xlsx');
  const persianDigits = await builder.createPersianDigitsWorkbook();
  await writeFile(join(fixturesDir, 'persian-digits.xlsx'), persianDigits);

  // 10. Title Rows
  console.log('Creating: title-rows.xlsx');
  const titleRows = await builder.createWorkbookWithTitleRows();
  await writeFile(join(fixturesDir, 'title-rows.xlsx'), titleRows);

  // 11. With GTIN
  console.log('Creating: with-gtin.xlsx');
  const withGtin = await builder.createSimpleWorkbook({
    headers: ['SKU', 'GTIN', 'Product', 'Qty', 'Price'],
    rows: [
      ['SKU-001', '5901234123457', 'Widget A', 10, 25.50],
      ['SKU-002', '4006381333931', 'Widget B', 5, 40.00]
    ]
  });
  await writeFile(join(fixturesDir, 'with-gtin.xlsx'), withGtin);

  // 12. Zero Quantity (allowed)
  console.log('Creating: zero-quantity.xlsx');
  const zeroQty = await builder.createSimpleWorkbook({
    headers: ['SKU', 'Product', 'Qty', 'Price', 'Total'],
    rows: [
      ['SKU-001', 'Widget A', 10, 25.50, 255.00],
      ['SKU-002', 'Widget B', 0, 40.00, 0.00],
      ['SKU-003', 'Gadget C', 3, 15.75, 47.25]
    ]
  });
  await writeFile(join(fixturesDir, 'zero-quantity.xlsx'), zeroQty);

  // 13. Arithmetic Mismatch
  console.log('Creating: arithmetic-mismatch.xlsx');
  const arithmeticMismatch = await builder.createSimpleWorkbook({
    headers: ['SKU', 'Product', 'Qty', 'Price', 'Total'],
    rows: [
      ['SKU-001', 'Widget A', 10, 25.50, 255.00],  // Correct
      ['SKU-002', 'Widget B', 5, 40.00, 210.00]    // Wrong (should be 200.00)
    ]
  });
  await writeFile(join(fixturesDir, 'arithmetic-mismatch.xlsx'), arithmeticMismatch);

  // 14. Within Tolerance
  console.log('Creating: within-tolerance.xlsx');
  const withinTolerance = await builder.createSimpleWorkbook({
    headers: ['SKU', 'Product', 'Qty', 'Price', 'Total'],
    rows: [
      ['SKU-001', 'Widget A', 3, 10.33, 31.00],  // Actual: 30.99, within tolerance
      ['SKU-002', 'Widget B', 7, 5.71, 40.00]    // Actual: 39.97, within tolerance
    ]
  });
  await writeFile(join(fixturesDir, 'within-tolerance.xlsx'), withinTolerance);

  console.log('\n✅ Fixture generation complete!');
  console.log(`\nGenerated ${14} fixture files in: ${fixturesDir}`);
  console.log('\nNext steps:');
  console.log('1. Review the generated files');
  console.log('2. Run: npm run test:golden:calibrate');
  console.log('3. Review expected outputs in expected/');
  console.log('4. Commit both fixtures/ and expected/ directories');
}

// Run if executed directly
if (require.main === module) {
  generateFixtures().catch(error => {
    console.error('❌ Failed to generate fixtures:', error);
    process.exit(1);
  });
}

export { generateFixtures };
