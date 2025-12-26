/**
 * Tests for order fingerprint generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateOrderFingerprint,
  generatePartialFingerprint,
  areLineItemsSimilar,
} from '../fingerprint';

describe('generateOrderFingerprint', () => {
  it('should generate consistent fingerprints for same data', () => {
    const data = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [
        { sku: 'SKU-001', quantity: 10 },
        { sku: 'SKU-002', quantity: 5 },
      ],
      orderDate: new Date('2025-12-25T10:00:00Z'),
    };

    const fp1 = generateOrderFingerprint(data);
    const fp2 = generateOrderFingerprint(data);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // SHA-256 hex
  });

  it('should generate different fingerprints for different customers', () => {
    const data1 = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [{ sku: 'SKU-001', quantity: 10 }],
    };

    const data2 = {
      ...data1,
      customerId: 'cust-002',
    };

    expect(generateOrderFingerprint(data1)).not.toBe(generateOrderFingerprint(data2));
  });

  it('should generate same fingerprint regardless of line item order', () => {
    const data1 = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [
        { sku: 'SKU-001', quantity: 10 },
        { sku: 'SKU-002', quantity: 5 },
      ],
    };

    const data2 = {
      ...data1,
      lineItems: [
        { sku: 'SKU-002', quantity: 5 },
        { sku: 'SKU-001', quantity: 10 },
      ],
    };

    expect(generateOrderFingerprint(data1)).toBe(generateOrderFingerprint(data2));
  });

  it('should normalize SKUs before hashing', () => {
    const data1 = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [{ sku: '  sku-001  ', quantity: 10 }],
    };

    const data2 = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [{ sku: 'SKU-001', quantity: 10 }],
    };

    expect(generateOrderFingerprint(data1)).toBe(generateOrderFingerprint(data2));
  });

  it('should bucket by date', () => {
    const data1 = {
      fileSha256: 'abc123',
      customerId: 'cust-001',
      lineItems: [{ sku: 'SKU-001', quantity: 10 }],
      orderDate: new Date('2025-12-25T10:00:00Z'),
    };

    const data2 = {
      ...data1,
      orderDate: new Date('2025-12-25T23:59:59Z'),
    };

    // Same day = same fingerprint
    expect(generateOrderFingerprint(data1)).toBe(generateOrderFingerprint(data2));

    const data3 = {
      ...data1,
      orderDate: new Date('2025-12-26T00:00:00Z'),
    };

    // Different day = different fingerprint
    expect(generateOrderFingerprint(data1)).not.toBe(generateOrderFingerprint(data3));
  });
});

describe('generatePartialFingerprint', () => {
  it('should generate fingerprint without customer ID', () => {
    const fp = generatePartialFingerprint(
      'abc123',
      [{ sku: 'SKU-001', quantity: 10 }],
      new Date('2025-12-25')
    );

    expect(fp).toHaveLength(64);
  });
});

describe('areLineItemsSimilar', () => {
  it('should detect identical line items', () => {
    const items1 = [
      { sku: 'SKU-001', quantity: 10 },
      { sku: 'SKU-002', quantity: 5 },
    ];

    const items2 = [
      { sku: 'SKU-001', quantity: 10 },
      { sku: 'SKU-002', quantity: 5 },
    ];

    expect(areLineItemsSimilar(items1, items2)).toBe(true);
  });

  it('should detect similar line items above threshold', () => {
    const items1 = [
      { sku: 'SKU-001', quantity: 10 },
      { sku: 'SKU-002', quantity: 5 },
      { sku: 'SKU-003', quantity: 3 },
    ];

    const items2 = [
      { sku: 'SKU-001', quantity: 10 },
      { sku: 'SKU-002', quantity: 5 },
    ];

    expect(areLineItemsSimilar(items1, items2, 0.6)).toBe(true);
  });

  it('should detect dissimilar line items', () => {
    const items1 = [{ sku: 'SKU-001', quantity: 10 }];
    const items2 = [{ sku: 'SKU-999', quantity: 10 }];

    expect(areLineItemsSimilar(items1, items2)).toBe(false);
  });

  it('should handle empty arrays', () => {
    expect(areLineItemsSimilar([], [])).toBe(false);
    expect(areLineItemsSimilar([{ sku: 'SKU-001', quantity: 10 }], [])).toBe(false);
  });
});
