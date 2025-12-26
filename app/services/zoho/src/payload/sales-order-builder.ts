/**
 * Sales Order Payload Builder
 *
 * Constructs Zoho Books sales order payloads from canonical sales orders.
 * CRITICAL: Always uses Zoho item rates, never spreadsheet prices.
 * Includes idempotency fingerprint in custom fields.
 */

import { createHash } from 'crypto';
import { ZohoSalesOrderPayload } from '../types.js';

/**
 * Canonical sales order structure (simplified - should import from @order-processing/types)
 */
export interface CanonicalSalesOrder {
  meta: {
    case_id: string;
    file_sha256: string;
    received_at: string;
    correlation_id?: string;
  };
  customer: {
    spreadsheet_name: string | null; // Original name from spreadsheet
    zoho_customer_id: string | null;
    zoho_customer_name: string | null;
  };
  line_items: Array<{
    row: number;
    sku: string | null;
    gtin: string | null;
    product_name: string | null;
    quantity: number;
    unit_price_spreadsheet: number | null; // Original price from spreadsheet (AUDIT ONLY)
    zoho_item_id: string | null;
    zoho_item_name: string | null;
    unit_price_zoho: number | null; // Zoho rate from cache (USED FOR ORDER)
  }>;
}

/**
 * Price audit record for compliance
 */
export interface PriceAuditRecord {
  case_id: string;
  correlation_id?: string;
  timestamp: string;
  customer: {
    spreadsheet_name: string;
    zoho_customer_id: string;
    zoho_customer_name: string;
  };
  line_items: Array<{
    row: number;
    sku: string | null;
    gtin: string | null;
    product_name: string | null;
    quantity: number;
    spreadsheet_price: number | null;
    zoho_item_id: string;
    zoho_item_name: string;
    zoho_rate: number;
    price_difference: number | null;
  }>;
  totals: {
    spreadsheet_total: number | null;
    zoho_total: number;
    difference: number | null;
  };
}

export interface SalesOrderBuilderOptions {
  externalOrderKeyFieldId?: string; // Custom field ID for external order key
  includeSourcePricesInNotes?: boolean; // Include spreadsheet prices in notes for audit
  defaultShipmentDaysOffset?: number; // Default days to add to order date for shipment
}

export class SalesOrderBuilder {
  private readonly options: Required<SalesOrderBuilderOptions>;

  constructor(options: SalesOrderBuilderOptions = {}) {
    this.options = {
      externalOrderKeyFieldId: options.externalOrderKeyFieldId || 'cf_external_order_key',
      includeSourcePricesInNotes: options.includeSourcePricesInNotes ?? false,
      defaultShipmentDaysOffset: options.defaultShipmentDaysOffset ?? 7,
    };
  }

  /**
   * Build a Zoho sales order payload from canonical sales order
   * Uses Zoho item rates (NOT spreadsheet prices)
   */
  buildSalesOrderPayload(
    order: CanonicalSalesOrder,
    itemRates: Map<string, number>
  ): ZohoSalesOrderPayload {
    if (!order.customer.zoho_customer_id) {
      throw new Error('Customer must be resolved before building payload');
    }

    // Validate all line items have resolved items and rates
    const lineItems = order.line_items.map((line) => {
      if (!line.zoho_item_id) {
        throw new Error(`Line ${line.row}: Item not resolved`);
      }

      const rate = itemRates.get(line.zoho_item_id);
      if (rate === undefined) {
        throw new Error(`Line ${line.row}: Rate not found for item ${line.zoho_item_id}`);
      }

      return {
        item_id: line.zoho_item_id,
        quantity: line.quantity,
        rate: rate, // CRITICAL: Use Zoho rate, not spreadsheet price
      };
    });

    // Calculate dates
    const orderDate = this.formatDate(new Date());
    const shipmentDate = this.formatDate(
      this.addDays(new Date(), this.options.defaultShipmentDaysOffset)
    );

    // Build custom fields
    const customFields = [
      {
        customfield_id: this.options.externalOrderKeyFieldId,
        value: order.meta.case_id,
      },
    ];

    // Build notes if configured
    let notes: string | undefined;
    if (this.options.includeSourcePricesInNotes) {
      notes = this.buildAuditNotes(order);
    }

    return {
      customer_id: order.customer.zoho_customer_id,
      date: orderDate,
      shipment_date: shipmentDate,
      reference_number: order.meta.case_id,
      line_items: lineItems,
      custom_fields: customFields,
      notes,
    };
  }

  /**
   * Compute fingerprint for idempotency checking
   * Combines: file SHA256 + customer ID + normalized line items + date bucket
   */
  computeFingerprint(order: CanonicalSalesOrder): string {
    const components: string[] = [
      order.meta.file_sha256,
      order.customer.zoho_customer_id || '',
      this.computeLineItemsHash(order.line_items),
      this.getDateBucket(order.meta.received_at),
    ];

    const combined = components.join(':');
    return this.sha256(combined);
  }

