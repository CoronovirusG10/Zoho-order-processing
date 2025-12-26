/**
 * Integration Test Setup
 *
 * Provides test environment configuration, mock servers, and utilities
 * for pre-production integration testing.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { ExcelBuilder } from '../utils/excel-builder';
import {
  mockCustomers,
  mockItems,
  mockSalesOrderResponse,
  mockOAuthTokenResponse,
  mockErrorResponses,
  createMockCustomerSearchResponse,
  createMockItemSearchResponse,
  createMockItemGtinSearchResponse,
} from '../mocks/zoho-responses';
import {
  mockCalibrationData,
  calculateMockWeights,
} from '../mocks/committee-responses';

// ============================================================================
// Environment Configuration
// ============================================================================

export interface TestEnvironmentConfig {
  zohoApiBaseUrl: string;
  blobStorageUrl: string;
  cosmosDbEndpoint: string;
  committeeConcurrency: number;
  formulaBlockingEnabled: boolean;
  committeePrimaryProvider: string;
  committeeFallbackProviders: string[];
  confidenceThreshold: number;
  deduplicationEnabled: boolean;
}

export const testConfig: TestEnvironmentConfig = {
  zohoApiBaseUrl: 'https://books.zoho.eu/api/v3',
  blobStorageUrl: 'https://teststorage.blob.core.windows.net',
  cosmosDbEndpoint: 'https://localhost:8081',
  committeeConcurrency: 3,
  formulaBlockingEnabled: true,
  committeePrimaryProvider: 'gpt-4o',
  committeeFallbackProviders: ['claude-opus-4', 'gemini-pro'],
  confidenceThreshold: 0.80,
  deduplicationEnabled: true,
};

// Set test environment variables
export function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.ZOHO_API_BASE_URL = testConfig.zohoApiBaseUrl;
  process.env.ZOHO_CLIENT_ID = 'test-client-id';
  process.env.ZOHO_CLIENT_SECRET = 'test-client-secret';
  process.env.ZOHO_REFRESH_TOKEN = 'test-refresh-token';
  process.env.ZOHO_ORGANIZATION_ID = 'test-org-id';
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  process.env.COSMOS_DB_ENDPOINT = testConfig.cosmosDbEndpoint;
  process.env.COSMOS_DB_KEY = 'test-key';
  process.env.FORMULA_BLOCKING_ENABLED = String(testConfig.formulaBlockingEnabled);
  process.env.COMMITTEE_PRIMARY_PROVIDER = testConfig.committeePrimaryProvider;
  process.env.CONFIDENCE_THRESHOLD = String(testConfig.confidenceThreshold);
}

// ============================================================================
// Mock Zoho API Server
// ============================================================================

const zohoBaseUrl = 'https://books.zoho.eu/api/v3';

export const zohoApiHandlers = [
  // OAuth Token Refresh
  http.post('https://accounts.zoho.eu/oauth/v2/token', async () => {
    await delay(50);
    return HttpResponse.json(mockOAuthTokenResponse);
  }),

  // List Customers
  http.get(`${zohoBaseUrl}/contacts`, async ({ request }) => {
    const url = new URL(request.url);
    const searchText = url.searchParams.get('search_text') || '';
    await delay(100);
    return HttpResponse.json(createMockCustomerSearchResponse(searchText));
  }),

  // Get Single Customer
  http.get(`${zohoBaseUrl}/contacts/:customerId`, async ({ params }) => {
    const { customerId } = params;
    const customer = mockCustomers.find(c => c.customer_id === customerId);

    if (!customer) {
      return HttpResponse.json(mockErrorResponses.notFound, { status: 404 });
    }

    await delay(50);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      contact: customer,
    });
  }),

  // List Items
  http.get(`${zohoBaseUrl}/items`, async ({ request }) => {
    const url = new URL(request.url);
    const sku = url.searchParams.get('sku');
    const gtin = url.searchParams.get('cf_gtin');

    await delay(100);

    if (sku) {
      return HttpResponse.json(createMockItemSearchResponse(sku));
    }
    if (gtin) {
      return HttpResponse.json(createMockItemGtinSearchResponse(gtin));
    }

    return HttpResponse.json({
      code: 0,
      message: 'success',
      items: mockItems,
      page_context: { page: 1, per_page: 25, has_more_page: false },
    });
  }),

  // Get Single Item
  http.get(`${zohoBaseUrl}/items/:itemId`, async ({ params }) => {
    const { itemId } = params;
    const item = mockItems.find(i => i.item_id === itemId);

    if (!item) {
      return HttpResponse.json(mockErrorResponses.notFound, { status: 404 });
    }

    await delay(50);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      item,
    });
  }),

  // Create Sales Order (Draft)
  http.post(`${zohoBaseUrl}/salesorders`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    await delay(200);

    // Simulate idempotency check via reference_number
    const referenceNumber = body.reference_number as string | undefined;
    if (referenceNumber?.startsWith('DUPLICATE-')) {
      return HttpResponse.json({
        code: 0,
        message: 'Sales order already exists with this reference',
        salesorder: {
          ...mockSalesOrderResponse.salesorder,
          salesorder_id: 'SO-EXISTING',
          salesorder_number: 'SO-99999',
        },
      });
    }

    return HttpResponse.json(mockSalesOrderResponse);
  }),

  // Get Sales Order
  http.get(`${zohoBaseUrl}/salesorders/:orderId`, async ({ params }) => {
    const { orderId } = params;
    await delay(50);

    if (orderId === 'SO-001' || orderId === 'SO-EXISTING') {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        salesorder: mockSalesOrderResponse.salesorder,
      });
    }

    return HttpResponse.json(mockErrorResponses.notFound, { status: 404 });
  }),
];

// Create MSW server instance
export const mockZohoServer = setupServer(...zohoApiHandlers);

// ============================================================================
// Mock Blob Storage Client
// ============================================================================

export interface MockBlobMetadata {
  caseId: string;
  tenantId: string;
  filename: string;
  sha256: string;
  uploadedAt: string;
  contentType: string;
}

export class MockBlobStorageClient {
  private storage: Map<string, { data: Buffer; metadata: MockBlobMetadata }> = new Map();
  private auditLog: Array<{ operation: string; path: string; timestamp: string }> = [];

  /**
   * Upload blob to storage
   */
  async uploadBlob(
    containerName: string,
    blobPath: string,
    data: Buffer,
    metadata: MockBlobMetadata
  ): Promise<{ success: boolean; url: string; etag: string }> {
    const key = `${containerName}/${blobPath}`;
    this.storage.set(key, { data, metadata });

    this.auditLog.push({
      operation: 'upload',
      path: key,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      url: `${testConfig.blobStorageUrl}/${key}`,
      etag: `"${Date.now()}"`,
    };
  }

  /**
   * Download blob from storage
   */
  async downloadBlob(containerName: string, blobPath: string): Promise<Buffer | null> {
    const key = `${containerName}/${blobPath}`;
    const blob = this.storage.get(key);

    this.auditLog.push({
      operation: 'download',
      path: key,
      timestamp: new Date().toISOString(),
    });

    return blob?.data || null;
  }

  /**
   * Check if blob exists
   */
  async blobExists(containerName: string, blobPath: string): Promise<boolean> {
    const key = `${containerName}/${blobPath}`;
    return this.storage.has(key);
  }

  /**
   * Get blob metadata
   */
  async getBlobMetadata(containerName: string, blobPath: string): Promise<MockBlobMetadata | null> {
    const key = `${containerName}/${blobPath}`;
    const blob = this.storage.get(key);
    return blob?.metadata || null;
  }

  /**
   * List blobs by prefix
   */
  async listBlobs(containerName: string, prefix: string): Promise<string[]> {
    const containerPrefix = `${containerName}/`;
    const fullPrefix = `${containerName}/${prefix}`;

    return Array.from(this.storage.keys())
      .filter(key => key.startsWith(fullPrefix))
      .map(key => key.substring(containerPrefix.length));
  }

  /**
   * Delete blob
   */
  async deleteBlob(containerName: string, blobPath: string): Promise<boolean> {
    const key = `${containerName}/${blobPath}`;
    const existed = this.storage.has(key);
    this.storage.delete(key);

    this.auditLog.push({
      operation: 'delete',
      path: key,
      timestamp: new Date().toISOString(),
    });

    return existed;
  }

  /**
   * Get audit log for testing
   */
  getAuditLog(): Array<{ operation: string; path: string; timestamp: string }> {
    return [...this.auditLog];
  }

  /**
   * Clear all storage and audit log (for test reset)
   */
  clear(): void {
    this.storage.clear();
    this.auditLog = [];
  }

  /**
   * Get storage size (for assertions)
   */
  size(): number {
    return this.storage.size;
  }
}

