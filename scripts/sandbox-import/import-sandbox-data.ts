#!/usr/bin/env npx ts-node
/**
 * Sandbox Data Import Script
 *
 * Imports data from sandbox_data_export.zip into Zoho Books sandbox.
 * This script creates customers, products, sales orders, and invoices.
 *
 * IMPORTANT: This is for sandbox population only - not production use.
 *
 * Usage:
 *   npx ts-node scripts/sandbox-import/import-sandbox-data.ts [--dry-run] [--entity <type>]
 *
 * Options:
 *   --dry-run     Validate data without making API calls
 *   --entity      Import specific entity: customers, products, salesorders, invoices
 *   --limit N     Limit number of records to import (for testing)
 */

import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

// Use project root (assumes running from project root or scripts/sandbox-import/)
const PROJECT_ROOT = process.cwd().includes('sandbox-import')
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();

const CONFIG = {
  // Rate limiting: 100 requests/minute = 600ms between requests
  RATE_LIMIT_DELAY_MS: 650,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,

  // Timeout for API calls
  API_TIMEOUT_MS: 30000,

  // Data directory
  DATA_DIR: path.join(PROJECT_ROOT, 'sandbox_data_extracted/sandbox_data'),

  // Log directory
  LOG_DIR: path.join(PROJECT_ROOT, 'docs/claude-logs/daily'),
};

// ============================================================================
// Types
// ============================================================================

interface ImportResult {
  entity: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  duration_ms: number;
}

interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  region: string;
}

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Source data types from export
interface ExportedCustomer {
  contact_id: string;
  contact_name: string;
  company_name: string;
  contact_type: 'customer' | 'vendor' | 'both';
  status: string;
  customer_sub_type?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  currency_code: string;
  payment_terms?: number;
  first_name?: string;
  last_name?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
}

interface ExportedProduct {
  item_id: string;
  name: string;
  item_name?: string;
  category_id?: string;
  category_name?: string;
  unit: string;
  status: string;
  sku: string;
  rate: number;
  purchase_rate: number;
  description?: string;
  purchase_description?: string;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  stock_on_hand?: number;
  available_stock?: number;
  product_type?: string;
  item_type?: string;
  can_be_sold?: boolean;
  can_be_purchased?: boolean;
  track_inventory?: boolean;
}

interface ExportedSalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  total: number;
  quantity: number;
  status: string;
  order_status: string;
  currency_code: string;
  salesperson_name?: string;
  reference_number?: string;
}

interface ExportedInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  status: string;
  currency_code: string;
  reference_number?: string;
}

// ============================================================================
// Zoho API Client
// ============================================================================

class ZohoImportClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;
  private oauthUrl: string;
  private credentials: ZohoCredentials;

  constructor(credentials: ZohoCredentials) {
    this.credentials = credentials;

    // Set regional URLs
    const regionMap: Record<string, { api: string; oauth: string }> = {
      'eu': { api: 'https://www.zohoapis.eu', oauth: 'https://accounts.zoho.eu' },
      'com': { api: 'https://www.zohoapis.com', oauth: 'https://accounts.zoho.com' },
      'in': { api: 'https://www.zohoapis.in', oauth: 'https://accounts.zoho.in' },
      'au': { api: 'https://www.zohoapis.com.au', oauth: 'https://accounts.zoho.com.au' },
      'jp': { api: 'https://www.zohoapis.jp', oauth: 'https://accounts.zoho.jp' },
    };

    const urls = regionMap[credentials.region] || regionMap['com'];
    this.baseUrl = urls.api;
    this.oauthUrl = urls.oauth;
  }

  /**
   * Get valid access token, refreshing if needed
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('  [AUTH] Refreshing access token...');

    const response = await axios.post<ZohoTokenResponse>(
      `${this.oauthUrl}/oauth/v2/token`,
      null,
      {
        params: {
          refresh_token: this.credentials.refreshToken,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          grant_type: 'refresh_token',
        },
        timeout: CONFIG.API_TIMEOUT_MS,
      }
    );

    this.accessToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

    console.log('  [AUTH] Token refreshed successfully');
    return this.accessToken;
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount = 0
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}/books/v3/${endpoint}`,
        params: { organization_id: this.credentials.organizationId },
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        data,
        timeout: CONFIG.API_TIMEOUT_MS,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;

        // Handle rate limiting
        if (axiosError.response?.status === 429) {
          const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '60', 10);
          console.log(`  [RATE_LIMIT] Rate limited, waiting ${retryAfter}s...`);
          await this.delay(retryAfter * 1000);
          return this.apiRequest(method, endpoint, data, retryCount);
        }

        // Retry on transient errors
        if (retryCount < CONFIG.MAX_RETRIES && this.isTransientError(axiosError)) {
          const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
          console.log(`  [RETRY] Attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES}, waiting ${delay}ms...`);
          await this.delay(delay);
          return this.apiRequest(method, endpoint, data, retryCount + 1);
        }

        // Throw with meaningful message
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        throw new Error(`API Error (${axiosError.response?.status}): ${errorMessage}`);
      }
      throw error;
    }
  }

  private isTransientError(error: AxiosError): boolean {
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 || status === 408;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Customer/Contact Operations
  // ===========================================================================

  async createContact(customer: ExportedCustomer): Promise<{ contact_id: string }> {
    const payload = {
      contact_name: customer.contact_name || customer.company_name || 'Unknown',
      company_name: customer.company_name || '',
      contact_type: customer.contact_type || 'customer',
      customer_sub_type: customer.customer_sub_type || 'business',
      payment_terms: customer.payment_terms || 0,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      mobile: customer.mobile || undefined,
      // Use first_name and last_name if available
      first_name: customer.first_name || undefined,
      last_name: customer.last_name || undefined,
    };

    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === undefined || (payload as any)[key] === '') {
        delete (payload as any)[key];
      }
    });

    const response = await this.apiRequest<{ contact: { contact_id: string } }>(
      'POST',
      'contacts',
      payload
    );

    await this.delay(CONFIG.RATE_LIMIT_DELAY_MS);
    return response.contact;
  }

  async listContacts(page = 1, perPage = 200): Promise<ExportedCustomer[]> {
    const response = await this.apiRequest<{ contacts: ExportedCustomer[] }>(
      'GET',
      `contacts?page=${page}&per_page=${perPage}`
    );
    return response.contacts || [];
  }

  // ===========================================================================
  // Item/Product Operations
  // ===========================================================================

  async createItem(product: ExportedProduct): Promise<{ item_id: string }> {
    const payload = {
      name: product.name || product.item_name || 'Unknown Product',
      sku: product.sku || undefined,
      rate: product.rate || 0,
      purchase_rate: product.purchase_rate || 0,
      description: product.description || undefined,
      purchase_description: product.purchase_description || undefined,
      unit: product.unit || 'pcs',
      product_type: product.product_type || 'goods',
      // Note: item_type and inventory settings removed as sandbox doesn't support them
      tax_percentage: product.tax_percentage || 0,
    };

    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === undefined || (payload as any)[key] === '') {
        delete (payload as any)[key];
      }
    });

    const response = await this.apiRequest<{ item: { item_id: string } }>(
      'POST',
      'items',
      payload
    );

    await this.delay(CONFIG.RATE_LIMIT_DELAY_MS);
    return response.item;
  }

  async listItems(page = 1, perPage = 200): Promise<ExportedProduct[]> {
    const response = await this.apiRequest<{ items: ExportedProduct[] }>(
      'GET',
      `items?page=${page}&per_page=${perPage}`
    );
    return response.items || [];
  }

  // ===========================================================================
  // Sales Order Operations (Draft only - no line items in export)
  // ===========================================================================

  async createSalesOrderMinimal(order: ExportedSalesOrder, customerIdMap: Map<string, string>): Promise<{ salesorder_id: string } | null> {
    // Map old customer_id to new customer_id
    const newCustomerId = customerIdMap.get(order.customer_id);
    if (!newCustomerId) {
      console.log(`  [WARN] Customer ${order.customer_id} not found in mapping, skipping order ${order.salesorder_number}`);
      return null;
    }

    // Since we don't have line items in the export, we create a placeholder order
    // with a note indicating it needs line items added
    const payload = {
      customer_id: newCustomerId,
      date: order.date,
      reference_number: order.reference_number || `Imported: ${order.salesorder_number}`,
      notes: `Imported from sandbox export. Original ID: ${order.salesorder_id}, Original Number: ${order.salesorder_number}. Line items not available in export - total was ${order.total} ${order.currency_code} for ${order.quantity} units.`,
      // Create a placeholder line item since Zoho requires at least one
      line_items: [{
        name: 'Placeholder - See Notes',
        quantity: order.quantity || 1,
        rate: order.total / (order.quantity || 1),
        description: `Placeholder for imported order. Original total: ${order.total}`,
      }],
    };

    const response = await this.apiRequest<{ salesorder: { salesorder_id: string } }>(
      'POST',
      'salesorders',
      payload
    );

    await this.delay(CONFIG.RATE_LIMIT_DELAY_MS);
    return response.salesorder;
  }

  // ===========================================================================
  // Invoice Operations (Draft only - no line items in export)
  // ===========================================================================

  async createInvoiceMinimal(invoice: ExportedInvoice, customerIdMap: Map<string, string>): Promise<{ invoice_id: string } | null> {
    // Map old customer_id to new customer_id
    const newCustomerId = customerIdMap.get(invoice.customer_id);
    if (!newCustomerId) {
      console.log(`  [WARN] Customer ${invoice.customer_id} not found in mapping, skipping invoice ${invoice.invoice_number}`);
      return null;
    }

    const payload = {
      customer_id: newCustomerId,
      date: invoice.date,
      due_date: invoice.due_date || invoice.date,
      reference_number: invoice.reference_number || `Imported: ${invoice.invoice_number}`,
      notes: `Imported from sandbox export. Original ID: ${invoice.invoice_id}, Original Number: ${invoice.invoice_number}. Line items not available in export - total was ${invoice.total} ${invoice.currency_code}.`,
      // Create a placeholder line item
      line_items: [{
        name: 'Placeholder - See Notes',
        quantity: 1,
        rate: invoice.total || 0,
        description: `Placeholder for imported invoice. Original total: ${invoice.total}`,
      }],
    };

    const response = await this.apiRequest<{ invoice: { invoice_id: string } }>(
      'POST',
      'invoices',
      payload
    );

    await this.delay(CONFIG.RATE_LIMIT_DELAY_MS);
    return response.invoice;
  }
}

// ============================================================================
// Import Functions
// ============================================================================

async function loadJsonFile<T>(filename: string): Promise<T[]> {
  const filePath = path.join(CONFIG.DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function importCustomers(
  client: ZohoImportClient,
  dryRun: boolean,
  limit?: number
): Promise<{ result: ImportResult; idMap: Map<string, string> }> {
  console.log('\n========================================');
  console.log('IMPORTING CUSTOMERS');
  console.log('========================================\n');

  const startTime = Date.now();
  const customers = await loadJsonFile<ExportedCustomer>('customers.json');
  const toImport = limit ? customers.slice(0, limit) : customers;

  console.log(`Found ${customers.length} customers, importing ${toImport.length}`);

  const result: ImportResult = {
    entity: 'customers',
    total: toImport.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  };

  const idMap = new Map<string, string>();

  for (let i = 0; i < toImport.length; i++) {
    const customer = toImport[i];
    const progress = `[${i + 1}/${toImport.length}]`;

    try {
      if (dryRun) {
        console.log(`${progress} [DRY-RUN] Would create: ${customer.contact_name} (${customer.contact_type})`);
        result.created++;
        idMap.set(customer.contact_id, `dry-run-${customer.contact_id}`);
      } else {
        console.log(`${progress} Creating: ${customer.contact_name} (${customer.contact_type})`);
        const created = await client.createContact(customer);
        idMap.set(customer.contact_id, created.contact_id);
        result.created++;
        console.log(`  -> Created with ID: ${created.contact_id}`);
      }
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ id: customer.contact_id, error: errorMsg });
      console.log(`  -> FAILED: ${errorMsg}`);
    }
  }

  result.duration_ms = Date.now() - startTime;
  return { result, idMap };
}

async function importProducts(
  client: ZohoImportClient,
  dryRun: boolean,
  limit?: number
): Promise<{ result: ImportResult; idMap: Map<string, string> }> {
  console.log('\n========================================');
  console.log('IMPORTING PRODUCTS');
  console.log('========================================\n');

  const startTime = Date.now();
  const products = await loadJsonFile<ExportedProduct>('products.json');
  const toImport = limit ? products.slice(0, limit) : products;

  console.log(`Found ${products.length} products, importing ${toImport.length}`);

  const result: ImportResult = {
    entity: 'products',
    total: toImport.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  };

  const idMap = new Map<string, string>();

  for (let i = 0; i < toImport.length; i++) {
    const product = toImport[i];
    const progress = `[${i + 1}/${toImport.length}]`;

    try {
      if (dryRun) {
        console.log(`${progress} [DRY-RUN] Would create: ${product.name} (SKU: ${product.sku})`);
        result.created++;
        idMap.set(product.item_id, `dry-run-${product.item_id}`);
      } else {
        console.log(`${progress} Creating: ${product.name} (SKU: ${product.sku})`);
        const created = await client.createItem(product);
        idMap.set(product.item_id, created.item_id);
        result.created++;
        console.log(`  -> Created with ID: ${created.item_id}`);
      }
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ id: product.item_id, error: errorMsg });
      console.log(`  -> FAILED: ${errorMsg}`);
    }
  }

  result.duration_ms = Date.now() - startTime;
  return { result, idMap };
}

async function importSalesOrders(
  client: ZohoImportClient,
  customerIdMap: Map<string, string>,
  dryRun: boolean,
  limit?: number
): Promise<ImportResult> {
  console.log('\n========================================');
  console.log('IMPORTING SALES ORDERS');
  console.log('========================================\n');

  const startTime = Date.now();
  const orders = await loadJsonFile<ExportedSalesOrder>('sales_orders_last_30_days.json');
  const toImport = limit ? orders.slice(0, limit) : orders;

  console.log(`Found ${orders.length} sales orders, importing ${toImport.length}`);
  console.log('NOTE: Line items not available in export - creating placeholder orders\n');

  const result: ImportResult = {
    entity: 'salesorders',
    total: toImport.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  };

  for (let i = 0; i < toImport.length; i++) {
    const order = toImport[i];
    const progress = `[${i + 1}/${toImport.length}]`;

    try {
      if (!customerIdMap.has(order.customer_id)) {
        console.log(`${progress} SKIPPED: ${order.salesorder_number} - Customer not imported`);
        result.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`${progress} [DRY-RUN] Would create: ${order.salesorder_number} for ${order.customer_name}`);
        result.created++;
      } else {
        console.log(`${progress} Creating: ${order.salesorder_number} for ${order.customer_name}`);
        const created = await client.createSalesOrderMinimal(order, customerIdMap);
        if (created) {
          result.created++;
          console.log(`  -> Created with ID: ${created.salesorder_id}`);
        } else {
          result.skipped++;
        }
      }
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ id: order.salesorder_id, error: errorMsg });
      console.log(`  -> FAILED: ${errorMsg}`);
    }
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

async function importInvoices(
  client: ZohoImportClient,
  customerIdMap: Map<string, string>,
  dryRun: boolean,
  limit?: number
): Promise<ImportResult> {
  console.log('\n========================================');
  console.log('IMPORTING INVOICES');
  console.log('========================================\n');

  const startTime = Date.now();
  const invoices = await loadJsonFile<ExportedInvoice>('invoices_last_30_days.json');
  const toImport = limit ? invoices.slice(0, limit) : invoices;

  console.log(`Found ${invoices.length} invoices, importing ${toImport.length}`);
  console.log('NOTE: Line items not available in export - creating placeholder invoices\n');

  const result: ImportResult = {
    entity: 'invoices',
    total: toImport.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  };

  for (let i = 0; i < toImport.length; i++) {
    const invoice = toImport[i];
    const progress = `[${i + 1}/${toImport.length}]`;

    try {
      if (!customerIdMap.has(invoice.customer_id)) {
        console.log(`${progress} SKIPPED: ${invoice.invoice_number} - Customer not imported`);
        result.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`${progress} [DRY-RUN] Would create: ${invoice.invoice_number} for ${invoice.customer_name}`);
        result.created++;
      } else {
        console.log(`${progress} Creating: ${invoice.invoice_number} for ${invoice.customer_name}`);
        const created = await client.createInvoiceMinimal(invoice, customerIdMap);
        if (created) {
          result.created++;
          console.log(`  -> Created with ID: ${created.invoice_id}`);
        } else {
          result.skipped++;
        }
      }
    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ id: invoice.invoice_id, error: errorMsg });
      console.log(`  -> FAILED: ${errorMsg}`);
    }
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ============================================================================
// Reporting
// ============================================================================

function printSummary(results: ImportResult[]): void {
  console.log('\n========================================');
  console.log('IMPORT SUMMARY');
  console.log('========================================\n');

  let totalCreated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of results) {
    console.log(`${result.entity.toUpperCase()}:`);
    console.log(`  Total:   ${result.total}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Failed:  ${result.failed}`);
    console.log(`  Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log(`  Errors (first 5):`);
      result.errors.slice(0, 5).forEach(err => {
        console.log(`    - ${err.id}: ${err.error}`);
      });
    }
    console.log();

    totalCreated += result.created;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  console.log('----------------------------------------');
  console.log(`TOTAL CREATED: ${totalCreated}`);
  console.log(`TOTAL SKIPPED: ${totalSkipped}`);
  console.log(`TOTAL FAILED:  ${totalFailed}`);
  console.log('========================================\n');
}

async function writeLogFile(results: ImportResult[]): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const logDir = CONFIG.LOG_DIR;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `${date}.md`);

  const logEntry = `
## Sandbox Import Session: ${new Date().toISOString()}

### Results
${results.map(r => `
#### ${r.entity}
- Total: ${r.total}
- Created: ${r.created}
- Skipped: ${r.skipped}
- Failed: ${r.failed}
- Duration: ${(r.duration_ms / 1000).toFixed(1)}s
${r.errors.length > 0 ? `
**Errors:**
${r.errors.slice(0, 10).map(e => `- ${e.id}: ${e.error}`).join('\n')}
` : ''}`).join('\n')}

---
`;

  fs.appendFileSync(logFile, logEntry);
  console.log(`Log written to: ${logFile}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('ZOHO BOOKS SANDBOX DATA IMPORT');
  console.log('========================================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const entityIndex = args.indexOf('--entity');
  const entityFilter = entityIndex >= 0 ? args[entityIndex + 1] : null;
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : undefined;

  if (dryRun) {
    console.log('*** DRY RUN MODE - No API calls will be made ***\n');
  }

  if (entityFilter) {
    console.log(`Importing only: ${entityFilter}\n`);
  }

  if (limit) {
    console.log(`Limiting to ${limit} records per entity\n`);
  }

  // Load credentials from environment
  const credentials: ZohoCredentials = {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
    organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
    region: process.env.ZOHO_REGION || process.env.ZOHO_DC || 'eu',
  };

  // Validate credentials
  if (!dryRun) {
    const missing = Object.entries(credentials)
      .filter(([key, value]) => !value && key !== 'region')
      .map(([key]) => key);

    if (missing.length > 0) {
      console.error('Missing required environment variables:');
      missing.forEach(key => console.error(`  - ZOHO_${key.toUpperCase()}`));
      console.error('\nSet these variables or use --dry-run to test without API calls.');
      process.exit(1);
    }
  }

  // Verify data files exist
  if (!fs.existsSync(CONFIG.DATA_DIR)) {
    console.error(`Data directory not found: ${CONFIG.DATA_DIR}`);
    console.error('Make sure sandbox_data_export.zip is extracted to sandbox_data_extracted/');
    process.exit(1);
  }

  const client = new ZohoImportClient(credentials);
  const results: ImportResult[] = [];
  let customerIdMap = new Map<string, string>();

  try {
    // Import in order: customers -> products -> sales orders -> invoices

    if (!entityFilter || entityFilter === 'customers') {
      const { result, idMap } = await importCustomers(client, dryRun, limit);
      results.push(result);
      customerIdMap = idMap;
    }

    if (!entityFilter || entityFilter === 'products') {
      const { result } = await importProducts(client, dryRun, limit);
      results.push(result);
    }

    if (!entityFilter || entityFilter === 'salesorders') {
      // Need customer mapping for sales orders
      if (customerIdMap.size === 0 && !dryRun) {
        console.log('\nLoading customer ID mapping from previous import...');
        // For now, we'll skip if no customer mapping
        console.log('WARN: Customer mapping not available. Run customers import first.');
      }
      const result = await importSalesOrders(client, customerIdMap, dryRun, limit);
      results.push(result);
    }

    if (!entityFilter || entityFilter === 'invoices') {
      if (customerIdMap.size === 0 && !dryRun) {
        console.log('WARN: Customer mapping not available. Run customers import first.');
      }
      const result = await importInvoices(client, customerIdMap, dryRun, limit);
      results.push(result);
    }

    // Print summary
    printSummary(results);

    // Write log file
    if (!dryRun) {
      await writeLogFile(results);
    }

  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  }
}

// Run the import
main().catch(console.error);