  /**
   * Compute a stable hash of line items (order-independent)
   */
  private computeLineItemsHash(
    lines: CanonicalSalesOrder['line_items']
  ): string {
    // Sort lines by item_id to ensure consistent ordering
    const sorted = [...lines].sort((a, b) => {
      const aId = a.zoho_item_id || '';
      const bId = b.zoho_item_id || '';
      return aId.localeCompare(bId);
    });

    // Create normalized representation
    const normalized = sorted.map((line) => ({
      item: line.zoho_item_id,
      qty: line.quantity,
    }));

    return this.sha256(JSON.stringify(normalized));
  }

  /**
   * Get date bucket (YYYY-MM-DD) for fingerprinting
   * Orders on the same day with same file and items are considered duplicates
   */
  private getDateBucket(timestamp: string): string {
    const date = new Date(timestamp);
    return this.formatDate(date);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * SHA256 hash
   */
  private sha256(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * Build audit notes with source prices (if enabled)
   */
  private buildAuditNotes(order: CanonicalSalesOrder): string {
    const lines: string[] = [
      'Order imported from spreadsheet',
      `Case ID: ${order.meta.case_id}`,
      `File hash: ${order.meta.file_sha256}`,
      '',
      'Line items:',
    ];

    for (const line of order.line_items) {
      const sourcePrice = line.unit_price_zoho || 0;
      lines.push(
        `- ${line.product_name || 'Unknown'} (${line.sku || 'N/A'}): Qty ${line.quantity}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Build price audit record for compliance
   * Records both spreadsheet prices and Zoho rates for 5+ year retention
   */
  buildPriceAuditRecord(
    order: CanonicalSalesOrder,
    itemRates: Map<string, { rate: number; name: string }>
  ): PriceAuditRecord {
    if (!order.customer.zoho_customer_id || !order.customer.zoho_customer_name) {
      throw new Error('Customer must be resolved before building price audit');
    }

    let spreadsheetTotal: number | null = null;
    let zohoTotal = 0;

    const auditLineItems = order.line_items.map((line) => {
      if (!line.zoho_item_id) {
        throw new Error(`Line ${line.row}: Item not resolved`);
      }

      const itemInfo = itemRates.get(line.zoho_item_id);
      if (!itemInfo) {
        throw new Error(`Line ${line.row}: Rate not found for item ${line.zoho_item_id}`);
      }

      const spreadsheetLineTotal = line.unit_price_spreadsheet !== null
        ? line.unit_price_spreadsheet * line.quantity
        : null;

      const zohoLineTotal = itemInfo.rate * line.quantity;
      zohoTotal += zohoLineTotal;

      if (spreadsheetLineTotal !== null) {
        spreadsheetTotal = (spreadsheetTotal ?? 0) + spreadsheetLineTotal;
      }

      const priceDifference = line.unit_price_spreadsheet !== null
        ? itemInfo.rate - line.unit_price_spreadsheet
        : null;

      return {
        row: line.row,
        sku: line.sku,
        gtin: line.gtin,
        product_name: line.product_name,
        quantity: line.quantity,
        spreadsheet_price: line.unit_price_spreadsheet,
        zoho_item_id: line.zoho_item_id,
        zoho_item_name: itemInfo.name,
        zoho_rate: itemInfo.rate,
        price_difference: priceDifference,
      };
    });

    return {
      case_id: order.meta.case_id,
      correlation_id: order.meta.correlation_id,
      timestamp: new Date().toISOString(),
      customer: {
        spreadsheet_name: order.customer.spreadsheet_name || '',
        zoho_customer_id: order.customer.zoho_customer_id,
        zoho_customer_name: order.customer.zoho_customer_name,
      },
      line_items: auditLineItems,
      totals: {
        spreadsheet_total: spreadsheetTotal,
        zoho_total: zohoTotal,
        difference: spreadsheetTotal !== null ? zohoTotal - spreadsheetTotal : null,
      },
    };
  }

  /**
   * Check if there are price differences between spreadsheet and Zoho
   */
  hasPriceDifferences(auditRecord: PriceAuditRecord): boolean {
    return auditRecord.line_items.some(
      (line) => line.price_difference !== null && line.price_difference !== 0
    );
  }

  /**
   * Get summary of price differences
   */
  getPriceDifferenceSummary(auditRecord: PriceAuditRecord): {
    items_with_differences: number;
    total_items: number;
    total_difference: number | null;
  } {
    const itemsWithDifferences = auditRecord.line_items.filter(
      (line) => line.price_difference !== null && line.price_difference !== 0
    ).length;

    return {
      items_with_differences: itemsWithDifferences,
      total_items: auditRecord.line_items.length,
      total_difference: auditRecord.totals.difference,
    };
  }
}