// ============================================================================
// Mock Fingerprint Store (for deduplication)
// ============================================================================

export interface StoredFingerprint {
  fingerprint: string;
  caseId: string;
  tenantId: string;
  zohoSalesOrderId?: string;
  createdAt: string;
}

export class MockFingerprintStore {
  private fingerprints: Map<string, StoredFingerprint> = new Map();

  /**
   * Check if fingerprint exists (for deduplication)
   */
  async exists(fingerprint: string, tenantId: string): Promise<StoredFingerprint | null> {
    const key = `${tenantId}:${fingerprint}`;
    return this.fingerprints.get(key) || null;
  }

  /**
   * Store fingerprint
   */
  async store(
    fingerprint: string,
    caseId: string,
    tenantId: string
  ): Promise<{ isNew: boolean; existing?: StoredFingerprint }> {
    const key = `${tenantId}:${fingerprint}`;
    const existing = this.fingerprints.get(key);

    if (existing) {
      return { isNew: false, existing };
    }

    const record: StoredFingerprint = {
      fingerprint,
      caseId,
      tenantId,
      createdAt: new Date().toISOString(),
    };

    this.fingerprints.set(key, record);
    return { isNew: true };
  }

  /**
   * Update fingerprint with Zoho order ID
   */
  async updateZohoOrderId(
    fingerprint: string,
    tenantId: string,
    zohoSalesOrderId: string
  ): Promise<boolean> {
    const key = `${tenantId}:${fingerprint}`;
    const existing = this.fingerprints.get(key);

    if (!existing) {
      return false;
    }

    existing.zohoSalesOrderId = zohoSalesOrderId;
    return true;
  }

