/**
 * Tests for header matcher
 */

import { Workbook } from 'exceljs';
import { matchHeaders, getCanonicalFields } from '../src/schema-inference/header-matcher';

describe('HeaderMatcher', () => {
  it('should match exact English headers', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    // Add headers
    worksheet.getCell('A1').value = 'SKU';
    worksheet.getCell('B1').value = 'Product Name';
    worksheet.getCell('C1').value = 'Quantity';
    worksheet.getCell('D1').value = 'Unit Price';

    const fields = ['sku', 'product_name', 'quantity', 'unit_price'];
    const mappings = matchHeaders(worksheet, 1, fields);

    expect(mappings).toHaveLength(4);
    expect(mappings.find(m => m.canonical_field === 'sku')?.source_header).toBe('SKU');
    expect(mappings.find(m => m.canonical_field === 'product_name')?.source_header).toBe('Product Name');
    expect(mappings.find(m => m.canonical_field === 'quantity')?.source_header).toBe('Quantity');
  });

  it('should match Farsi headers', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    // Add Farsi headers
    worksheet.getCell('A1').value = 'کد کالا';
    worksheet.getCell('B1').value = 'نام محصول';
    worksheet.getCell('C1').value = 'تعداد';
    worksheet.getCell('D1').value = 'قیمت';

    const fields = ['sku', 'product_name', 'quantity', 'unit_price'];
    const mappings = matchHeaders(worksheet, 1, fields);

    expect(mappings).toHaveLength(4);
    expect(mappings.find(m => m.canonical_field === 'sku')?.confidence).toBeGreaterThan(0.8);
    expect(mappings.find(m => m.canonical_field === 'quantity')?.confidence).toBeGreaterThan(0.8);
  });

  it('should handle fuzzy matches', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    worksheet.getCell('A1').value = 'Item Code';
    worksheet.getCell('B1').value = 'Description';
    worksheet.getCell('C1').value = 'Qty';

    const fields = ['sku', 'product_name', 'quantity'];
    const mappings = matchHeaders(worksheet, 1, fields);

    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings.find(m => m.canonical_field === 'sku')).toBeDefined();
    expect(mappings.find(m => m.canonical_field === 'product_name')).toBeDefined();
    expect(mappings.find(m => m.canonical_field === 'quantity')).toBeDefined();
  });

  it('should provide candidates for ambiguous matches', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    worksheet.getCell('A1').value = 'Code';
    worksheet.getCell('B1').value = 'Item Number';

    const fields = ['sku'];
    const mappings = matchHeaders(worksheet, 1, fields);

    expect(mappings.length).toBeGreaterThan(0);
    const skuMapping = mappings.find(m => m.canonical_field === 'sku');
    expect(skuMapping?.candidates).toBeDefined();
  });
});
