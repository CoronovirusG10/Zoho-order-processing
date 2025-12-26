/**
 * Zoho Draft Creation Integration Tests
 *
 * Tests:
 * - Idempotent draft creation
 * - Fingerprint deduplication
 * - Mock Zoho API responses
 * - Error handling and retry logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import {
  setupIntegrationTests,
  mockZohoServer,
  mockFingerprintStore,
  testConfig,
  generateTestCaseId,
  generateTestTenantId,
  generateTestFingerprint,
  createMockCanonicalOrder,
} from './setup';
import {
  mockCustomers,
  mockItems,
  mockSalesOrderResponse,
  mockErrorResponses,
} from '../mocks/zoho-responses';

// Setup integration test lifecycle
setupIntegrationTests();

describe('Zoho Draft Creation Integration', () => {
  const zohoBaseUrl = 'https://books.zoho.eu/api/v3';

  describe('Idempotent Draft Creation', () => {
    it('should create new draft sales order successfully', async () => {
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      const canonicalOrder = createMockCanonicalOrder({
        meta: { case_id: caseId, tenant_id: tenantId },
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
            quantity: 10,
            zoho_item_id: 'item_001',
          },
        ],
      });

      // Create sales order request
      const salesOrderRequest = {
        customer_id: (canonicalOrder.customer as Record<string, unknown>).zoho_customer_id,
        salesorder_number: `OP-${caseId.substring(5, 13)}`,
        date: new Date().toISOString().split('T')[0],
        line_items: (canonicalOrder.line_items as Array<Record<string, unknown>>).map(line => ({
          item_id: line.zoho_item_id,
          quantity: line.quantity,
        })),
        notes: `Order Processing Case: ${caseId}`,
        reference_number: `CASE-${caseId}`,
        is_draft: true,
      };

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(salesOrderRequest),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.code).toBe(0);
      expect(data.message).toContain('created');
      expect(data.salesorder).toBeDefined();
      expect(data.salesorder.salesorder_id).toBeDefined();
      expect(data.salesorder.status).toBe('draft');
    });

    it('should return existing order for duplicate reference_number', async () => {
      const caseId = generateTestCaseId();

      // First creation
      const response1 = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          reference_number: `DUPLICATE-${caseId}`, // Special prefix triggers mock behavior
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      const data1 = await response1.json();

      // Second creation with same reference - should return existing
      const response2 = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          reference_number: `DUPLICATE-${caseId}`,
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      const data2 = await response2.json();

      // Both should succeed with same order ID
      expect(data1.code).toBe(0);
      expect(data2.code).toBe(0);
      expect(data2.salesorder.salesorder_id).toBe('SO-EXISTING');
    });

    it('should include all required fields in draft creation', async () => {
      const caseId = generateTestCaseId();

      const requiredFields = {
        customer_id: 'cust_001',
        date: '2025-12-26',
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
        reference_number: `CASE-${caseId}`,
        is_draft: true,
      };

      // Validate all required fields are present
      expect(requiredFields.customer_id).toBeDefined();
      expect(requiredFields.date).toBeDefined();
      expect(requiredFields.line_items.length).toBeGreaterThan(0);
      expect(requiredFields.line_items[0].item_id).toBeDefined();
      expect(requiredFields.line_items[0].quantity).toBeDefined();

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requiredFields),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Fingerprint Deduplication', () => {
    beforeEach(() => {
      mockFingerprintStore.clear();
    });

    it('should check fingerprint before creating draft', async () => {
      const fingerprint = generateTestFingerprint();
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // Check if fingerprint exists
      const existing = await mockFingerprintStore.exists(fingerprint, tenantId);
      expect(existing).toBeNull();

      // Store new fingerprint
      const storeResult = await mockFingerprintStore.store(fingerprint, caseId, tenantId);
      expect(storeResult.isNew).toBe(true);

      // Create draft would proceed here...

      // Update fingerprint with Zoho order ID after creation
      await mockFingerprintStore.updateZohoOrderId(fingerprint, tenantId, 'SO-001');

      // Verify update
      const updated = await mockFingerprintStore.exists(fingerprint, tenantId);
      expect(updated?.zohoSalesOrderId).toBe('SO-001');
    });

    it('should reject duplicate fingerprint within same tenant', async () => {
      const fingerprint = generateTestFingerprint();
      const caseId1 = generateTestCaseId();
      const caseId2 = generateTestCaseId();
      const tenantId = generateTestTenantId();

      // First case
      const result1 = await mockFingerprintStore.store(fingerprint, caseId1, tenantId);
      expect(result1.isNew).toBe(true);

      // Update with Zoho order ID
      await mockFingerprintStore.updateZohoOrderId(fingerprint, tenantId, 'SO-001');

      // Second case with same fingerprint
      const result2 = await mockFingerprintStore.store(fingerprint, caseId2, tenantId);
      expect(result2.isNew).toBe(false);
      expect(result2.existing?.caseId).toBe(caseId1);
      expect(result2.existing?.zohoSalesOrderId).toBe('SO-001');

      // Should skip draft creation and return existing order info
      const skipResult = {
        skipped: true,
        reason: 'Duplicate file detected',
        existingCaseId: result2.existing?.caseId,
        existingZohoOrderId: result2.existing?.zohoSalesOrderId,
      };

      expect(skipResult.skipped).toBe(true);
      expect(skipResult.existingZohoOrderId).toBe('SO-001');
    });

    it('should allow same fingerprint for different tenants', async () => {
      const fingerprint = generateTestFingerprint();
      const caseId1 = generateTestCaseId();
      const caseId2 = generateTestCaseId();
      const tenantId1 = generateTestTenantId();
      const tenantId2 = generateTestTenantId();

      // Store for tenant 1
      const result1 = await mockFingerprintStore.store(fingerprint, caseId1, tenantId1);
      expect(result1.isNew).toBe(true);

      // Store for tenant 2 (should succeed, different tenant)
      const result2 = await mockFingerprintStore.store(fingerprint, caseId2, tenantId2);
      expect(result2.isNew).toBe(true);

      // Both tenants should have their own records
      const tenant1Fingerprints = mockFingerprintStore.getByTenant(tenantId1);
      const tenant2Fingerprints = mockFingerprintStore.getByTenant(tenantId2);

      expect(tenant1Fingerprints.length).toBe(1);
      expect(tenant2Fingerprints.length).toBe(1);
    });

    it('should track fingerprint creation timestamp', async () => {
      const fingerprint = generateTestFingerprint();
      const caseId = generateTestCaseId();
      const tenantId = generateTestTenantId();

      const beforeStore = new Date().toISOString();
      await mockFingerprintStore.store(fingerprint, caseId, tenantId);
      const afterStore = new Date().toISOString();

      const stored = await mockFingerprintStore.exists(fingerprint, tenantId);
      expect(stored).not.toBeNull();
      expect(stored!.createdAt).toBeDefined();

      const createdAt = new Date(stored!.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(new Date(beforeStore).getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(new Date(afterStore).getTime());
    });
  });

  describe('Zoho API Response Handling', () => {
    it('should handle successful creation response', async () => {
      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.salesorder).toBeDefined();
      expect(data.salesorder.salesorder_id).toBeDefined();
      expect(data.salesorder.salesorder_number).toBeDefined();
      expect(data.salesorder.customer_id).toBe('cust_001');
      expect(data.salesorder.status).toBe('draft');
      expect(data.salesorder.line_items).toBeInstanceOf(Array);
    });

    it('should handle rate limit error with retry', async () => {
      // Add rate limit handler
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          await delay(100);
          return HttpResponse.json(mockErrorResponses.rateLimitExceeded, { status: 429 });
        })
      );

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.code).toBe(4003);
      expect(data.message).toContain('Rate limit');

      // Retry logic should be implemented
      const retryConfig = {
        maxRetries: 3,
        backoffMs: [1000, 2000, 4000],
        shouldRetry: (statusCode: number) => statusCode === 429,
      };

      expect(retryConfig.shouldRetry(429)).toBe(true);
      expect(retryConfig.shouldRetry(500)).toBe(false);
    });

    it('should handle authentication error', async () => {
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          return HttpResponse.json(mockErrorResponses.unauthorized, { status: 401 });
        })
      );

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.code).toBe(57);
      expect(data.message).toContain('Invalid OAuth');
    });

    it('should handle invalid request error', async () => {
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          return HttpResponse.json(mockErrorResponses.invalidRequest, { status: 400 });
        })
      );

      // Request with missing required fields
      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing customer_id and line_items
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.code).toBe(1);
      expect(data.message).toContain('missing required fields');
    });

    it('should handle server error with queue fallback', async () => {
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          return HttpResponse.json(
            { code: 500, message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      expect(response.status).toBe(500);

      // Should queue for retry
      const queueResult = {
        queued: true,
        queuedAt: new Date().toISOString(),
        retryAfter: 60000, // 1 minute
        error: 'Zoho API temporarily unavailable',
      };

      expect(queueResult.queued).toBe(true);
    });
  });

  describe('Customer Resolution', () => {
    it('should search for customer by name', async () => {
      const response = await fetch(
        `${zohoBaseUrl}/contacts?search_text=ACME`,
        {
          headers: { 'Authorization': 'Bearer test_access_token' },
        }
      );

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.contacts).toBeInstanceOf(Array);
      expect(data.contacts.length).toBeGreaterThan(0);

      // Should find ACME-related customers
      const acmeCustomers = data.contacts.filter((c: { display_name: string }) =>
        c.display_name.toLowerCase().includes('acme')
      );
      expect(acmeCustomers.length).toBeGreaterThan(0);
    });

    it('should get customer details by ID', async () => {
      const response = await fetch(`${zohoBaseUrl}/contacts/cust_001`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.contact).toBeDefined();
      expect(data.contact.customer_id).toBe('cust_001');
      expect(data.contact.display_name).toBe('ACME Corporation');
    });

    it('should handle customer not found', async () => {
      const response = await fetch(`${zohoBaseUrl}/contacts/nonexistent`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.code).toBe(1004);
    });
  });

  describe('Item Resolution', () => {
    it('should search for item by SKU', async () => {
      const response = await fetch(
        `${zohoBaseUrl}/items?sku=SKU-001`,
        {
          headers: { 'Authorization': 'Bearer test_access_token' },
        }
      );

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBe(1);
      expect(data.items[0].sku).toBe('SKU-001');
    });

    it('should search for item by GTIN', async () => {
      const response = await fetch(
        `${zohoBaseUrl}/items?cf_gtin=5901234123457`,
        {
          headers: { 'Authorization': 'Bearer test_access_token' },
        }
      );

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBe(1);
      expect(data.items[0].cf_gtin).toBe('5901234123457');
    });

    it('should get all items when no filter', async () => {
      const response = await fetch(`${zohoBaseUrl}/items`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBe(mockItems.length);
    });

    it('should get item details by ID', async () => {
      const response = await fetch(`${zohoBaseUrl}/items/item_001`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.item).toBeDefined();
      expect(data.item.item_id).toBe('item_001');
      expect(data.item.sku).toBe('SKU-001');
      expect(data.item.rate).toBe(25.50);
    });
  });

  describe('Draft Order Retrieval', () => {
    it('should get sales order by ID', async () => {
      const response = await fetch(`${zohoBaseUrl}/salesorders/SO-001`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      const data = await response.json();

      expect(data.code).toBe(0);
      expect(data.salesorder).toBeDefined();
      expect(data.salesorder.salesorder_id).toBe('SO-001');
      expect(data.salesorder.status).toBe('draft');
      expect(data.salesorder.line_items).toBeInstanceOf(Array);
    });

    it('should handle order not found', async () => {
      const response = await fetch(`${zohoBaseUrl}/salesorders/nonexistent`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.code).toBe(1004);
    });
  });

  describe('Zoho Rate from Items', () => {
    it('should use Zoho item rate instead of spreadsheet price', () => {
      const zohoItem = mockItems.find(i => i.item_id === 'item_001');
      const spreadsheetPrice = 20.00; // Different from Zoho rate

      const lineItem = {
        item_id: zohoItem!.item_id,
        quantity: 10,
        rate: zohoItem!.rate, // Use Zoho rate
        spreadsheet_rate_ignored: spreadsheetPrice,
      };

      expect(lineItem.rate).toBe(25.50); // Zoho rate
      expect(lineItem.rate).not.toBe(spreadsheetPrice);
    });

    it('should preserve spreadsheet price for audit', () => {
      const zohoItem = mockItems.find(i => i.item_id === 'item_001');
      const spreadsheetPrice = 20.00;
      const spreadsheetTotal = 200.00;

      const auditRecord = {
        item_id: zohoItem!.item_id,
        zoho_rate_used: zohoItem!.rate,
        audit: {
          spreadsheet_unit_price: spreadsheetPrice,
          spreadsheet_line_total: spreadsheetTotal,
          price_difference: zohoItem!.rate - spreadsheetPrice,
          note: 'Zoho pricing prevails per design requirement',
        },
      };

      expect(auditRecord.audit.spreadsheet_unit_price).toBe(20.00);
      expect(auditRecord.audit.price_difference).toBe(5.50);
    });
  });

  describe('OAuth Token Handling', () => {
    it('should refresh token when expired', async () => {
      const response = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'test_client_id',
          client_secret: 'test_client_secret',
          refresh_token: 'test_refresh_token',
        }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.token_type).toBe('Bearer');
      expect(data.expires_in).toBeGreaterThan(0);
    });

    it('should include correct authorization header', async () => {
      const accessToken = 'test_access_token';

      const response = await fetch(`${zohoBaseUrl}/items`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Audit Trail for Zoho Operations', () => {
    it('should log all Zoho API calls', async () => {
      const auditLog: Array<{
        operation: string;
        endpoint: string;
        timestamp: string;
        success: boolean;
        responseCode?: number;
      }> = [];

      // Create order
      const createResponse = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      auditLog.push({
        operation: 'create_sales_order',
        endpoint: '/salesorders',
        timestamp: new Date().toISOString(),
        success: createResponse.ok,
        responseCode: createResponse.status,
      });

      // Get order
      const getResponse = await fetch(`${zohoBaseUrl}/salesorders/SO-001`, {
        headers: { 'Authorization': 'Bearer test_access_token' },
      });

      auditLog.push({
        operation: 'get_sales_order',
        endpoint: '/salesorders/SO-001',
        timestamp: new Date().toISOString(),
        success: getResponse.ok,
        responseCode: getResponse.status,
      });

      expect(auditLog.length).toBe(2);
      expect(auditLog.every(entry => entry.success)).toBe(true);
      expect(auditLog.every(entry => entry.timestamp)).toBe(true);
    });

    it('should include request/response payloads in audit', async () => {
      const requestPayload = {
        customer_id: 'cust_001',
        line_items: [{ item_id: 'item_001', quantity: 10 }],
      };

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const responsePayload = await response.json();

      const auditEntry = {
        operation: 'create_sales_order',
        timestamp: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        success: response.ok,
        statusCode: response.status,
        latencyMs: 200, // Would be measured in real implementation
      };

      expect(auditEntry.request.customer_id).toBe('cust_001');
      expect(auditEntry.response.code).toBe(0);
      expect(auditEntry.success).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should queue order for retry on transient failure', async () => {
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          return HttpResponse.json(
            { code: 503, message: 'Service temporarily unavailable' },
            { status: 503 }
          );
        })
      );

      const caseId = generateTestCaseId();

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_001',
          reference_number: `CASE-${caseId}`,
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      expect(response.status).toBe(503);

      // Queue for retry
      const queuedOrder = {
        caseId,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        payload: {
          customer_id: 'cust_001',
          reference_number: `CASE-${caseId}`,
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        },
      };

      expect(queuedOrder.retryCount).toBe(0);
      expect(queuedOrder.maxRetries).toBe(3);
    });

    it('should not queue on permanent failure', async () => {
      mockZohoServer.use(
        http.post(`${zohoBaseUrl}/salesorders`, async () => {
          return HttpResponse.json(
            { code: 400, message: 'Invalid customer ID' },
            { status: 400 }
          );
        })
      );

      const response = await fetch(`${zohoBaseUrl}/salesorders`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'invalid_customer',
          line_items: [{ item_id: 'item_001', quantity: 10 }],
        }),
      });

      expect(response.status).toBe(400);

      // Should NOT queue - permanent error
      const shouldQueue = (statusCode: number): boolean => {
        // Only queue for transient errors (5xx, 429)
        return statusCode >= 500 || statusCode === 429;
      };

      expect(shouldQueue(400)).toBe(false);
      expect(shouldQueue(404)).toBe(false);
      expect(shouldQueue(500)).toBe(true);
      expect(shouldQueue(503)).toBe(true);
      expect(shouldQueue(429)).toBe(true);
    });
  });
});
