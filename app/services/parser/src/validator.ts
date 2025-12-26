/**
 * Validation
 * - Required fields
 * - Arithmetic tolerance checks
 * - Qty=0 is OK (no warning)
 * - Missing customer → issue
 * - Unresolved items → issue
 */

import { CanonicalSalesOrder, Issue, LineItem } from './types';

const ARITHMETIC_ABSOLUTE_TOLERANCE = 0.02;
const ARITHMETIC_RELATIVE_TOLERANCE = 0.01;

export function validate(order: CanonicalSalesOrder): Issue[] {
  const issues: Issue[] = [];

  // Validate customer
  issues.push(...validateCustomer(order));

  // Validate line items
  issues.push(...validateLineItems(order.line_items));

  // Validate arithmetic
  issues.push(...validateArithmetic(order.line_items));

  // Validate totals if present
  if (order.totals) {
    issues.push(...validateTotals(order));
  }

  return issues;
}

function validateCustomer(order: CanonicalSalesOrder): Issue[] {
  const issues: Issue[] = [];

  if (!order.customer.input_name) {
    issues.push({
      code: 'MISSING_CUSTOMER',
      severity: 'error',
      message: 'Customer name not found in spreadsheet',
      fields: ['customer'],
      evidence: order.customer.evidence,
      suggested_user_action: 'Please provide the customer name'
    });
  }

  return issues;
}

function validateLineItems(lineItems: LineItem[]): Issue[] {
  const issues: Issue[] = [];

  if (lineItems.length === 0) {
    issues.push({
      code: 'NO_LINE_ITEMS',
      severity: 'blocker',
      message: 'No line items found in spreadsheet',
      suggested_user_action: 'Please ensure the spreadsheet contains order lines'
    });
    return issues;
  }

  for (const item of lineItems) {
    // Check for required fields
    if (item.quantity === null || item.quantity === undefined) {
      issues.push({
        code: 'MISSING_QUANTITY',
        severity: 'error',
        message: `Line ${item.row + 1}: Quantity is missing`,
        fields: ['quantity'],
        evidence: item.evidence.quantity ? [item.evidence.quantity] : [],
        suggested_user_action: 'Please provide the quantity for this line'
      });
    }

    // Check if we have either SKU or GTIN
    if (!item.sku && !item.gtin) {
      issues.push({
        code: 'MISSING_ITEM_IDENTIFIER',
        severity: 'error',
        message: `Line ${item.row + 1}: Neither SKU nor GTIN found`,
        fields: ['sku', 'gtin'],
        evidence: [
          ...(item.evidence.sku ? [item.evidence.sku] : []),
          ...(item.evidence.gtin ? [item.evidence.gtin] : [])
        ],
        suggested_user_action: 'Please provide either SKU or GTIN for this item'
      });
    }

    // Note: Qty=0 is VALID and should NOT generate a warning
    // Only flag negative quantities
    if (item.quantity !== null && item.quantity < 0) {
      issues.push({
        code: 'NEGATIVE_QUANTITY',
        severity: 'warning',
        message: `Line ${item.row + 1}: Quantity is negative (${item.quantity})`,
        fields: ['quantity'],
        evidence: item.evidence.quantity ? [item.evidence.quantity] : [],
        suggested_user_action: 'Please verify the quantity is correct'
      });
    }
  }

  return issues;
}

function validateArithmetic(lineItems: LineItem[]): Issue[] {
  const issues: Issue[] = [];

  for (const item of lineItems) {
    // Skip if missing required fields for arithmetic check
    if (item.quantity === null || item.unit_price_source === null) {
      continue;
    }

    // If line_total exists, check: qty * unit_price ≈ line_total
    if (item.line_total_source !== null) {
      const calculated = item.quantity * item.unit_price_source;
      const actual = item.line_total_source;

      if (!approxEqual(calculated, actual)) {
        const diff = Math.abs(calculated - actual);
        issues.push({
          code: 'ARITHMETIC_MISMATCH',
          severity: 'warning',
          message: `Line ${item.row + 1}: Calculated total (${calculated.toFixed(2)}) differs from spreadsheet total (${actual.toFixed(2)}) by ${diff.toFixed(2)}`,
          fields: ['quantity', 'unit_price_source', 'line_total_source'],
          evidence: [
            ...(item.evidence.quantity ? [item.evidence.quantity] : []),
            ...(item.evidence.unit_price_source ? [item.evidence.unit_price_source] : []),
            ...(item.evidence.line_total_source ? [item.evidence.line_total_source] : [])
          ],
          suggested_user_action: 'Please verify the quantity, unit price, and line total'
        });
      }
    }
  }

  return issues;
}

function validateTotals(order: CanonicalSalesOrder): Issue[] {
  const issues: Issue[] = [];

  // Calculate sum of line totals
  let calculatedTotal = 0;
  for (const item of order.line_items) {
    if (item.line_total_source !== null) {
      calculatedTotal += item.line_total_source;
    }
  }

  // Compare with spreadsheet subtotal/total
  const totals = order.totals;
  if (totals && totals.subtotal_source !== null && totals.subtotal_source !== undefined) {
    if (!approxEqual(calculatedTotal, totals.subtotal_source)) {
      const diff = Math.abs(calculatedTotal - totals.subtotal_source);
      issues.push({
        code: 'SUBTOTAL_MISMATCH',
        severity: 'warning',
        message: `Calculated subtotal (${calculatedTotal.toFixed(2)}) differs from spreadsheet subtotal (${totals.subtotal_source.toFixed(2)}) by ${diff.toFixed(2)}`,
        fields: ['subtotal'],
        evidence: totals.evidence?.subtotal_source ? [totals.evidence.subtotal_source] : [],
        suggested_user_action: 'Please verify the line totals and subtotal'
      });
    }
  }

  if (totals && totals.total_source !== null && totals.total_source !== undefined) {
    // Total should be subtotal + tax
    let expectedTotal = totals.subtotal_source ?? calculatedTotal;
    if (totals.tax_total_source !== null && totals.tax_total_source !== undefined) {
      expectedTotal += totals.tax_total_source;
    }

    if (!approxEqual(expectedTotal, totals.total_source)) {
      const diff = Math.abs(expectedTotal - totals.total_source);
      issues.push({
        code: 'TOTAL_MISMATCH',
        severity: 'warning',
        message: `Calculated total (${expectedTotal.toFixed(2)}) differs from spreadsheet total (${totals.total_source.toFixed(2)}) by ${diff.toFixed(2)}`,
        fields: ['total'],
        evidence: totals.evidence?.total_source ? [totals.evidence.total_source] : [],
        suggested_user_action: 'Please verify the subtotal, tax, and total'
      });
    }
  }

  return issues;
}

function approxEqual(a: number, b: number): boolean {
  const absDiff = Math.abs(a - b);
  const threshold = Math.max(ARITHMETIC_ABSOLUTE_TOLERANCE, ARITHMETIC_RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b)));
  return absDiff <= threshold;
}

/**
 * Check if there are any blocking issues
 */
export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some(issue => issue.severity === 'blocker');
}

/**
 * Get issue counts by severity
 */
export function getIssueCounts(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = {
    blocker: 0,
    error: 0,
    warning: 0,
    info: 0
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}
