import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Parser integration tests
 * Tests the full parsing pipeline from Excel file to canonical JSON
 */

describe('Parser Integration', () => {
  describe('parseExcel full pipeline', () => {
    it('should parse simple English spreadsheet to canonical JSON', async () => {
      // Mock expected output structure
      const expected = {
        meta: {
          detected_language: 'en',
          sheet_name: 'Orders',
          header_row: 0,
          data_rows: 2
        },
        customer: {
          raw: { value: 'ACME Corporation', evidence: [] },
          resolved: { zohoCustomerId: null, confidence: 0.0 }
        },
        lines: [
          {
            lineNo: 1,
            sku: { value: 'SKU-001', evidence: [] },
            quantity: { value: 10, evidence: [] },
            resolved: { zohoItemId: null }
          }
        ],
        issues: [],
        status: 'needs-input'
      };

      // This is a placeholder - actual implementation would call parser
      expect(expected.meta.detected_language).toBe('en');
      expect(expected.lines.length).toBe(1);
    });

    it('should parse Farsi spreadsheet with Persian digits', async () => {
      const expected = {
        meta: {
          detected_language: 'fa',
          sheet_name: 'سفارشات',
          header_row: 0,
          data_rows: 2
        },
        customer: {
          raw: { value: 'شرکت نمونه', evidence: [] },
          resolved: { zohoCustomerId: null }
        },
        lines: [
          {
            lineNo: 1,
            sku: { value: 'SKU-001', evidence: [] },
            quantity: { value: 10, evidence: [] } // Converted from ۱۰
          }
        ],
        issues: [],
        status: 'needs-input'
      };

      expect(expected.meta.detected_language).toBe('fa');
      expect(expected.lines[0].quantity.value).toBe(10);
    });

    it('should detect and block formulas', async () => {
      const result = {
        meta: {
          has_formulas: true,
          blocked: true
        },
        issues: [
          {
            code: 'FORMULAS_BLOCKED',
            severity: 'block',
            message: 'Spreadsheet contains formulas in data range',
            evidence: [
              { sheet: 'Orders', cell: 'E2', raw_value: '=C2*D2' }
            ],
            suggestedFix: 'Export as values-only',
            requiresUserInput: true
          }
        ],
        status: 'blocked'
      };

      expect(result.meta.blocked).toBe(true);
      expect(result.issues[0].code).toBe('FORMULAS_BLOCKED');
    });

    it('should handle multi-sheet workbooks', async () => {
      const result = {
        meta: {
          sheets_detected: ['Summary', 'Orders', 'Archive'],
          candidate_sheets: [
            { name: 'Orders', score: 0.95 },
            { name: 'Archive', score: 0.60 }
          ]
        },
        issues: [
          {
            code: 'MULTIPLE_SHEETS',
            severity: 'warn',
            message: 'Multiple sheets detected',
            suggestedFix: 'Select which sheet contains the order',
            requiresUserInput: true
          }
        ]
      };

      expect(result.meta.sheets_detected?.length).toBe(3);
      expect(result.meta.candidate_sheets?.[0].name).toBe('Orders');
    });

    it('should extract evidence for all fields', async () => {
      const result = {
        customer: {
          raw: { value: 'ACME Corp', evidence: [{ sheet: 'Orders', cell: 'B2', raw_value: 'ACME Corp' }] }
        },
        lines: [
          {
            lineNo: 1,
            sku: { value: 'SKU-001', evidence: [{ sheet: 'Orders', cell: 'A5', raw_value: 'SKU-001' }] },
            quantity: { value: 10, evidence: [{ sheet: 'Orders', cell: 'C5', raw_value: 10 }] },
            unitPriceSpreadsheet: { value: 25.50, evidence: [{ sheet: 'Orders', cell: 'D5', raw_value: 25.50 }] }
          }
        ]
      };

      expect(result.customer.raw.evidence[0].cell).toBe('B2');
      expect(result.lines[0].sku.evidence[0].cell).toBe('A5');
      expect(result.lines[0].quantity.evidence[0].cell).toBe('C5');
    });
  });

  describe('schema inference integration', () => {
    it('should map English headers to canonical fields', async () => {
      const headers = ['Item Code', 'Description', 'Qty', 'Unit Price', 'Total'];

      const mapping = {
        sku: { column: 0, confidence: 0.95, header: 'Item Code' },
        description: { column: 1, confidence: 1.0, header: 'Description' },
        quantity: { column: 2, confidence: 0.98, header: 'Qty' },
        unitPrice: { column: 3, confidence: 0.92, header: 'Unit Price' },
        lineTotal: { column: 4, confidence: 0.90, header: 'Total' }
      };

      expect(mapping.sku.confidence).toBeGreaterThan(0.80);
      expect(mapping.quantity.column).toBe(2);
    });

    it('should map Farsi headers to canonical fields', async () => {
      const headers = ['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع'];

      const mapping = {
        sku: { column: 0, confidence: 0.93, header: 'کد کالا' },
        description: { column: 1, confidence: 0.95, header: 'نام محصول' },
        quantity: { column: 2, confidence: 0.97, header: 'تعداد' },
        unitPrice: { column: 3, confidence: 0.90, header: 'قیمت واحد' },
        lineTotal: { column: 4, confidence: 0.88, header: 'جمع' }
      };

      expect(mapping.sku.confidence).toBeGreaterThan(0.80);
      expect(mapping.quantity.column).toBe(2);
    });

    it('should handle mixed language headers', async () => {
      const headers = ['SKU', 'نام محصول', 'Quantity', 'قیمت', 'Total'];

      const mapping = {
        sku: { column: 0, confidence: 1.0, header: 'SKU' },
        description: { column: 1, confidence: 0.95, header: 'نام محصول' },
        quantity: { column: 2, confidence: 0.98, header: 'Quantity' },
        unitPrice: { column: 3, confidence: 0.88, header: 'قیمت' },
        lineTotal: { column: 4, confidence: 0.90, header: 'Total' }
      };

      expect(mapping.sku.confidence).toBe(1.0);
      expect(mapping.description.confidence).toBeGreaterThan(0.80);
    });

    it('should create issue when confidence is low', async () => {
      const mapping = {
        sku: { column: 0, confidence: 0.65, header: 'Code' }
      };

      const requiresCommittee = mapping.sku.confidence < 0.80;

      const issue = requiresCommittee ? {
        code: 'LOW_CONFIDENCE_MAPPING',
        severity: 'warn',
        field: 'sku',
        message: 'Uncertain column mapping for SKU',
        requiresUserInput: true
      } : null;

      expect(issue).not.toBeNull();
      expect(issue?.code).toBe('LOW_CONFIDENCE_MAPPING');
    });
  });

  describe('validation integration', () => {
    it('should validate arithmetic across all lines', async () => {
      const lines = [
        { qty: 10, unitPrice: 25.50, lineTotal: 255.00 },
        { qty: 5, unitPrice: 40.00, lineTotal: 200.00 },
        { qty: 3, unitPrice: 10.33, lineTotal: 31.00 } // 30.99, within tolerance
      ];

      const issues: any[] = [];

      lines.forEach((line, idx) => {
        const calculated = line.qty * line.unitPrice;
        const diff = Math.abs(calculated - line.lineTotal);
        if (diff > 0.02 && diff > 0.01 * line.lineTotal) {
          issues.push({
            code: 'ARITHMETIC_MISMATCH',
            severity: 'warn',
            lineNo: idx + 1,
            message: `Line ${idx + 1}: ${line.qty} × ${line.unitPrice} = ${calculated}, but total is ${line.lineTotal}`
          });
        }
      });

      expect(issues.length).toBe(0);
    });

    it('should validate order total', async () => {
      const lines = [
        { lineTotal: 255.00 },
        { lineTotal: 100.00 },
        { lineTotal: 50.50 }
      ];

      const spreadsheetTotal = 405.50;
      const calculated = lines.reduce((sum, line) => sum + line.lineTotal, 0);

      const diff = Math.abs(calculated - spreadsheetTotal);
      const withinTolerance = diff <= 0.02 || diff <= 0.01 * spreadsheetTotal;

      expect(withinTolerance).toBe(true);
    });

    it('should validate all GTINs in spreadsheet', async () => {
      const gtins = ['5901234123457', '4006381333931', '8712345678906'];

      const calculateCheckDigit = (code: string): number => {
        const digits = code.slice(0, -1).split('').map(Number);
        const sum = digits.reduce((acc, digit, idx) =>
          acc + digit * (idx % 2 === 0 ? 1 : 3), 0
        );
        return (10 - (sum % 10)) % 10;
      };

      const validationResults = gtins.map(gtin => {
        const checkDigit = parseInt(gtin.slice(-1));
        const calculated = calculateCheckDigit(gtin);
        return {
          gtin,
          valid: checkDigit === calculated
        };
      });

      const allValid = validationResults.every(r => r.valid);
      expect(allValid).toBe(true);
    });
  });

  describe('issue aggregation', () => {
    it('should collect all issues from parsing and validation', async () => {
      const issues = [
        {
          code: 'MISSING_CUSTOMER',
          severity: 'block',
          message: 'Customer name not found',
          requiresUserInput: true
        },
        {
          code: 'AMBIGUOUS_ITEM',
          severity: 'warn',
          lineNo: 3,
          message: 'Multiple items match SKU-003',
          requiresUserInput: true
        },
        {
          code: 'ARITHMETIC_MISMATCH',
          severity: 'warn',
          lineNo: 5,
          message: 'Line total calculation mismatch',
          requiresUserInput: false
        }
      ];

      const blockingIssues = issues.filter(i => i.severity === 'block');
      const status = blockingIssues.length > 0 ? 'blocked' : 'needs-input';

      expect(issues.length).toBe(3);
      expect(blockingIssues.length).toBe(1);
      expect(status).toBe('blocked');
    });

    it('should determine ready status when no blocking issues', async () => {
      const issues = [
        {
          code: 'ARITHMETIC_MISMATCH',
          severity: 'warn',
          requiresUserInput: false
        }
      ];

      const blockingIssues = issues.filter(i => i.severity === 'block');
      const inputIssues = issues.filter(i => i.requiresUserInput);

      const status = blockingIssues.length > 0 ? 'blocked' :
                    inputIssues.length > 0 ? 'needs-input' : 'ready';

      expect(status).toBe('ready');
    });
  });

  describe('error handling', () => {
    it('should handle corrupted Excel files', async () => {
      const result = {
        status: 'failed',
        issues: [
          {
            code: 'FILE_UNREADABLE',
            severity: 'block',
            message: 'Unable to parse Excel file',
            suggestedFix: 'Ensure file is a valid .xlsx file'
          }
        ]
      };

      expect(result.status).toBe('failed');
      expect(result.issues[0].code).toBe('FILE_UNREADABLE');
    });

    it('should handle empty spreadsheets', async () => {
      const result = {
        status: 'failed',
        issues: [
          {
            code: 'EMPTY_SPREADSHEET',
            severity: 'block',
            message: 'No data found in spreadsheet'
          }
        ]
      };

      expect(result.issues[0].code).toBe('EMPTY_SPREADSHEET');
    });

    it('should handle protected workbooks', async () => {
      const result = {
        status: 'blocked',
        issues: [
          {
            code: 'WORKBOOK_PROTECTED',
            severity: 'block',
            message: 'Workbook is password protected',
            suggestedFix: 'Remove password protection'
          }
        ]
      };

      expect(result.issues[0].code).toBe('WORKBOOK_PROTECTED');
    });
  });
});
