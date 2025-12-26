/**
 * Sample order data for testing
 */

export const simpleEnglishOrder = {
  customer: 'ACME Corporation',
  lines: [
    { sku: 'SKU-001', description: 'Widget A', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 },
    { sku: 'SKU-002', description: 'Widget B', quantity: 5, unitPrice: 40.00, lineTotal: 200.00 }
  ],
  total: 455.00
};

export const simpleFarsiOrder = {
  customer: 'شرکت نمونه',
  lines: [
    { sku: 'SKU-001', description: 'محصول الف', quantity: 15, unitPrice: 25.50, lineTotal: 382.50 },
    { sku: 'SKU-002', description: 'محصول ب', quantity: 8, unitPrice: 40.00, lineTotal: 320.00 }
  ],
  total: 702.50
};

export const mixedLanguageOrder = {
  customer: 'ACME Corporation',
  lines: [
    { sku: 'SKU-001', description: 'Widget A - محصول الف', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 },
    { sku: 'SKU-002', description: 'Widget B - محصول ب', quantity: 5, unitPrice: 40.00, lineTotal: 200.00 }
  ],
  total: 455.00
};

export const orderWithGtin = {
  customer: 'TechCorp Industries',
  lines: [
    { sku: 'SKU-001', gtin: '5901234123457', description: 'Widget A', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 },
    { sku: 'SKU-002', gtin: '4006381333931', description: 'Widget B', quantity: 5, unitPrice: 40.00, lineTotal: 200.00 }
  ],
  total: 455.00
};

export const orderWithZeroQuantity = {
  customer: 'ACME Corporation',
  lines: [
    { sku: 'SKU-001', description: 'Widget A', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 },
    { sku: 'SKU-002', description: 'Widget B', quantity: 0, unitPrice: 40.00, lineTotal: 0.00 },
    { sku: 'SKU-003', description: 'Gadget C', quantity: 3, unitPrice: 15.75, lineTotal: 47.25 }
  ],
  total: 302.25
};

export const orderWithArithmeticIssue = {
  customer: 'ACME Corporation',
  lines: [
    { sku: 'SKU-001', description: 'Widget A', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 }, // Correct
    { sku: 'SKU-002', description: 'Widget B', quantity: 5, unitPrice: 40.00, lineTotal: 210.00 }  // Wrong (should be 200.00)
  ],
  total: 465.00 // Total also wrong
};

export const orderWithMissingFields = {
  customer: '', // Missing customer
  lines: [
    { sku: '', description: 'Widget A', quantity: 10, unitPrice: 25.50, lineTotal: 255.00 }, // Missing SKU
    { sku: 'SKU-002', description: 'Widget B', quantity: null, unitPrice: 40.00, lineTotal: 200.00 } // Missing quantity
  ],
  total: 455.00
};

export const orderWithPersianDigits = {
  customer: 'شرکت نمونه',
  lines: [
    { sku: 'SKU-001', description: 'محصول الف', quantity: '۱۵', unitPrice: '۲۵.۵۰', lineTotal: '۳۸۲.۵۰' },
    { sku: 'SKU-002', description: 'محصول ب', quantity: '۸', unitPrice: '۴۰.۰۰', lineTotal: '۳۲۰.۰۰' }
  ],
  total: '۷۰۲.۵۰'
};

export const largeOrder = {
  customer: 'TechCorp Industries',
  lines: Array.from({ length: 50 }, (_, i) => ({
    sku: `SKU-${String(i + 1).padStart(3, '0')}`,
    description: `Product ${i + 1}`,
    quantity: Math.floor(Math.random() * 20) + 1,
    unitPrice: Math.round((Math.random() * 100 + 10) * 100) / 100,
    lineTotal: 0 // Will be calculated
  })).map(line => ({
    ...line,
    lineTotal: line.quantity * line.unitPrice
  })),
  get total() {
    return this.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  }
};

export const canonicalJsonExample = {
  caseId: 'case-001',
  source: {
    teams: {
      tenantId: 'tenant-b',
      userAadId: 'user-123',
      chatId: 'conv-123',
      messageId: 'msg-123'
    },
    file: {
      blobUri: 'blob://orders-incoming/case-001/original.xlsx',
      sha256: 'abc123def456',
      originalFileName: 'order-2025-12-25.xlsx'
    }
  },
  meta: {
    detected_language: 'en',
    sheet_name: 'Orders',
    header_row: 0,
    data_rows: 2,
    received_at: '2025-12-25T10:30:00Z',
    correlation: 'corr-001'
  },
  customer: {
    raw: {
      value: 'ACME Corporation',
      evidence: [{ sheet: 'Orders', cell: 'B2', raw_value: 'ACME Corporation' }]
    },
    resolved: {
      zohoCustomerId: 'cust_001',
      zohoDisplayName: 'ACME Corporation',
      match: 'exact',
      confidence: 1.0
    }
  },
  lines: [
    {
      lineNo: 1,
      sku: {
        value: 'SKU-001',
        evidence: [{ sheet: 'Orders', cell: 'A5', raw_value: 'SKU-001' }]
      },
      gtin: {
        value: '5901234123457',
        evidence: [{ sheet: 'Orders', cell: 'B5', raw_value: '5901234123457' }]
      },
      description: {
        value: 'Widget A',
        evidence: [{ sheet: 'Orders', cell: 'C5', raw_value: 'Widget A' }]
      },
      quantity: {
        value: 10,
        evidence: [{ sheet: 'Orders', cell: 'D5', raw_value: 10 }]
      },
      unitPriceSpreadsheet: {
        value: 25.50,
        evidence: [{ sheet: 'Orders', cell: 'E5', raw_value: 25.50 }]
      },
      lineTotalSpreadsheet: {
        value: 255.00,
        evidence: [{ sheet: 'Orders', cell: 'F5', raw_value: 255.00 }]
      },
      resolved: {
        zohoItemId: 'item_001',
        match: 'sku',
        confidence: 1.0,
        zohoRateUsed: 25.50
      }
    }
  ],
  totalsSpreadsheet: {
    subtotal: {
      value: 455.00,
      evidence: [{ sheet: 'Orders', cell: 'F10', raw_value: 455.00 }]
    },
    total: {
      value: 455.00,
      evidence: [{ sheet: 'Orders', cell: 'F11', raw_value: 455.00 }]
    }
  },
  issues: [],
  status: 'ready'
};
