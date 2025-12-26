/**
 * Mock Zoho API responses for testing
 */

export const mockCustomers = [
  {
    customer_id: 'cust_001',
    display_name: 'ACME Corporation',
    company_name: 'ACME Corporation',
    email: 'contact@acme.com',
    customer_name: 'ACME Corporation',
    status: 'active'
  },
  {
    customer_id: 'cust_002',
    display_name: 'ACME Corp',
    company_name: 'ACME Corp',
    email: 'info@acmecorp.com',
    status: 'active'
  },
  {
    customer_id: 'cust_003',
    display_name: 'ACME Industries',
    company_name: 'ACME Industries',
    email: 'sales@acmeindustries.com',
    status: 'active'
  },
  {
    customer_id: 'cust_004',
    display_name: 'TechCorp Industries',
    company_name: 'TechCorp Industries',
    email: 'contact@techcorp.com',
    status: 'active'
  },
  {
    customer_id: 'cust_005',
    display_name: 'شرکت نمونه',
    company_name: 'شرکت نمونه',
    email: 'info@example.ir',
    status: 'active'
  }
];

export const mockItems = [
  {
    item_id: 'item_001',
    sku: 'SKU-001',
    name: 'Widget A',
    description: 'Standard widget model A',
    rate: 25.50,
    cf_gtin: '5901234123457',
    status: 'active',
    unit: 'pcs'
  },
  {
    item_id: 'item_002',
    sku: 'SKU-002',
    name: 'Widget B',
    description: 'Premium widget model B',
    rate: 40.00,
    cf_gtin: '4006381333931',
    status: 'active',
    unit: 'pcs'
  },
  {
    item_id: 'item_003',
    sku: 'SKU-003',
    name: 'Gadget C',
    description: 'Multi-purpose gadget',
    rate: 15.75,
    cf_gtin: '8712345678906',
    status: 'active',
    unit: 'pcs'
  },
  {
    item_id: 'item_004',
    sku: 'SKU-004',
    name: 'Component D',
    description: 'Electronic component',
    rate: 5.25,
    cf_gtin: '0012345678905',
    status: 'active',
    unit: 'pcs'
  }
];

export const mockSalesOrderResponse = {
  code: 0,
  message: 'The sales order has been created.',
  salesorder: {
    salesorder_id: 'SO-001',
    salesorder_number: 'SO-12345',
    customer_id: 'cust_001',
    customer_name: 'ACME Corporation',
    status: 'draft',
    date: '2025-12-25',
    line_items: [
      {
        line_item_id: 'line-001',
        item_id: 'item_001',
        name: 'Widget A',
        sku: 'SKU-001',
        quantity: 10,
        rate: 25.50,
        unit: 'pcs',
        amount: 255.00
      },
      {
        line_item_id: 'line-002',
        item_id: 'item_002',
        name: 'Widget B',
        sku: 'SKU-002',
        quantity: 5,
        rate: 40.00,
        unit: 'pcs',
        amount: 200.00
      }
    ],
    sub_total: 455.00,
    total: 455.00,
    created_time: '2025-12-25T10:30:00Z',
    last_modified_time: '2025-12-25T10:30:00Z'
  }
};

export const mockOAuthTokenResponse = {
  access_token: 'mock_access_token_1234567890',
  token_type: 'Bearer',
  expires_in: 3600,
  api_domain: 'https://www.zohoapis.eu',
  scope: 'ZohoBooks.fullaccess.all'
};

export const mockErrorResponses = {
  unauthorized: {
    code: 57,
    message: 'Invalid OAuth access token'
  },
  notFound: {
    code: 1004,
    message: 'The requested resource does not exist'
  },
  invalidRequest: {
    code: 1,
    message: 'Invalid request: missing required fields'
  },
  rateLimitExceeded: {
    code: 4003,
    message: 'Rate limit exceeded'
  }
};

export function createMockCustomerSearchResponse(searchText: string) {
  const filtered = mockCustomers.filter(c =>
    c.display_name.toLowerCase().includes(searchText.toLowerCase())
  );

  return {
    code: 0,
    message: 'success',
    contacts: filtered,
    page_context: {
      page: 1,
      per_page: 25,
      has_more_page: false
    }
  };
}

export function createMockItemSearchResponse(sku: string) {
  const filtered = mockItems.filter(i => i.sku === sku);

  return {
    code: 0,
    message: 'success',
    items: filtered,
    page_context: {
      page: 1,
      per_page: 25,
      has_more_page: false
    }
  };
}

export function createMockItemGtinSearchResponse(gtin: string) {
  const filtered = mockItems.filter(i => i.cf_gtin === gtin);

  return {
    code: 0,
    message: 'success',
    items: filtered,
    page_context: {
      page: 1,
      per_page: 25,
      has_more_page: false
    }
  };
}
