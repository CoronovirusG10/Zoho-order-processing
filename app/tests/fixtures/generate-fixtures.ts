#!/usr/bin/env tsx
/**
 * Generate Excel fixture files for integration tests
 *
 * Creates sample .xlsx files for testing:
 * - simple-order.xlsx
 * - multi-line-order.xlsx
 * - order-with-formulas.xlsx (should be blocked)
 * - farsi-headers.xlsx
 *
 * Run with: npx tsx tests/fixtures/generate-fixtures.ts
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FixtureConfig {
  name: string;
  description: string;
  generate: () => Promise<Buffer>;
}

/**
 * Create simple English order fixture
 */
async function generateSimpleOrder(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Orders');

  // Title row
  worksheet.addRow(['Order Form - ACME Corporation']);
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // Empty row
  worksheet.addRow([]);

  // Customer info
  worksheet.addRow(['Customer:', 'ACME Corporation', '', '', '']);
  worksheet.addRow(['Date:', '2025-12-25', '', '', '']);

  // Empty row
  worksheet.addRow([]);

  // Headers
  const headerRow = worksheet.addRow(['SKU', 'Description', 'Qty', 'Unit Price', 'Total']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  // Data rows
  worksheet.addRow(['SKU-001', 'Widget A - Standard Model', 10, 25.50, 255.00]);
  worksheet.addRow(['SKU-002', 'Widget B - Premium Model', 5, 40.00, 200.00]);

  // Empty row
  worksheet.addRow([]);

  // Total row
  const totalRow = worksheet.addRow(['', '', '', 'Grand Total:', 455.00]);
  totalRow.font = { bold: true };

  // Format currency columns
  worksheet.getColumn(4).numFmt = '$#,##0.00';
  worksheet.getColumn(5).numFmt = '$#,##0.00';

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Create multi-line order with GTIN fixture
 */
async function generateMultiLineOrder(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Order');

  // Title
  worksheet.addRow(['Purchase Order - TechCorp Industries']);
  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').font = { bold: true, size: 14 };

  worksheet.addRow(['PO Number:', 'PO-2025-1234', '', '', '', '']);
  worksheet.addRow(['Date:', '2025-12-26', '', '', '', '']);
  worksheet.addRow([]);

  // Headers with GTIN
  const headerRow = worksheet.addRow([
    'SKU',
    'GTIN',
    'Product Name',
    'Qty',
    'Unit Price',
    'Line Total',
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.font.color = { argb: 'FFFFFFFF' };

  // Data rows with valid GTIN-13
  const items = [
    ['SKU-001', '5901234123457', 'Widget A - Standard Model', 10, 25.50, 255.00],
    ['SKU-002', '4006381333931', 'Widget B - Premium Model', 5, 40.00, 200.00],
    ['SKU-003', '8712345678906', 'Gadget C - Multi-purpose', 3, 15.75, 47.25],
    ['SKU-004', '0012345678905', 'Component D - Electronic', 20, 5.25, 105.00],
  ];

  items.forEach(item => worksheet.addRow(item));

  worksheet.addRow([]);

  // Subtotal, Tax, Total
  worksheet.addRow(['', '', '', '', 'Subtotal:', 607.25]);
  worksheet.addRow(['', '', '', '', 'Tax (10%):', 60.73]);
  worksheet.addRow(['', '', '', '', 'Grand Total:', 667.98]);

  // Format columns
  worksheet.getColumn(5).numFmt = '$#,##0.00';
  worksheet.getColumn(6).numFmt = '$#,##0.00';

  worksheet.columns.forEach(column => {
    column.width = 22;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Create order with formulas (should be blocked)
 */
async function generateOrderWithFormulas(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Orders');

  // Headers
  const headerRow = worksheet.addRow(['SKU', 'Product', 'Qty', 'Price', 'Total']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC107' },
  };

  // Data rows with formulas in Total column
  const items = [
    { sku: 'SKU-001', product: 'Widget A', qty: 10, price: 25.50 },
    { sku: 'SKU-002', product: 'Widget B', qty: 5, price: 40.00 },
    { sku: 'SKU-003', product: 'Gadget C', qty: 3, price: 15.75 },
    { sku: 'SKU-004', product: 'Component D', qty: 20, price: 5.25 },
    { sku: 'SKU-005', product: 'Part E', qty: 15, price: 8.00 },
  ];

  items.forEach((item, idx) => {
    const rowNum = idx + 2;
    const row = worksheet.addRow([item.sku, item.product, item.qty, item.price, null]);

    // Set formula for total (E = C * D)
    const totalCell = row.getCell(5);
    totalCell.value = { formula: `C${rowNum}*D${rowNum}` };
  });

  // Grand total with SUM formula
  worksheet.addRow([]);
  const totalRow = worksheet.addRow(['', '', '', 'Total:', null]);
  const grandTotalCell = totalRow.getCell(5);
  grandTotalCell.value = { formula: 'SUM(E2:E6)' };
  grandTotalCell.font = { bold: true };

  // Format columns
  worksheet.getColumn(4).numFmt = '$#,##0.00';
  worksheet.getColumn(5).numFmt = '$#,##0.00';

  worksheet.columns.forEach(column => {
    column.width = 18;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Create order with Farsi headers
 */
async function generateFarsiHeaders(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('سفارشات'); // Orders in Farsi

  // Title in Farsi
  worksheet.addRow(['فرم سفارش - شرکت نمونه']); // Order Form - Sample Company
  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'right', readingOrder: 'rtl' as 'rtl' };

  worksheet.addRow([]);

  // Customer info in Farsi
  worksheet.addRow(['مشتری:', 'شرکت نمونه', '', '', '']); // Customer: Sample Company
  worksheet.addRow(['تاریخ:', '1404/10/05', '', '', '']); // Date in Persian calendar

  worksheet.addRow([]);

  // Headers in Farsi
  const headers = ['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع'];
  // SKU, Product Name, Quantity, Unit Price, Total
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2E7D32' },
  };
  headerRow.font.color = { argb: 'FFFFFFFF' };
  headerRow.alignment = { horizontal: 'right', readingOrder: 'rtl' as 'rtl' };

  // Data rows (mix of SKU codes and Farsi product names)
  const items = [
    ['SKU-001', 'محصول الف - مدل استاندارد', 10, 25.50, 255.00], // Product A - Standard Model
    ['SKU-002', 'محصول ب - مدل ویژه', 5, 40.00, 200.00], // Product B - Special Model
    ['SKU-003', 'محصول ج - چند منظوره', 3, 15.75, 47.25], // Product C - Multi-purpose
  ];

  items.forEach(item => {
    const row = worksheet.addRow(item);
    row.alignment = { horizontal: 'right', readingOrder: 'rtl' as 'rtl' };
  });

  worksheet.addRow([]);

  // Total in Farsi
  const totalRow = worksheet.addRow(['', '', '', 'جمع کل:', 502.25]); // Grand Total
  totalRow.font = { bold: true };
  totalRow.alignment = { horizontal: 'right', readingOrder: 'rtl' as 'rtl' };

  // Set RTL for worksheet
  worksheet.views = [{ rightToLeft: true }];

  worksheet.columns.forEach(column => {
    column.width = 22;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Create order with Persian digits
 */
async function generatePersianDigits(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('سفارشات');

  // Headers in Farsi
  worksheet.addRow(['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع']);
  worksheet.getRow(1).font = { bold: true };

  // Data with Persian numerals (stored as text)
  // Persian digits: ۰۱۲۳۴۵۶۷۸۹
  worksheet.addRow(['SKU-001', 'محصول الف', '۱۰', '۲۵.۵۰', '۲۵۵.۰۰']);
  worksheet.addRow(['SKU-002', 'محصول ب', '۵', '۴۰.۰۰', '۲۰۰.۰۰']);
  worksheet.addRow(['SKU-003', 'محصول ج', '۳', '۱۵.۷۵', '۴۷.۲۵']);

  worksheet.views = [{ rightToLeft: true }];

  worksheet.columns.forEach(column => {
    column.width = 18;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Create order with mixed language headers
 */
async function generateMixedLanguage(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Test Fixtures Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Orders');

  // Mixed language headers
  const headers = ['SKU', 'نام محصول', 'Quantity', 'قیمت', 'Total'];
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6A1B9A' },
  };
  headerRow.font.color = { argb: 'FFFFFFFF' };

  // Data
  worksheet.addRow(['SKU-001', 'Widget A - محصول الف', 10, 25.50, 255.00]);
  worksheet.addRow(['SKU-002', 'Widget B - محصول ب', 5, 40.00, 200.00]);

  worksheet.columns.forEach(column => {
    column.width = 25;
  });

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

// Define all fixtures
const fixtures: FixtureConfig[] = [
  {
    name: 'simple-order.xlsx',
    description: 'Simple English order with 2 line items',
    generate: generateSimpleOrder,
  },
  {
    name: 'multi-line-order.xlsx',
    description: 'Multi-line order with GTIN codes',
    generate: generateMultiLineOrder,
  },
  {
    name: 'order-with-formulas.xlsx',
    description: 'Order with Excel formulas (should be blocked)',
    generate: generateOrderWithFormulas,
  },
  {
    name: 'farsi-headers.xlsx',
    description: 'Order with Farsi/Persian headers',
    generate: generateFarsiHeaders,
  },
  {
    name: 'persian-digits.xlsx',
    description: 'Order with Persian digits in quantity and price',
    generate: generatePersianDigits,
  },
  {
    name: 'mixed-language.xlsx',
    description: 'Order with mixed English/Farsi headers',
    generate: generateMixedLanguage,
  },
];

/**
 * Main generator function
 */
async function generateAllFixtures(): Promise<void> {
  console.log('Generating Excel fixtures for integration tests...\n');

  const fixturesDir = __dirname;

  for (const fixture of fixtures) {
    try {
      console.log(`Creating: ${fixture.name}`);
      console.log(`  Description: ${fixture.description}`);

      const buffer = await fixture.generate();
      const filePath = join(fixturesDir, fixture.name);

      await writeFile(filePath, buffer);

      console.log(`  Size: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`  Path: ${filePath}`);
      console.log('');
    } catch (error) {
      console.error(`Failed to generate ${fixture.name}:`, error);
    }
  }

  console.log(`Generated ${fixtures.length} fixture files successfully.`);
  console.log('\nRun integration tests with: npm run test:integration');
}

// Run if executed directly
const isMainModule = process.argv[1]?.includes('generate-fixtures');
if (isMainModule) {
  generateAllFixtures().catch(error => {
    console.error('Failed to generate fixtures:', error);
    process.exit(1);
  });
}

export {
  generateAllFixtures,
  generateSimpleOrder,
  generateMultiLineOrder,
  generateOrderWithFormulas,
  generateFarsiHeaders,
  generatePersianDigits,
  generateMixedLanguage,
  fixtures,
};
