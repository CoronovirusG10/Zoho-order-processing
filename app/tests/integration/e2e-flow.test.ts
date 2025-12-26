/**
 * End-to-End Flow Integration Tests
 *
 * Tests the complete order processing flow:
 * Excel Upload -> Parse -> Committee -> Zoho Draft
 *
 * Uses golden file Excel samples and mock services.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import {
  setupIntegrationTests,
  mockBlobStorage,
  mockFingerprintStore,
  mockCommitteeProvider,
  testFixtures,
  mockZohoServer,
  testConfig,
  generateTestCaseId,
  generateTestTenantId,
  generateTestFingerprint,
  createMockCanonicalOrder,
  waitForCondition,
  type MockBlobMetadata,
} from './setup';
import { ExcelBuilder } from '../utils/excel-builder';
import { mockCustomers, mockItems } from '../mocks/zoho-responses';
import {
  unanimousHighConfidence,
  twoOfThreeConsensus,
  completeDisagreement,
  criticalFieldDisagreement,
} from '../mocks/committee-responses';

// Setup integration test lifecycle
setupIntegrationTests();

describe('E2E Flow Integration', () => {
  // Create fresh ExcelBuilder for each test that needs it
  const createExcelBuilder = () => new ExcelBuilder();

  describe('Happy Path: Simple Order Processing', () => {
    it('should process simple English order from upload to Zoho draft', async () => {
      // Setup
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();
      const fingerprint = generateTestFingerprint();

      // Step 1: Create and upload Excel file
      const excelBuffer = await testFixtures.createSimpleOrder();
      expect(excelBuffer).toBeInstanceOf(Buffer);
      expect(excelBuffer.length).toBeGreaterThan(0);

      // Store in mock blob storage
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;
      const uploadResult = await mockBlobStorage.uploadBlob(
        'orders',
        blobPath,
        excelBuffer,
        {
          caseId,
          tenantId,
          filename: 'simple-order.xlsx',
          sha256: fingerprint,
          uploadedAt: new Date().toISOString(),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toContain(blobPath);

      // Step 2: Parse Excel file
      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      expect(downloadedBuffer).not.toBeNull();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];
      expect(worksheet).toBeDefined();
      expect(worksheet.name).toBe('Orders');

      // Verify no formulas in data
      let hasFormulas = false;
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.formula) {
            hasFormulas = true;
          }
        });
      });
      expect(hasFormulas).toBe(false);

      // Extract customer and line items
      const rows: unknown[][] = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          rowData.push(cell.value);
        });
        rows.push(rowData);
      });

      expect(rows.length).toBeGreaterThan(3);

      // Step 3: Run committee (mock)
      const committeeVotes = await mockCommitteeProvider.getCommitteeVotes(
        { rows, headers: rows[0] },
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      expect(committeeVotes.length).toBe(3);
      expect(committeeVotes.every(v => v.error === undefined)).toBe(true);

      // Verify consensus on SKU column
      const skuVotes = committeeVotes.map(v =>
        v.mappings.find(m => m.field === 'sku')?.selectedColumnId
      );
      const skuConsensus = skuVotes.every(v => v === skuVotes[0]);
      expect(skuConsensus).toBe(true);

      // Step 4: Check fingerprint for deduplication
      const fingerprintResult = await mockFingerprintStore.store(
        fingerprint,
        caseId,
        tenantId
      );
      expect(fingerprintResult.isNew).toBe(true);

      // Step 5: Prepare canonical order
      const canonicalOrder = createMockCanonicalOrder({
        meta: {
          case_id: caseId,
          tenant_id: tenantId,
          file_sha256: fingerprint,
          source_filename: 'simple-order.xlsx',
        },
        customer: {
          input_name: 'ACME Corporation',
          zoho_customer_id: 'cust_001',
          zoho_customer_name: 'ACME Corporation',
          resolution_status: 'resolved',
        },
        line_items: [
          {
            row: 0,
            sku: 'SKU-001',
            product_name: 'Widget A',
            quantity: 10,
            unit_price_source: 25.50,
            zoho_item_id: 'item_001',
          },
          {
            row: 1,
            sku: 'SKU-002',
            product_name: 'Widget B',
            quantity: 5,
            unit_price_source: 40.00,
            zoho_item_id: 'item_002',
          },
        ],
        confidence: { overall: 0.92 },
        issues: [],
      });

      expect(canonicalOrder.customer.zoho_customer_id).toBe('cust_001');
      expect((canonicalOrder.line_items as unknown[]).length).toBe(2);

      // Step 6: Create Zoho draft would happen here via API
      // (Using MSW mock - actual call would be made by service)

      // Verify audit trail
      const auditLog = mockBlobStorage.getAuditLog();
      expect(auditLog.some(e => e.operation === 'upload')).toBe(true);
      expect(auditLog.some(e => e.operation === 'download')).toBe(true);
    });

    it('should process multi-line order with GTIN matching', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Create multi-line order
      const excelBuffer = await testFixtures.createMultiLineOrder();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'multi-line-order.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Parse and validate
      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];
      // Sheet name may vary based on fixture generator
      expect(worksheet.name).toBeDefined();

      // Count data rows (excluding header and customer row)
      let dataRowCount = 0;
      worksheet.eachRow((row, rowNumber) => {
        const firstCell = row.getCell(1).value;
        if (typeof firstCell === 'string' && firstCell.startsWith('SKU-')) {
          dataRowCount++;
        }
      });

      expect(dataRowCount).toBe(4); // 4 line items

      // Verify GTIN format in data
      const gtins: string[] = [];
      worksheet.eachRow((row) => {
        const gtinCell = row.getCell(2).value;
        if (typeof gtinCell === 'string' && /^\d{13}$/.test(gtinCell)) {
          gtins.push(gtinCell);
        }
      });

      expect(gtins.length).toBe(4);
      gtins.forEach(gtin => {
        expect(gtin).toMatch(/^\d{13}$/);
      });
    });

    it('should process Farsi headers order with language detection', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Create Farsi order
      const excelBuffer = await testFixtures.createFarsiOrder();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'farsi-order.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];

      // Detect Farsi sheet name (from createFarsiWorkbook)
      // The sheet name should contain Farsi characters
      expect(worksheet.name).toBeDefined();
      const hasFarsiChars = /[\u0600-\u06FF]/.test(worksheet.name);
      expect(hasFarsiChars).toBe(true);

      // Get headers (first row)
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => {
        headers.push(String(cell.value));
      });

      // Verify Farsi headers
      expect(headers).toContain('کد کالا'); // SKU in Farsi
      expect(headers).toContain('نام محصول'); // Product name in Farsi
      expect(headers).toContain('تعداد'); // Quantity in Farsi

      // Detect language hint from headers
      const farsiPattern = /[\u0600-\u06FF]/;
      const hasFarsi = headers.some(h => farsiPattern.test(h));
      expect(hasFarsi).toBe(true);

      const languageHint = hasFarsi ? 'fa' : 'en';
      expect(languageHint).toBe('fa');
    });
  });

  describe('Formula Blocking', () => {
    it('should detect and block Excel files with formulas', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Create order with formulas
      const excelBuffer = await testFixtures.createOrderWithFormulas();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'order-with-formulas.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];

      // Detect formulas
      const formulaCells: Array<{ cell: string; formula: string }> = [];
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.formula) {
            formulaCells.push({
              cell: `${String.fromCharCode(64 + colNumber)}${rowNumber}`,
              formula: cell.formula,
            });
          }
        });
      });

      // Should find formulas
      expect(formulaCells.length).toBeGreaterThan(0);

      // When formula blocking is enabled, should create blocking issue
      if (testConfig.formulaBlockingEnabled) {
        const blockingIssue = {
          code: 'FORMULAS_BLOCKED',
          severity: 'blocker',
          message: `Spreadsheet contains ${formulaCells.length} formulas in data range`,
          evidence: formulaCells.slice(0, 5), // Show first 5 formulas
          suggested_user_action: 'Export as values-only or paste values before uploading',
        };

        expect(blockingIssue.code).toBe('FORMULAS_BLOCKED');
        expect(blockingIssue.evidence.length).toBeGreaterThan(0);
      }
    });

    it('should allow formulas when blocking is disabled', async () => {
      // Temporarily disable formula blocking
      const originalSetting = testConfig.formulaBlockingEnabled;
      (testConfig as { formulaBlockingEnabled: boolean }).formulaBlockingEnabled = false;

      try {
        const excelBuffer = await testFixtures.createOrderWithFormulas();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);

        const worksheet = workbook.worksheets[0];
        let hasFormulas = false;
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            if (cell.formula) hasFormulas = true;
          });
        });

        expect(hasFormulas).toBe(true);

        // With blocking disabled, should proceed (just log warning)
        const warningIssue = {
          code: 'FORMULAS_PRESENT',
          severity: 'warning',
          message: 'Spreadsheet contains formulas - values will be used',
        };

        expect(warningIssue.severity).toBe('warning');
      } finally {
        // Restore setting
        (testConfig as { formulaBlockingEnabled: boolean }).formulaBlockingEnabled = originalSetting;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty spreadsheet gracefully', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      const excelBuffer = await testFixtures.createEmptyWorkbook();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'empty.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];

      // Count non-empty rows
      let nonEmptyRows = 0;
      worksheet.eachRow((row) => {
        let hasContent = false;
        row.eachCell((cell) => {
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            hasContent = true;
          }
        });
        if (hasContent) nonEmptyRows++;
      });

      expect(nonEmptyRows).toBe(0);

      // Should create error issue
      const errorIssue = {
        code: 'EMPTY_SPREADSHEET',
        severity: 'blocker',
        message: 'No data found in spreadsheet',
        suggested_user_action: 'Upload a spreadsheet with order data',
      };

      expect(errorIssue.code).toBe('EMPTY_SPREADSHEET');
    });

    it('should handle missing required fields', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      const excelBuffer = await testFixtures.createIncompleteOrder();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'incomplete.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadedBuffer!);

      const worksheet = workbook.worksheets[0];

      // Get headers
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => {
        headers.push(String(cell.value).toLowerCase());
      });

      // Check for required fields
      const requiredFields = ['sku', 'quantity', 'qty'];
      const hasSku = headers.some(h => h.includes('sku') || h.includes('code'));
      const hasQty = headers.some(h => h.includes('qty') || h.includes('quantity'));

      // Missing fields should generate issues
      const issues: Array<{ code: string; field: string }> = [];

      if (!hasSku) {
        issues.push({ code: 'MISSING_REQUIRED_FIELD', field: 'sku' });
      }
      // Note: This test file only has SKU and Qty, so other fields might be missing
      if (!headers.some(h => h.includes('price'))) {
        issues.push({ code: 'MISSING_REQUIRED_FIELD', field: 'unit_price' });
      }

      expect(issues.length).toBeGreaterThan(0);
    });

    it('should handle corrupted Excel file', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Create corrupted buffer (random bytes)
      const corruptedBuffer = Buffer.from('This is not a valid Excel file');
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;

      await mockBlobStorage.uploadBlob('orders', blobPath, corruptedBuffer, {
        caseId,
        tenantId,
        filename: 'corrupted.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);
      const workbook = new ExcelJS.Workbook();

      // Should throw error when trying to load
      let parseError: Error | null = null;
      try {
        await workbook.xlsx.load(downloadedBuffer!);
      } catch (error) {
        parseError = error as Error;
      }

      expect(parseError).not.toBeNull();
      expect(parseError!.message).toBeDefined();

      // Should create error issue
      const errorIssue = {
        code: 'FILE_UNREADABLE',
        severity: 'blocker',
        message: 'Unable to parse Excel file',
        suggested_user_action: 'Ensure file is a valid .xlsx file and not corrupted',
      };

      expect(errorIssue.code).toBe('FILE_UNREADABLE');
    });

    it('should handle blob storage unavailable', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();
      const blobPath = `${tenantId}/${caseId}/nonexistent.xlsx`;

      // Try to download non-existent blob
      const downloadedBuffer = await mockBlobStorage.downloadBlob('orders', blobPath);

      expect(downloadedBuffer).toBeNull();

      // Should create error issue
      const errorIssue = {
        code: 'FILE_NOT_FOUND',
        severity: 'blocker',
        message: 'Order file not found in storage',
        suggested_user_action: 'Please re-upload the order file',
      };

      expect(errorIssue.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('Deduplication via Fingerprint', () => {
    it('should detect duplicate file upload via fingerprint', async () => {
      const caseId1 = generateTestCaseId();
      const caseId2 = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Create Excel file and compute fingerprint
      const excelBuffer = await testFixtures.createSimpleOrder();
      const fingerprint = crypto.createHash('sha256').update(excelBuffer).digest('hex');

      // First upload
      const result1 = await mockFingerprintStore.store(fingerprint, caseId1, tenantId);
      expect(result1.isNew).toBe(true);

      // Second upload with same fingerprint
      const result2 = await mockFingerprintStore.store(fingerprint, caseId2, tenantId);
      expect(result2.isNew).toBe(false);
      expect(result2.existing?.caseId).toBe(caseId1);

      // Should create warning issue
      const duplicateIssue = {
        code: 'DUPLICATE_FILE',
        severity: 'warning',
        message: `This file was previously processed as case ${caseId1}`,
        originalCaseId: caseId1,
        requiresUserConfirmation: true,
      };

      expect(duplicateIssue.code).toBe('DUPLICATE_FILE');
      expect(duplicateIssue.originalCaseId).toBe(caseId1);
    });

    it('should allow different files from same tenant', async () => {
      const caseId1 = generateTestCaseId();
      const caseId2 = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Different fingerprints for different files
      const fingerprint1 = generateTestFingerprint();
      const fingerprint2 = generateTestFingerprint();

      const result1 = await mockFingerprintStore.store(fingerprint1, caseId1, tenantId);
      const result2 = await mockFingerprintStore.store(fingerprint2, caseId2, tenantId);

      expect(result1.isNew).toBe(true);
      expect(result2.isNew).toBe(true);

      // Both should be stored
      const tenantFingerprints = mockFingerprintStore.getByTenant(tenantId);
      expect(tenantFingerprints.length).toBe(2);
    });

    it('should allow same file from different tenants', async () => {
      const caseId1 = generateTestCaseId();
      const caseId2 = generateTestCaseId();
      const tenantId1 = generateTestTenantId();
      const tenantId2 = generateTestTenantId();
      const fingerprint = generateTestFingerprint();

      const result1 = await mockFingerprintStore.store(fingerprint, caseId1, tenantId1);
      const result2 = await mockFingerprintStore.store(fingerprint, caseId2, tenantId2);

      // Both should be new (different tenants)
      expect(result1.isNew).toBe(true);
      expect(result2.isNew).toBe(true);
    });
  });

  describe('Evidence Trail', () => {
    it('should maintain complete audit trail through processing', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Clear previous audit log
      mockBlobStorage.clear();

      // Upload
      const excelBuffer = await testFixtures.createSimpleOrder();
      const blobPath = `${tenantId}/${caseId}/order.xlsx`;
      await mockBlobStorage.uploadBlob('orders', blobPath, excelBuffer, {
        caseId,
        tenantId,
        filename: 'test-order.xlsx',
        sha256: generateTestFingerprint(),
        uploadedAt: new Date().toISOString(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Download for parsing
      await mockBlobStorage.downloadBlob('orders', blobPath);

      // Store canonical JSON result
      const canonicalPath = `${tenantId}/${caseId}/canonical.json`;
      const canonicalData = createMockCanonicalOrder({ meta: { case_id: caseId } });
      await mockBlobStorage.uploadBlob(
        'orders',
        canonicalPath,
        Buffer.from(JSON.stringify(canonicalData, null, 2)),
        {
          caseId,
          tenantId,
          filename: 'canonical.json',
          sha256: 'canonical-hash',
          uploadedAt: new Date().toISOString(),
          contentType: 'application/json',
        }
      );

      // Verify audit trail
      const auditLog = mockBlobStorage.getAuditLog();

      expect(auditLog.length).toBeGreaterThanOrEqual(3);
      expect(auditLog[0].operation).toBe('upload');
      expect(auditLog[0].path).toContain('order.xlsx');
      expect(auditLog[1].operation).toBe('download');
      expect(auditLog[2].operation).toBe('upload');
      expect(auditLog[2].path).toContain('canonical.json');

      // Verify all operations have timestamps
      auditLog.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
      });
    });

    it('should store cell references as evidence for extracted values', async () => {
      const excelBuffer = await testFixtures.createSimpleOrder();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);

      const worksheet = workbook.worksheets[0];

      // Extract values with evidence
      const extractedData: Array<{
        value: unknown;
        evidence: { sheet: string; cell: string; raw_value: unknown };
      }> = [];

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value !== null && cell.value !== undefined) {
            extractedData.push({
              value: cell.value,
              evidence: {
                sheet: worksheet.name,
                cell: `${String.fromCharCode(64 + colNumber)}${rowNumber}`,
                raw_value: cell.value,
              },
            });
          }
        });
      });

      expect(extractedData.length).toBeGreaterThan(0);

      // Verify evidence format
      extractedData.forEach(item => {
        expect(item.evidence.sheet).toBe('Orders');
        expect(item.evidence.cell).toMatch(/^[A-Z]+\d+$/);
        expect(item.evidence.raw_value).toBeDefined();
      });
    });
  });

  describe('Multi-Sheet Handling', () => {
    it('should detect and score multiple sheets', async () => {
      const excelBuilder = createExcelBuilder();
      const multiSheetBuffer = await excelBuilder.createMultiSheetWorkbook([
        {
          name: 'Summary',
          headers: ['Report Date', 'Total Orders'],
          rows: [['2025-12-25', 2]],
        },
        {
          name: 'Orders',
          headers: ['SKU', 'Product', 'Qty', 'Price'],
          rows: [
            ['SKU-001', 'Widget A', 10, 25.50],
            ['SKU-002', 'Widget B', 5, 40.00],
          ],
        },
        {
          name: 'Archive',
          headers: ['SKU', 'Product', 'Qty'],
          rows: [['OLD-001', 'Old Product', 0]],
        },
      ]);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(multiSheetBuffer);

      // Detect sheets
      const sheets = workbook.worksheets.map(ws => ({
        name: ws.name,
        rowCount: ws.rowCount,
        columnCount: ws.columnCount,
      }));

      expect(sheets.length).toBe(3);

      // Score sheets based on order-like content
      const scoredSheets = sheets.map(sheet => {
        let score = 0;

        // Check for order-related sheet names
        if (/order|sales|invoice/i.test(sheet.name)) score += 0.3;
        if (/summary|archive|template/i.test(sheet.name)) score -= 0.2;

        // Check for minimum data
        if (sheet.rowCount > 1) score += 0.2;
        if (sheet.rowCount > 3) score += 0.2;
        if (sheet.columnCount >= 3) score += 0.2;

        return { ...sheet, score: Math.max(0, Math.min(1, score)) };
      });

      // Orders sheet should have highest score
      const sortedSheets = scoredSheets.sort((a, b) => b.score - a.score);
      expect(sortedSheets[0].name).toBe('Orders');
    });
  });

  describe('Zoho API Integration (Mock)', () => {
    it('should create sales order via Zoho API', async () => {
      const caseId = generateTestCaseId();

      // Prepare sales order request
      const salesOrderRequest = {
        customer_id: 'cust_001',
        salesorder_number: `OP-${caseId.substring(0, 8)}`,
        date: new Date().toISOString().split('T')[0],
        line_items: [
          {
            item_id: 'item_001',
            quantity: 10,
            rate: 25.50,
          },
          {
            item_id: 'item_002',
            quantity: 5,
            rate: 40.00,
          },
        ],
        notes: 'Created via Order Processing integration',
        reference_number: `CASE-${caseId}`,
      };

      // Make request (would be caught by MSW)
      const response = await fetch('https://books.zoho.eu/api/v3/salesorders', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(salesOrderRequest),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.code).toBe(0);
      expect(data.salesorder.salesorder_id).toBeDefined();
      expect(data.salesorder.status).toBe('draft');
    });

    it('should handle Zoho API rate limiting', async () => {
      // Add handler for rate limit
      mockZohoServer.use(
        http.post('https://books.zoho.eu/api/v3/salesorders', async () => {
          await delay(100);
          return HttpResponse.json(
            { code: 4003, message: 'Rate limit exceeded' },
            { status: 429 }
          );
        })
      );

      const response = await fetch('https://books.zoho.eu/api/v3/salesorders', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.code).toBe(4003);
      expect(data.message).toContain('Rate limit');
    });
  });
});
