/**
 * Excel workbook builder for tests
 * Creates Excel files programmatically for testing
 */

import ExcelJS from 'exceljs';

export interface ExcelBuilderOptions {
  headers: string[];
  rows: any[][];
  sheetName?: string;
  includeFormulas?: boolean;
  formulaColumns?: number[];
  mergedCells?: string[];
  hiddenRows?: number[];
  hiddenColumns?: number[];
  numberFormats?: Record<number, string>;
}

export class ExcelBuilder {
  private workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'Test Suite';
    this.workbook.created = new Date();
  }

  /**
   * Create a simple spreadsheet
   */
  async createSimpleWorkbook(options: ExcelBuilderOptions): Promise<Buffer> {
    const {
      headers,
      rows,
      sheetName = 'Orders',
      includeFormulas = false,
      formulaColumns = [],
      mergedCells = [],
      hiddenRows = [],
      hiddenColumns = [],
      numberFormats = {}
    } = options;

    const worksheet = this.workbook.addWorksheet(sheetName);

    // Add headers
    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add data rows
    rows.forEach((row, rowIdx) => {
      const excelRow = worksheet.addRow(row);

      // Apply number formats
      Object.entries(numberFormats).forEach(([colIdx, format]) => {
        const cell = excelRow.getCell(parseInt(colIdx) + 1);
        cell.numFmt = format;
      });

      // Add formulas if requested
      if (includeFormulas && formulaColumns.length > 0) {
        formulaColumns.forEach(colIdx => {
          const cell = excelRow.getCell(colIdx + 1);
          // Example formula: line total = qty * price
          if (colIdx === 5) { // Assuming column F is line total
            cell.value = { formula: `C${rowIdx + 2}*D${rowIdx + 2}` };
          }
        });
      }
    });

    // Merge cells
    mergedCells.forEach(range => {
      worksheet.mergeCells(range);
    });

    // Hide rows
    hiddenRows.forEach(rowIdx => {
      const row = worksheet.getRow(rowIdx);
      row.hidden = true;
    });

    // Hide columns
    hiddenColumns.forEach(colIdx => {
      const column = worksheet.getColumn(colIdx);
      column.hidden = true;
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (!column.hidden) {
        column.width = 15;
      }
    });

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create multi-sheet workbook
   */
  async createMultiSheetWorkbook(sheets: Array<{
    name: string;
    headers: string[];
    rows: any[][];
  }>): Promise<Buffer> {
    sheets.forEach(({ name, headers, rows }) => {
      const worksheet = this.workbook.addWorksheet(name);
      worksheet.addRow(headers);
      rows.forEach(row => worksheet.addRow(row));
    });

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with formulas (for blocking tests)
   */
  async createWorkbookWithFormulas(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('Orders');

    worksheet.addRow(['SKU', 'Product', 'Qty', 'Price', 'Total']);

    // Add rows with formulas in Total column
    for (let i = 0; i < 5; i++) {
      const row = worksheet.addRow([
        `SKU-00${i + 1}`,
        `Product ${i + 1}`,
        10,
        25.50,
        null
      ]);

      // Set formula for total
      const totalCell = row.getCell(5);
      totalCell.value = { formula: `C${i + 2}*D${i + 2}` };
    }

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with merged cells
   */
  async createWorkbookWithMergedCells(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('Orders');

    // Merged header cells
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').value = 'Product Information';

    worksheet.mergeCells('C1:D1');
    worksheet.getCell('C1').value = 'Pricing';

    // Sub-headers
    worksheet.addRow(['SKU', 'Description', 'Unit Price', 'Total']);

    // Data
    worksheet.addRow(['SKU-001', 'Widget A', 25.50, 255.00]);
    worksheet.addRow(['SKU-002', 'Widget B', 40.00, 200.00]);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with Farsi headers
   */
  async createFarsiWorkbook(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('سفارشات');

    const farsiHeaders = ['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع'];
    worksheet.addRow(farsiHeaders);

    worksheet.addRow(['SKU-001', 'محصول الف', 10, 25.50, 255.00]);
    worksheet.addRow(['SKU-002', 'محصول ب', 5, 40.00, 200.00]);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with Persian digits
   */
  async createPersianDigitsWorkbook(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('سفارشات');

    worksheet.addRow(['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع']);

    // Note: Persian digits should be stored as text for proper display
    worksheet.addRow(['SKU-001', 'محصول الف', '۱۰', '۲۵.۵۰', '۲۵۵.۰۰']);
    worksheet.addRow(['SKU-002', 'محصول ب', '۵', '۴۰.۰۰', '۲۰۰.۰۰']);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create empty workbook (for error testing)
   */
  async createEmptyWorkbook(): Promise<Buffer> {
    this.workbook.addWorksheet('Empty Sheet');
    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with missing columns
   */
  async createWorkbookWithMissingColumns(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('Orders');

    // Only SKU and Quantity, missing other required fields
    worksheet.addRow(['SKU', 'Qty']);
    worksheet.addRow(['SKU-001', 10]);
    worksheet.addRow(['SKU-002', 5]);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with hidden rows
   */
  async createWorkbookWithHiddenRows(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('Orders');

    worksheet.addRow(['SKU', 'Product', 'Qty', 'Price', 'Total']);

    worksheet.addRow(['SKU-001', 'Widget A', 10, 25.50, 255.00]);

    const hiddenRow = worksheet.addRow(['SKU-002', 'Widget B', 5, 40.00, 200.00]);
    hiddenRow.hidden = true;

    worksheet.addRow(['SKU-003', 'Gadget C', 3, 15.75, 47.25]);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Create workbook with title rows before data
   */
  async createWorkbookWithTitleRows(): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet('Orders');

    worksheet.addRow(['ACME Corporation']);
    worksheet.getRow(1).font = { bold: true, size: 16 };

    worksheet.addRow(['Sales Order - December 2025']);
    worksheet.addRow(['']); // Empty row

    worksheet.addRow(['SKU', 'Product', 'Qty', 'Price', 'Total']);

    worksheet.addRow(['SKU-001', 'Widget A', 10, 25.50, 255.00]);
    worksheet.addRow(['SKU-002', 'Widget B', 5, 40.00, 200.00]);

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }
}

/**
 * Quick helper to create simple test Excel file
 */
export async function createTestWorkbook(
  headers: string[],
  rows: any[][],
  options: Partial<ExcelBuilderOptions> = {}
): Promise<Buffer> {
  const builder = new ExcelBuilder();
  return builder.createSimpleWorkbook({
    headers,
    rows,
    ...options
  });
}

/**
 * Save buffer to file (for debugging)
 */
export async function saveBufferToFile(buffer: Buffer, filePath: string): Promise<void> {
  const fs = await import('fs/promises');
  await fs.writeFile(filePath, buffer);
}
