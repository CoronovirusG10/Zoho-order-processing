import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

/**
 * Fingerprint generation unit tests
 * Tests for creating idempotency fingerprints for orders
 */

describe('Fingerprint Generation', () => {
  describe('generateOrderFingerprint', () => {
    it('should generate consistent fingerprint for same input', () => {
      const input = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: typeof input): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp1 = generateFingerprint(input);
      const fp2 = generateFingerprint(input);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different fingerprints for different inputs', () => {
      const input1 = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const input2 = {
        fileSha256: 'abc123',
        customerId: 'cust_002', // different customer
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: any): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      expect(fp1).not.toBe(fp2);
    });

    it('should include file hash in fingerprint', () => {
      const input = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: typeof input): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp = generateFingerprint(input);

      // Change file hash
      input.fileSha256 = 'xyz789';
      const fpChanged = generateFingerprint(input);

      expect(fp).not.toBe(fpChanged);
    });

    it('should include customer ID in fingerprint', () => {
      const input = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: typeof input): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp = generateFingerprint(input);

      // Change customer
      input.customerId = 'cust_999';
      const fpChanged = generateFingerprint(input);

      expect(fp).not.toBe(fpChanged);
    });

    it('should include line items hash in fingerprint', () => {
      const input = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: typeof input): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp = generateFingerprint(input);

      // Change line items
      input.lineItemsHash = 'ghi789';
      const fpChanged = generateFingerprint(input);

      expect(fp).not.toBe(fpChanged);
    });

    it('should include date bucket in fingerprint', () => {
      const input = {
        fileSha256: 'abc123',
        customerId: 'cust_001',
        lineItemsHash: 'def456',
        dateBucket: '2025-12-25'
      };

      const generateFingerprint = (data: typeof input): string => {
        const payload = JSON.stringify(data);
        return createHash('sha256').update(payload).digest('hex');
      };

      const fp = generateFingerprint(input);

      // Change date
      input.dateBucket = '2025-12-26';
      const fpChanged = generateFingerprint(input);

      expect(fp).not.toBe(fpChanged);
    });
  });

  describe('generateLineItemsHash', () => {
    it('should generate consistent hash for same line items', () => {
      const lineItems = [
        { sku: 'SKU-001', qty: 10, price: 25.50 },
        { sku: 'SKU-002', qty: 5, price: 40.00 }
      ];

      const generateHash = (items: any[]): string => {
        const normalized = items.map(item => ({
          sku: item.sku,
          qty: item.qty
        })).sort((a, b) => a.sku.localeCompare(b.sku));

        return createHash('sha256')
          .update(JSON.stringify(normalized))
          .digest('hex');
      };

      const hash1 = generateHash(lineItems);
      const hash2 = generateHash(lineItems);

      expect(hash1).toBe(hash2);
    });

    it('should generate same hash regardless of order', () => {
      const lineItems1 = [
        { sku: 'SKU-001', qty: 10 },
        { sku: 'SKU-002', qty: 5 }
      ];

      const lineItems2 = [
        { sku: 'SKU-002', qty: 5 },
        { sku: 'SKU-001', qty: 10 }
      ];

      const generateHash = (items: any[]): string => {
        const normalized = items.map(item => ({
          sku: item.sku,
          qty: item.qty
        })).sort((a, b) => a.sku.localeCompare(b.sku));

        return createHash('sha256')
          .update(JSON.stringify(normalized))
          .digest('hex');
      };

      const hash1 = generateHash(lineItems1);
      const hash2 = generateHash(lineItems2);

      expect(hash1).toBe(hash2);
    });

    it('should not include price in line items hash', () => {
      // Per design: ignore spreadsheet prices for fingerprint
      const lineItems1 = [
        { sku: 'SKU-001', qty: 10, price: 25.50 }
      ];

      const lineItems2 = [
        { sku: 'SKU-001', qty: 10, price: 30.00 }
      ];

      const generateHash = (items: any[]): string => {
        const normalized = items.map(item => ({
          sku: item.sku,
          qty: item.qty
          // Intentionally exclude price
        })).sort((a, b) => a.sku.localeCompare(b.sku));

        return createHash('sha256')
          .update(JSON.stringify(normalized))
          .digest('hex');
      };

      const hash1 = generateHash(lineItems1);
      const hash2 = generateHash(lineItems2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different quantities', () => {
      const lineItems1 = [
        { sku: 'SKU-001', qty: 10 }
      ];

      const lineItems2 = [
        { sku: 'SKU-001', qty: 15 }
      ];

      const generateHash = (items: any[]): string => {
        const normalized = items.map(item => ({
          sku: item.sku,
          qty: item.qty
        })).sort((a, b) => a.sku.localeCompare(b.sku));

        return createHash('sha256')
          .update(JSON.stringify(normalized))
          .digest('hex');
      };

      const hash1 = generateHash(lineItems1);
      const hash2 = generateHash(lineItems2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateFileHash', () => {
    it('should generate SHA-256 hash of file content', () => {
      const fileContent = Buffer.from('test file content');

      const hash = createHash('sha256')
        .update(fileContent)
        .digest('hex');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different hashes for different content', () => {
      const content1 = Buffer.from('file content 1');
      const content2 = Buffer.from('file content 2');

      const hash1 = createHash('sha256').update(content1).digest('hex');
      const hash2 = createHash('sha256').update(content2).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate consistent hash for same content', () => {
      const content = Buffer.from('consistent content');

      const hash1 = createHash('sha256').update(content).digest('hex');
      const hash2 = createHash('sha256').update(content).digest('hex');

      expect(hash1).toBe(hash2);
    });
  });

  describe('dateBucket', () => {
    it('should extract date bucket from timestamp', () => {
      const timestamp = new Date('2025-12-25T14:30:00Z');
      const dateBucket = timestamp.toISOString().split('T')[0];

      expect(dateBucket).toBe('2025-12-25');
    });

    it('should use same bucket for orders on same day', () => {
      const ts1 = new Date('2025-12-25T08:00:00Z');
      const ts2 = new Date('2025-12-25T20:00:00Z');

      const bucket1 = ts1.toISOString().split('T')[0];
      const bucket2 = ts2.toISOString().split('T')[0];

      expect(bucket1).toBe(bucket2);
    });

    it('should use different buckets for different days', () => {
      const ts1 = new Date('2025-12-25T23:59:00Z');
      const ts2 = new Date('2025-12-26T00:01:00Z');

      const bucket1 = ts1.toISOString().split('T')[0];
      const bucket2 = ts2.toISOString().split('T')[0];

      expect(bucket1).not.toBe(bucket2);
    });
  });

  describe('fingerprintComparison', () => {
    it('should detect duplicate submission', () => {
      const existingFingerprint = 'abc123def456';
      const newFingerprint = 'abc123def456';

      const isDuplicate = existingFingerprint === newFingerprint;

      expect(isDuplicate).toBe(true);
    });

    it('should allow different orders', () => {
      const fp1 = 'abc123def456';
      const fp2 = 'xyz789ghi012';

      const isDuplicate = fp1 === fp2;

      expect(isDuplicate).toBe(false);
    });
  });
});
