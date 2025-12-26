/**
 * Tests for formula detector
 */

import { Workbook } from 'exceljs';
import { detectFormulas } from '../src/formula-detector';

describe('FormulaDetector', () => {
  it('should detect formulas in cells', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    // Add some data
    worksheet.getCell('A1').value = 'Item';
    worksheet.getCell('B1').value = 'Quantity';
    worksheet.getCell('C1').value = 'Total';

    worksheet.getCell('A2').value = 'Item 1';
    worksheet.getCell('B2').value = 10;
    worksheet.getCell('C2').value = { formula: 'B2*100' };

    const report = detectFormulas(workbook);

    expect(report.hasFormulas).toBe(true);
    expect(report.severity).toBe('blocker');
    expect(report.formulaCells).toHaveLength(1);
    expect(report.formulaCells[0].cell).toBe('C2');
  });

  it('should not detect formulas in value-only cells', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    worksheet.getCell('A1').value = 'Item';
    worksheet.getCell('B1').value = 'Quantity';
    worksheet.getCell('C1').value = 'Total';

    worksheet.getCell('A2').value = 'Item 1';
    worksheet.getCell('B2').value = 10;
    worksheet.getCell('C2').value = 1000;

    const report = detectFormulas(workbook);

    expect(report.hasFormulas).toBe(false);
    expect(report.formulaCells).toHaveLength(0);
  });

  it('should detect string formulas starting with =', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Test');

    worksheet.getCell('A1').value = '=SUM(B1:B10)';

    const report = detectFormulas(workbook);

    expect(report.hasFormulas).toBe(true);
    expect(report.formulaCells).toHaveLength(1);
  });
});
