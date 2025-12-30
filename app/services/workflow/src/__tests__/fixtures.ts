/**
 * Test Fixtures for Order Processing Workflow Tests
 *
 * Centralized test data creation and common test utilities.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  OrderProcessingInput,
  TeamsContext,
  CanonicalOrderData,
  LineItem,
  CustomerCandidate,
  ItemCandidate,
  CommitteeDisagreement,
  ParseIssue,
} from '../workflows/types';

// =============================================================================
// Input Factories
// =============================================================================

/**
 * Creates a valid OrderProcessingInput for testing
 */
export function createOrderInput(overrides: Partial<OrderProcessingInput> = {}): OrderProcessingInput {
  const caseId = `test-case-${uuidv4().slice(0, 8)}`;
  return {
    caseId,
    blobUrl: `https://testaccount.blob.core.windows.net/uploads/${caseId}/order.xlsx`,
    tenantId: 'test-tenant-001',
    userId: 'test-user@example.com',
    correlationId: uuidv4(),
    teams: createTeamsContext(),
    ...overrides,
  };
}

/**
 * Creates a valid TeamsContext for testing
 */
export function createTeamsContext(overrides: Partial<TeamsContext> = {}): TeamsContext {
  return {
    chatId: `chat-${uuidv4().slice(0, 8)}`,
    messageId: `msg-${uuidv4().slice(0, 8)}`,
    activityId: `act-${uuidv4().slice(0, 8)}`,
    ...overrides,
  };
}

// =============================================================================
// Canonical Data Factories
// =============================================================================

/**
 * Creates sample canonical order data
 */
export function createCanonicalOrderData(overrides: Partial<CanonicalOrderData> = {}): CanonicalOrderData {
  return {
    customerInfo: {
      name: 'Acme Corporation Ltd',
      email: 'orders@acme.example.com',
      phone: '+44 20 1234 5678',
      address: '123 Business Park, London, UK',
      taxId: 'GB123456789',
      ...overrides.customerInfo,
    },
    lineItems: overrides.lineItems || [
      createLineItem({ lineNumber: 1, sku: 'SKU-001', description: 'Premium Widget', quantity: 100 }),
      createLineItem({ lineNumber: 2, sku: 'SKU-002', description: 'Standard Gadget', quantity: 50 }),
      createLineItem({ lineNumber: 3, sku: 'SKU-003', description: 'Deluxe Component', quantity: 25 }),
    ],
    orderMeta: {
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      poNumber: 'PO-2024-00123',
      notes: 'Please deliver to loading bay B',
      ...overrides.orderMeta,
    },
  };
}

/**
 * Creates a single line item
 */
export function createLineItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    lineNumber: 1,
    description: 'Test Product',
    quantity: 10,
    unitPrice: 99.99,
    sku: 'TEST-SKU-001',
    gtin: '1234567890123',
    ...overrides,
  };
}

// =============================================================================
// Candidate Factories
// =============================================================================

/**
 * Creates customer candidates for disambiguation testing
 */
export function createCustomerCandidates(count: number = 3): CustomerCandidate[] {
  const names = [
    'Acme Corporation Ltd',
    'Acme Corp',
    'Acme Industries',
    'ACME Inc.',
    'Acme Solutions Ltd',
  ];

  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    zohoCustomerId: `cust-${uuidv4().slice(0, 8)}`,
    zohoCustomerName: names[i],
    score: 0.95 - i * 0.1,
    matchReasons: i === 0 ? ['Exact name match'] : ['Partial name match', 'Similar address'],
  }));
}

/**
 * Creates item candidates for disambiguation testing
 */
export function createItemCandidates(lineNumber: number, count: number = 2): ItemCandidate[] {
  const variants = ['A', 'B', 'C', 'D', 'E'];

  return Array.from({ length: Math.min(count, variants.length) }, (_, i) => ({
    zohoItemId: `item-${uuidv4().slice(0, 8)}`,
    sku: `SKU-${lineNumber.toString().padStart(3, '0')}-${variants[i]}`,
    name: `Product ${lineNumber} Variant ${variants[i]}`,
    gtin: `${12345678901 + i + lineNumber * 100}`.slice(0, 13),
    score: 0.9 - i * 0.1,
    matchReasons: i === 0 ? ['SKU exact match'] : ['SKU partial match', 'Name similarity'],
  }));
}

