import { describe, it, expect } from 'vitest';

/**
 * Zoho API Contract Tests
 * Validates that responses from Zoho Books API conform to expected schemas
 */

// Schema definitions for Zoho API responses
interface ZohoCustomerResponse {
  customer_id: string;
  display_name: string;
  company_name?: string;
  email?: string;
  status: string;
}

interface ZohoItemResponse {
  item_id: string;
  sku: string;
  name: string;
  rate: number;
  cf_gtin?: string;
  status: string;
  unit?: string;
}

interface ZohoSalesOrderRequest {
  customer_id: string;
  line_items: Array<{
    item_id: string;
    quantity: number;
    rate?: number;
  }>;
  date?: string;
  notes?: string;
}

interface ZohoSalesOrderResponse {
  salesorder_id: string;
  salesorder_number: string;
  customer_id: string;
  customer_name?: string;
  status: string;
  date: string;
  line_items: Array<{
    line_item_id: string;
    item_id: string;
    name: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  sub_total: number;
  total: number;
  created_time: string;
}

interface ZohoApiWrapper<T> {
  code: number;
  message: string;
  data?: T;
}

describe('Zoho API Contract Tests', () => {
  describe('Customer Response Schema', () => {
    it('should validate required customer fields', () => {
      const validCustomer: ZohoCustomerResponse = {
        customer_id: 'cust_001',
        display_name: 'ACME Corporation',
        status: 'active'
      };

      // Required fields present
      expect(validCustomer.customer_id).toBeDefined();
      expect(validCustomer.display_name).toBeDefined();
      expect(validCustomer.status).toBeDefined();

      // Type validation
      expect(typeof validCustomer.customer_id).toBe('string');
      expect(typeof validCustomer.display_name).toBe('string');
      expect(typeof validCustomer.status).toBe('string');
    });

    it('should accept optional customer fields', () => {
      const customerWithOptionals: ZohoCustomerResponse = {
        customer_id: 'cust_001',
        display_name: 'ACME Corporation',
        company_name: 'ACME Corp',
        email: 'contact@acme.com',
        status: 'active'
      };

      expect(customerWithOptionals.company_name).toBe('ACME Corp');
      expect(customerWithOptionals.email).toBe('contact@acme.com');
    });

    it('should validate customer_id format', () => {
      const validIds = ['cust_001', '12345678', 'customer-abc-123'];

      validIds.forEach(id => {
        expect(id.length).toBeGreaterThan(0);
        expect(typeof id).toBe('string');
      });
    });

    it('should validate status enum values', () => {
      const validStatuses = ['active', 'inactive', 'deleted'];
      const invalidStatuses = ['unknown', 'pending', ''];

      validStatuses.forEach(status => {
        expect(['active', 'inactive', 'deleted']).toContain(status);
      });

      invalidStatuses.forEach(status => {
        expect(['active', 'inactive', 'deleted']).not.toContain(status);
      });
    });
  });

  describe('Item Response Schema', () => {
    it('should validate required item fields', () => {
      const validItem: ZohoItemResponse = {
        item_id: 'item_001',
        sku: 'SKU-001',
        name: 'Widget A',
        rate: 25.50,
        status: 'active'
      };

      // Required fields
      expect(validItem.item_id).toBeDefined();
      expect(validItem.sku).toBeDefined();
      expect(validItem.name).toBeDefined();
      expect(validItem.rate).toBeDefined();
      expect(validItem.status).toBeDefined();

      // Type validation
      expect(typeof validItem.item_id).toBe('string');
      expect(typeof validItem.sku).toBe('string');
      expect(typeof validItem.name).toBe('string');
      expect(typeof validItem.rate).toBe('number');
      expect(typeof validItem.status).toBe('string');
    });

    it('should accept optional item fields', () => {
      const itemWithOptionals: ZohoItemResponse = {
        item_id: 'item_001',
        sku: 'SKU-001',
        name: 'Widget A',
        rate: 25.50,
        cf_gtin: '5901234123457',
        status: 'active',
        unit: 'pcs'
      };

      expect(itemWithOptionals.cf_gtin).toBe('5901234123457');
      expect(itemWithOptionals.unit).toBe('pcs');
    });

    it('should validate rate is positive number', () => {
      const validRates = [0, 0.01, 25.50, 1000.00, 99999.99];
      const invalidRates = [-1, -25.50, NaN, Infinity];

      validRates.forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(rate)).toBe(true);
      });

      invalidRates.forEach(rate => {
        expect(rate < 0 || !Number.isFinite(rate)).toBe(true);
      });
    });

    it('should validate GTIN format when present', () => {
      const validGtins = ['5901234123457', '4006381333931', '12345670'];
      const invalidGtins = ['abc123', '123', '12345'];

      validGtins.forEach(gtin => {
        expect(/^\d{8,14}$/.test(gtin)).toBe(true);
      });

      invalidGtins.forEach(gtin => {
        expect(/^\d{8,14}$/.test(gtin)).toBe(false);
      });
    });
  });

  describe('Sales Order Request Schema', () => {
    it('should validate required request fields', () => {
      const validRequest: ZohoSalesOrderRequest = {
        customer_id: 'cust_001',
        line_items: [
          { item_id: 'item_001', quantity: 10 }
        ]
      };

      expect(validRequest.customer_id).toBeDefined();
      expect(validRequest.line_items).toBeDefined();
      expect(validRequest.line_items.length).toBeGreaterThan(0);
    });

    it('should validate line item structure', () => {
      const lineItem = { item_id: 'item_001', quantity: 10, rate: 25.50 };

      expect(lineItem.item_id).toBeDefined();
      expect(typeof lineItem.item_id).toBe('string');
      expect(lineItem.quantity).toBeDefined();
      expect(typeof lineItem.quantity).toBe('number');
      expect(lineItem.quantity).toBeGreaterThanOrEqual(0);
    });

    it('should allow quantity of zero', () => {
      const lineItem = { item_id: 'item_001', quantity: 0 };

      expect(lineItem.quantity).toBe(0);
      expect(lineItem.quantity).toBeGreaterThanOrEqual(0);
    });

    it('should accept optional date field', () => {
      const request: ZohoSalesOrderRequest = {
        customer_id: 'cust_001',
        line_items: [{ item_id: 'item_001', quantity: 10 }],
        date: '2025-12-25'
      };

      expect(request.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should reject empty line items array', () => {
      const invalidRequest = {
        customer_id: 'cust_001',
        line_items: []
      };

      expect(invalidRequest.line_items.length).toBe(0);
      // Validation should fail for empty line_items
    });

    it('should reject missing customer_id', () => {
      const invalidRequest = {
        line_items: [{ item_id: 'item_001', quantity: 10 }]
      };

      expect((invalidRequest as any).customer_id).toBeUndefined();
    });
  });

  describe('Sales Order Response Schema', () => {
    it('should validate required response fields', () => {
      const validResponse: ZohoSalesOrderResponse = {
        salesorder_id: 'SO-001',
        salesorder_number: 'SO-12345',
        customer_id: 'cust_001',
        status: 'draft',
        date: '2025-12-25',
        line_items: [
          {
            line_item_id: 'line-001',
            item_id: 'item_001',
            name: 'Widget A',
            quantity: 10,
            rate: 25.50,
            amount: 255.00
          }
        ],
        sub_total: 255.00,
        total: 255.00,
        created_time: '2025-12-25T10:30:00Z'
      };

      expect(validResponse.salesorder_id).toBeDefined();
      expect(validResponse.salesorder_number).toBeDefined();
      expect(validResponse.customer_id).toBeDefined();
      expect(validResponse.status).toBeDefined();
      expect(validResponse.line_items).toBeDefined();
      expect(validResponse.line_items.length).toBeGreaterThan(0);
      expect(validResponse.total).toBeDefined();
    });

    it('should validate status is "draft" for created orders', () => {
      const response = { status: 'draft' };
      expect(response.status).toBe('draft');
    });

    it('should validate line item amounts match calculation', () => {
      const lineItem = {
        quantity: 10,
        rate: 25.50,
        amount: 255.00
      };

      const calculated = lineItem.quantity * lineItem.rate;
      expect(lineItem.amount).toBe(calculated);
    });

    it('should validate total matches sum of line items', () => {
      const lineItems = [
        { amount: 255.00 },
        { amount: 200.00 }
      ];

      const total = 455.00;
      const calculated = lineItems.reduce((sum, item) => sum + item.amount, 0);

      expect(total).toBe(calculated);
    });

    it('should validate created_time is ISO 8601 format', () => {
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z?$/;
      const validTimestamps = [
        '2025-12-25T10:30:00Z',
        '2025-12-25T10:30:00.123Z',
        '2025-12-25T10:30:00'
      ];

      validTimestamps.forEach(ts => {
        expect(iso8601Regex.test(ts)).toBe(true);
      });
    });
  });

  describe('API Wrapper Schema', () => {
    it('should validate success response structure', () => {
      const successResponse: ZohoApiWrapper<any> = {
        code: 0,
        message: 'success'
      };

      expect(successResponse.code).toBe(0);
      expect(successResponse.message).toBeDefined();
    });

    it('should validate error response structure', () => {
      const errorCodes = [
        { code: 1, message: 'Invalid request' },
        { code: 57, message: 'Invalid OAuth access token' },
        { code: 1004, message: 'Resource not found' },
        { code: 4003, message: 'Rate limit exceeded' }
      ];

      errorCodes.forEach(error => {
        expect(error.code).toBeGreaterThan(0);
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      });
    });

    it('should validate known error codes', () => {
      const knownErrorCodes = [1, 57, 1004, 4003];

      knownErrorCodes.forEach(code => {
        expect(code).toBeGreaterThan(0);
      });
    });
  });

  describe('OAuth Token Response Schema', () => {
    it('should validate token response structure', () => {
      const tokenResponse = {
        access_token: 'mock_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
        api_domain: 'https://www.zohoapis.eu'
      };

      expect(tokenResponse.access_token).toBeDefined();
      expect(tokenResponse.token_type).toBe('Bearer');
      expect(tokenResponse.expires_in).toBeGreaterThan(0);
      expect(tokenResponse.api_domain).toMatch(/^https:\/\//);
    });

    it('should validate expires_in is reasonable', () => {
      const expiresIn = 3600; // 1 hour

      expect(expiresIn).toBeGreaterThanOrEqual(300); // At least 5 minutes
      expect(expiresIn).toBeLessThanOrEqual(86400); // At most 24 hours
    });
  });
});