  /**
   * Clear all fingerprints (for test reset)
   */
  clear(): void {
    this.fingerprints.clear();
  }

  /**
   * Get all fingerprints for tenant
   */
  getByTenant(tenantId: string): StoredFingerprint[] {
    return Array.from(this.fingerprints.values())
      .filter(fp => fp.tenantId === tenantId);
  }
}

// ============================================================================
// Mock Committee Provider
// ============================================================================

export interface MockProviderResponse {
  providerId: string;
  mappings: Array<{
    field: string;
    selectedColumnId: string | null;
    confidence: number;
    reasoning?: string;
  }>;
  overallConfidence: number;
  latencyMs: number;
  error?: string;
}

export class MockCommitteeProvider {
  private responses: Map<string, MockProviderResponse[]> = new Map();
  private defaultLatency = 500;
  private failureRate = 0;

  /**
   * Set mock responses for a specific field pattern
   */
  setResponses(pattern: string, responses: MockProviderResponse[]): void {
    this.responses.set(pattern, responses);
  }

  /**
   * Set simulated failure rate (0-1)
   */
  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Get mock committee responses
   */
  async getCommitteeVotes(
    _evidencePack: unknown,
    providers: string[] = ['gpt-4o', 'claude-opus-4', 'gemini-pro']
  ): Promise<MockProviderResponse[]> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.defaultLatency));

    // Check for simulated failures
    const results: MockProviderResponse[] = [];

    for (const providerId of providers) {
      if (Math.random() < this.failureRate) {
        results.push({
          providerId,
          mappings: [],
          overallConfidence: 0,
          latencyMs: this.defaultLatency,
          error: 'SIMULATED_FAILURE',
        });
        continue;
      }

      // Return default unanimous response
      results.push({
        providerId,
        mappings: [
          { field: 'sku', selectedColumnId: 'col-A', confidence: 0.90 + Math.random() * 0.08 },
          { field: 'quantity', selectedColumnId: 'col-C', confidence: 0.92 + Math.random() * 0.06 },
          { field: 'unit_price', selectedColumnId: 'col-D', confidence: 0.88 + Math.random() * 0.10 },
          { field: 'product_name', selectedColumnId: 'col-B', confidence: 0.85 + Math.random() * 0.10 },
        ],
        overallConfidence: 0.88 + Math.random() * 0.10,
        latencyMs: this.defaultLatency + Math.random() * 200,
      });
    }

    return results;
  }

  /**
   * Get provider weights from calibration
   */
  getWeights(): Record<string, number> {
    return calculateMockWeights(mockCalibrationData);
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.responses.clear();
    this.failureRate = 0;
  }
}

// ============================================================================
// Test Fixtures Factory
// ============================================================================

export class TestFixturesFactory {
  /**
   * Create a fresh ExcelBuilder for each operation
   * (ExcelBuilder accumulates worksheets, so we need a new instance each time)
   */
  private createBuilder(): ExcelBuilder {
    return new ExcelBuilder();
  }

  /**
   * Create simple English order Excel
   */
  async createSimpleOrder(): Promise<Buffer> {
    return this.createBuilder().createSimpleWorkbook({
      headers: ['SKU', 'Description', 'Qty', 'Unit Price', 'Total'],
      rows: [
        ['Customer: ACME Corporation', '', '', '', ''],
        ['', '', '', '', ''],
        ['SKU', 'Description', 'Qty', 'Unit Price', 'Total'],
        ['SKU-001', 'Widget A', 10, 25.50, 255.00],
        ['SKU-002', 'Widget B', 5, 40.00, 200.00],
        ['', '', '', 'Grand Total:', 455.00],
      ],
      sheetName: 'Orders',
    });
  }

