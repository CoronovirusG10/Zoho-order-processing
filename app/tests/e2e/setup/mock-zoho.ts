import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Mock Zoho API server for E2E tests
 */

export interface MockZohoConfig {
  baseUrl?: string;
  organizationId?: string;
}

export function createMockZohoServer(config: MockZohoConfig = {}) {
  const baseUrl = config.baseUrl || 'https://books.zoho.eu/api/v3';
  const orgId = config.organizationId || 'test-org-id';

  const handlers = [
    // Get customers
    http.get(`${baseUrl}/contacts`, ({ request }) => {
      const url = new URL(request.url);
      const searchName = url.searchParams.get('search_text');

      const mockCustomers = [
        { customer_id: 'cust_001', display_name: 'ACME Corporation', email: 'contact@acme.com' },
        { customer_id: 'cust_002', display_name: 'ACME Corp', email: 'info@acmecorp.com' },
        { customer_id: 'cust_003', display_name: 'TechCorp Industries', email: 'sales@techcorp.com' },
        { customer_id: 'cust_004', display_name: 'شرکت نمونه', email: 'info@example.ir' }
      ];

      const filtered = searchName
        ? mockCustomers.filter(c => c.display_name.toLowerCase().includes(searchName.toLowerCase()))
        : mockCustomers;

      return HttpResponse.json({
        code: 0,
        message: 'success',
        contacts: filtered
      });
    }),

    // Get items
    http.get(`${baseUrl}/items`, ({ request }) => {
      const url = new URL(request.url);
      const sku = url.searchParams.get('sku');

      const mockItems = [
        {
          item_id: 'item_001',
          sku: 'SKU-001',
          name: 'Widget A',
          rate: 25.50,
          cf_gtin: '5901234123457'
        },
        {
          item_id: 'item_002',
          sku: 'SKU-002',
          name: 'Widget B',
          rate: 40.00,
          cf_gtin: '4006381333931'
        },
        {
          item_id: 'item_003',
          sku: 'SKU-003',
          name: 'Gadget C',
          rate: 15.75,
          cf_gtin: '8712345678906'
        }
      ];

      const filtered = sku
        ? mockItems.filter(i => i.sku === sku)
        : mockItems;

      return HttpResponse.json({
        code: 0,
        message: 'success',
        items: filtered
      });
    }),

    // Search items by GTIN (custom field)
    http.get(`${baseUrl}/items/search`, ({ request }) => {
      const url = new URL(request.url);
      const gtin = url.searchParams.get('cf_gtin');

      const mockItems = [
        { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A', rate: 25.50, cf_gtin: '5901234123457' },
        { item_id: 'item_002', sku: 'SKU-002', name: 'Widget B', rate: 40.00, cf_gtin: '4006381333931' }
      ];

      const filtered = gtin
        ? mockItems.filter(i => i.cf_gtin === gtin)
        : [];

      return HttpResponse.json({
        code: 0,
        message: 'success',
        items: filtered
      });
    }),

    // Create sales order
    http.post(`${baseUrl}/salesorders`, async ({ request }) => {
      const body = await request.json() as any;

      // Validate required fields
      if (!body.customer_id || !body.line_items || body.line_items.length === 0) {
        return HttpResponse.json({
          code: 1,
          message: 'Invalid request: missing required fields'
        }, { status: 400 });
      }

      // Mock successful creation
      const mockSalesOrder = {
        salesorder_id: `SO-${Date.now()}`,
        salesorder_number: `SO-${Math.floor(Math.random() * 100000)}`,
        customer_id: body.customer_id,
        customer_name: 'ACME Corporation',
        status: 'draft',
        line_items: body.line_items.map((item: any, idx: number) => ({
          line_item_id: `line-${idx + 1}`,
          item_id: item.item_id,
          name: `Item ${idx + 1}`,
          quantity: item.quantity,
          rate: item.rate || 25.50,
          amount: (item.quantity || 0) * (item.rate || 25.50)
        })),
        total: body.line_items.reduce((sum: number, item: any) =>
          sum + (item.quantity || 0) * (item.rate || 25.50), 0
        ),
        created_time: new Date().toISOString()
      };

      return HttpResponse.json({
        code: 0,
        message: 'The sales order has been created.',
        salesorder: mockSalesOrder
      });
    }),

    // Get specific sales order
    http.get(`${baseUrl}/salesorders/:salesorderId`, ({ params }) => {
      const { salesorderId } = params;

      return HttpResponse.json({
        code: 0,
        message: 'success',
        salesorder: {
          salesorder_id: salesorderId,
          salesorder_number: 'SO-12345',
          status: 'draft',
          customer_id: 'cust_001',
          customer_name: 'ACME Corporation',
          total: 255.00
        }
      });
    }),

    // OAuth token refresh
    http.post('https://accounts.zoho.eu/oauth/v2/token', async ({ request }) => {
      const body = await request.text();
      const params = new URLSearchParams(body);

      if (params.get('grant_type') === 'refresh_token') {
        return HttpResponse.json({
          access_token: 'mock_access_token_' + Date.now(),
          expires_in: 3600,
          token_type: 'Bearer'
        });
      }

      return HttpResponse.json({
        error: 'invalid_grant'
      }, { status: 400 });
    })
  ];

  return setupServer(...handlers);
}

export const mockZohoResponses = {
  customers: [
    { customer_id: 'cust_001', display_name: 'ACME Corporation' },
    { customer_id: 'cust_002', display_name: 'TechCorp Industries' }
  ],
  items: [
    { item_id: 'item_001', sku: 'SKU-001', name: 'Widget A', rate: 25.50, cf_gtin: '5901234123457' },
    { item_id: 'item_002', sku: 'SKU-002', name: 'Widget B', rate: 40.00, cf_gtin: '4006381333931' }
  ],
  salesOrder: {
    salesorder_id: 'SO-001',
    salesorder_number: 'SO-12345',
    status: 'draft',
    customer_id: 'cust_001',
    total: 255.00
  }
};