// =============================================================================
// Committee Factories
// =============================================================================

/**
 * Creates committee disagreements for testing
 */
export function createCommitteeDisagreements(fields: string[] = ['quantity_line_1']): CommitteeDisagreement[] {
  return fields.map((field) => ({
    field,
    votes: {
      'model-gpt-4': '100',
      'model-claude': '10',
      'model-gemini': '100',
    },
    confidence: {
      'model-gpt-4': 0.85,
      'model-claude': 0.75,
      'model-gemini': 0.9,
    },
  }));
}

// =============================================================================
// Parse Issue Factories
// =============================================================================

/**
 * Creates parse issues for testing
 */
export function createParseIssues(severity: 'error' | 'warning' | 'info' = 'warning'): ParseIssue[] {
  const issues: Record<string, ParseIssue[]> = {
    error: [
      {
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
        message: 'Required field "Customer Name" is missing',
        location: { sheet: 'Order', row: 1, column: 'A' },
      },
    ],
    warning: [
      {
        code: 'QUANTITY_FORMAT',
        severity: 'warning',
        message: 'Quantity in row 3 appears to be formatted as text',
        location: { sheet: 'Order', row: 3, column: 'C' },
      },
      {
        code: 'DUPLICATE_SKU',
        severity: 'warning',
        message: 'SKU "SKU-001" appears multiple times',
        location: { sheet: 'Order', row: 5, column: 'B' },
      },
    ],
    info: [
      {
        code: 'EMPTY_CELLS',
        severity: 'info',
        message: 'Some optional fields are empty',
        location: { sheet: 'Order', row: 2, column: 'D' },
      },
    ],
  };

  return issues[severity] || issues.warning;
}

// =============================================================================
// Signal Event Factories
// =============================================================================

/**
 * Creates an approval event for testing
 */
export function createApprovalEvent(caseId: string, approved: boolean = true) {
  return {
    caseId,
    approved,
    approvedBy: 'test-approver@example.com',
    approvedAt: new Date().toISOString(),
    comments: approved ? undefined : 'Order cancelled by user',
  };
}

/**
 * Creates a selections event for testing
 */
export function createSelectionsEvent(
  caseId: string,
  options: {
    customerId?: string;
    items?: Record<number, string>;
  } = {}
) {
  return {
    caseId,
    selections: {
      customer: options.customerId ? { zohoCustomerId: options.customerId } : undefined,
      items: options.items
        ? Object.fromEntries(
            Object.entries(options.items).map(([line, itemId]) => [
              Number(line),
              { zohoItemId: itemId },
            ])
          )
        : undefined,
    },
    submittedBy: 'test-user@example.com',
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Creates a corrections event for testing
 */
export function createCorrectionsEvent(
  caseId: string,
  corrections: Record<string, { original: unknown; corrected: unknown; notes?: string }> = {}
) {
  return {
    caseId,
    corrections: Object.fromEntries(
      Object.entries(corrections).map(([field, data]) => [
        field,
        {
          originalValue: data.original,
          correctedValue: data.corrected,
          notes: data.notes,
        },
      ])
    ),
    submittedBy: 'test-user@example.com',
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Creates a file reuploaded event for testing
 */
export function createFileReuploadedEvent(caseId: string, newBlobUrl?: string) {
  return {
    caseId,
    blobUrl: newBlobUrl || `https://testaccount.blob.core.windows.net/uploads/${caseId}/order-v2.xlsx`,
    correlationId: uuidv4(),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Waits for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock notification logger
 */
export function createNotificationLogger() {
  const notifications: Array<{ caseId: string; type: string; timestamp: Date }> = [];

  return {
    log(caseId: string, type: string) {
      notifications.push({ caseId, type, timestamp: new Date() });
    },
    getNotifications() {
      return [...notifications];
    },
    getNotificationTypes() {
      return notifications.map((n) => n.type);
    },
    hasNotification(type: string) {
      return notifications.some((n) => n.type === type);
    },
    countNotifications(type: string) {
      return notifications.filter((n) => n.type === type).length;
    },
    clear() {
      notifications.length = 0;
    },
  };
}