  /**
   * Create multi-line order Excel
   */
  async createMultiLineOrder(): Promise<Buffer> {
    return this.createBuilder().createSimpleWorkbook({
      headers: ['SKU', 'GTIN', 'Product Name', 'Qty', 'Price', 'Total'],
      rows: [
        ['Customer: TechCorp Industries', '', '', '', '', ''],
        ['', '', '', '', '', ''],
        ['SKU', 'GTIN', 'Product Name', 'Qty', 'Price', 'Total'],
        ['SKU-001', '5901234123457', 'Widget A', 10, 25.50, 255.00],
        ['SKU-002', '4006381333931', 'Widget B', 5, 40.00, 200.00],
        ['SKU-003', '8712345678906', 'Gadget C', 3, 15.75, 47.25],
        ['SKU-004', '0012345678905', 'Component D', 20, 5.25, 105.00],
        ['', '', '', '', 'Grand Total:', 607.25],
      ],
      sheetName: 'Order',
    });
  }

  /**
   * Create order with formulas (should be blocked)
   */
  async createOrderWithFormulas(): Promise<Buffer> {
    return this.createBuilder().createWorkbookWithFormulas();
  }

  /**
   * Create Farsi headers order
   */
  async createFarsiOrder(): Promise<Buffer> {
    return this.createBuilder().createFarsiWorkbook();
  }

  /**
   * Create order with Persian digits
   */
  async createPersianDigitsOrder(): Promise<Buffer> {
    return this.createBuilder().createPersianDigitsWorkbook();
  }

  /**
   * Create empty workbook (for error testing)
   */
  async createEmptyWorkbook(): Promise<Buffer> {
    return this.createBuilder().createEmptyWorkbook();
  }

  /**
   * Create order with missing required fields
   */
  async createIncompleteOrder(): Promise<Buffer> {
    return this.createBuilder().createWorkbookWithMissingColumns();
  }
}

// ============================================================================
// Global Test Lifecycle
// ============================================================================

// Shared instances for tests
export let mockBlobStorage: MockBlobStorageClient;
export let mockFingerprintStore: MockFingerprintStore;
export let mockCommitteeProvider: MockCommitteeProvider;
export let testFixtures: TestFixturesFactory;

/**
 * Setup integration test environment
 */
export function setupIntegrationTests(): void {
  beforeAll(async () => {
    // Setup environment
    setupTestEnvironment();

    // Start MSW server
    mockZohoServer.listen({
      onUnhandledRequest: 'warn',
    });

    // Initialize shared instances
    mockBlobStorage = new MockBlobStorageClient();
    mockFingerprintStore = new MockFingerprintStore();
    mockCommitteeProvider = new MockCommitteeProvider();
    testFixtures = new TestFixturesFactory();

    console.log('[Integration Tests] Setup complete');
  });

  afterEach(() => {
    // Reset MSW handlers to defaults
    mockZohoServer.resetHandlers();

    // Clear mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Stop MSW server
    mockZohoServer.close();

    // Clear storage
    mockBlobStorage.clear();
    mockFingerprintStore.clear();
    mockCommitteeProvider.reset();

    console.log('[Integration Tests] Teardown complete');
  });
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate test case ID
 */
export function generateTestCaseId(): string {
  return `test-case-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate test tenant ID
 */
export function generateTestTenantId(): string {
  return `test-tenant-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate test fingerprint (SHA-256 mock)
 */
export function generateTestFingerprint(): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create mock canonical order structure
 */
export function createMockCanonicalOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const caseId = generateTestCaseId();
  const tenantId = generateTestTenantId();

  return {
    meta: {
      case_id: caseId,
      tenant_id: tenantId,
      received_at: new Date().toISOString(),
      source_filename: 'test-order.xlsx',
      file_sha256: generateTestFingerprint(),
      language_hint: 'en',
    },
    customer: {
      input_name: 'ACME Corporation',
      zoho_customer_id: null,
      resolution_status: 'unresolved',
    },
    line_items: [
      {
        row: 0,
        sku: 'SKU-001',
        product_name: 'Widget A',
        quantity: 10,
        unit_price_source: 25.50,
      },
    ],
    confidence: {
      overall: 0.90,
    },
    issues: [],
    ...overrides,
  };
}

/**
 * Wait for async condition
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
