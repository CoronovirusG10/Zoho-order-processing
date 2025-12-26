# Type Usage Examples

## Example 1: Creating a CanonicalSalesOrder

```typescript
import {
  CanonicalSalesOrder,
  ResolutionStatus,
  IssueSeverity,
  IssueCode,
} from '@order-processing/types';

const order: CanonicalSalesOrder = {
  meta: {
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    received_at: '2025-01-15T10:30:00Z',
    source_filename: 'sales-order-jan-2025.xlsx',
    file_sha256: 'a'.repeat(64),
    uploader: {
      aad_user_id: 'user-123',
      display_name: 'John Doe',
    },
    correlation: {
      trace_id: 'trace-abc',
      span_id: 'span-xyz',
      teams_activity_id: 'activity-123',
    },
  },
  customer: {
    input_name: 'Acme Corporation',
    resolution_status: ResolutionStatus.Resolved,
    zoho_customer_id: 'cust-789',
    zoho_customer_name: 'Acme Corporation Ltd.',
    match: {
      method: 'exact',
      confidence: 0.98,
    },
    evidence: [
      {
        sheet: 'Orders',
        cell: 'B2',
        raw_value: 'Acme Corporation',
        display_value: 'Acme Corporation',
      },
    ],
  },
  line_items: [
    {
      row: 0,
      source_row_number: 5,
      sku: 'WIDGET-001',
      gtin: '1234567890123',
      product_name: 'Premium Widget',
      quantity: 100,
      unit_price_source: 25.50,
      unit_price_zoho: 25.00,
      line_total_source: 2550.00,
      currency: 'USD',
      zoho_item_id: 'item-456',
      match: {
        status: ResolutionStatus.Resolved,
        method: 'sku',
        confidence: 1.0,
      },
      evidence: {
        sku: {
          sheet: 'Orders',
          cell: 'C5',
          raw_value: 'WIDGET-001',
        },
        quantity: {
          sheet: 'Orders',
          cell: 'E5',
          raw_value: 100,
          number_format: '0',
        },
        unit_price_source: {
          sheet: 'Orders',
          cell: 'F5',
          raw_value: 25.50,
          number_format: '$#,##0.00',
        },
      },
    },
    {
      row: 1,
      source_row_number: 6,
      sku: 'GADGET-002',
      product_name: 'Super Gadget',
      quantity: 50,
      unit_price_source: 15.75,
      zoho_item_id: 'item-789',
      match: {
        status: ResolutionStatus.Resolved,
        method: 'sku',
        confidence: 1.0,
      },
    },
  ],
  totals: {
    subtotal_source: 3337.50,
    tax_total_source: 267.00,
    total_source: 3604.50,
    currency: 'USD',
  },
  schema_inference: {
    selected_sheet: 'Orders',
    table_region: 'A1:G7',
    header_row: 4,
    column_mappings: [
      {
        canonical_field: 'sku',
        source_header: 'Product Code',
        confidence: 0.95,
        method: 'dictionary',
      },
      {
        canonical_field: 'quantity',
        source_header: 'Qty',
        confidence: 0.98,
        method: 'dictionary',
      },
    ],
  },
  confidence: {
    overall: 0.92,
    by_stage: {
      parsing: 1.0,
      schema_inference: 0.95,
      customer_resolution: 0.98,
      item_resolution: 0.90,
    },
    committee: {
      providers_used: ['gpt-4', 'claude-3', 'gemini'],
      consensus: 'unanimous',
    },
  },
  issues: [
    {
      code: IssueCode.ArithmeticMismatch,
      severity: IssueSeverity.Warning,
      message: 'Line total mismatch on row 6: calculated $787.50 but found $787.00',
      fields: ['line_items[1].line_total_source'],
      evidence: [
        {
          sheet: 'Orders',
          cell: 'G6',
          raw_value: 787.00,
        },
      ],
      suggested_user_action: 'Verify the line total for Super Gadget',
    },
  ],
  approvals: {
    approved: true,
    approved_at: '2025-01-15T10:35:00Z',
    approved_by: 'user-123',
    approval_method: 'adaptive_card',
  },
  zoho: {
    organisation_id: 'org-123',
    salesorder_id: 'SO-12345',
    salesorder_number: '2025-001',
    status: 'draft',
  },
};
```

## Example 2: Creating an OrderProcessingEvent

```typescript
import {
  OrderProcessingEvent,
  ActorType,
} from '@order-processing/types';

const event: OrderProcessingEvent = {
  ts: '2025-01-15T10:30:15Z',
  event_type: 'order.file_uploaded',
  case_id: 'case-2025-001',
  tenant_id: 'tenant-abc-123',
  sequence: 1,
  correlation: {
    trace_id: 'trace-abc',
    span_id: 'span-xyz',
    teams_activity_id: 'activity-123',
  },
  actor: {
    type: ActorType.User,
    aad_user_id: 'user-123',
    display_name: 'John Doe',
    ip: '192.168.1.100',
  },
  data: {
    filename: 'sales-order-jan-2025.xlsx',
    file_size_bytes: 45678,
    content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  pointers: {
    file_blob: 'https://storage.example.com/files/abc123',
  },
};
```

## Example 3: Handling Issues

```typescript
import {
  Issue,
  IssueSeverity,
  IssueCode,
  EvidenceCell,
} from '@order-processing/types';

// Blocker issue - prevents order creation
const blockerIssue: Issue = {
  code: IssueCode.MissingCustomer,
  severity: IssueSeverity.Blocker,
  message: 'Customer name not found in spreadsheet',
  fields: ['customer.input_name'],
  suggested_user_action: 'Please add customer name to the spreadsheet or select manually',
};

// Warning issue - can proceed but should review
const warningIssue: Issue = {
  code: IssueCode.AmbiguousItem,
  severity: IssueSeverity.Warning,
  message: 'Multiple items match SKU "ABC-123" in Zoho Books',
  fields: ['line_items[0].sku'],
  evidence: [
    {
      sheet: 'Orders',
      cell: 'C5',
      raw_value: 'ABC-123',
    },
  ],
  suggested_user_action: 'Select the correct item from the candidate list',
};

// Filter issues by severity
function getBlockers(issues: Issue[]): Issue[] {
  return issues.filter(issue => issue.severity === IssueSeverity.Blocker);
}

function canProceed(issues: Issue[]): boolean {
  return getBlockers(issues).length === 0;
}
```

## Example 4: Working with Evidence

```typescript
import {
  EvidenceCell,
  LineItemEvidence,
} from '@order-processing/types';

// Creating evidence for a line item
const lineItemEvidence: LineItemEvidence = {
  sku: {
    sheet: 'Orders',
    cell: 'C5',
    raw_value: 'WIDGET-001',
    display_value: 'WIDGET-001',
  },
  quantity: {
    sheet: 'Orders',
    cell: 'E5',
    raw_value: 100,
    display_value: '100',
    number_format: '0',
  },
  unit_price_source: {
    sheet: 'Orders',
    cell: 'F5',
    raw_value: 25.50,
    display_value: '$25.50',
    number_format: '$#,##0.00',
  },
};

// Helper to format evidence for display
function formatEvidence(evidence: EvidenceCell): string {
  return `${evidence.sheet}!${evidence.cell} = ${evidence.display_value ?? evidence.raw_value}`;
}
```

## Example 5: Committee Consensus

```typescript
import {
  CommitteeResult,
  ConsensusType,
} from '@order-processing/types';

const committeeResult: CommitteeResult = {
  providers_used: ['gpt-4', 'claude-3-opus', 'gemini-1.5-pro'],
  votes: [
    {
      provider: 'gpt-4',
      customer_name: 'Acme Corp',
      confidence: 0.95,
    },
    {
      provider: 'claude-3-opus',
      customer_name: 'Acme Corp',
      confidence: 0.98,
    },
    {
      provider: 'gemini-1.5-pro',
      customer_name: 'Acme Corporation',
      confidence: 0.92,
    },
  ],
  consensus: ConsensusType.Majority,
  disagreements: [
    {
      field: 'customer_name',
      values: ['Acme Corp', 'Acme Corporation'],
      providers: {
        'Acme Corp': ['gpt-4', 'claude-3-opus'],
        'Acme Corporation': ['gemini-1.5-pro'],
      },
    },
  ],
};

// Helper to check consensus strength
function hasStrongConsensus(committee?: CommitteeResult): boolean {
  return committee?.consensus === ConsensusType.Unanimous ||
         committee?.consensus === ConsensusType.Majority;
}
```

## Example 6: Type Guards

```typescript
import {
  CanonicalSalesOrder,
  ResolutionStatus,
  IssueSeverity,
} from '@order-processing/types';

// Check if customer is resolved
function isCustomerResolved(order: CanonicalSalesOrder): boolean {
  return order.customer.resolution_status === ResolutionStatus.Resolved;
}

// Check if order is ready for Zoho
function isReadyForZoho(order: CanonicalSalesOrder): boolean {
  const hasBlockers = order.issues.some(
    issue => issue.severity === IssueSeverity.Blocker
  );
  const customerResolved = isCustomerResolved(order);
  const allItemsResolved = order.line_items.every(
    item => item.match?.status === ResolutionStatus.Resolved
  );

  return !hasBlockers && customerResolved && allItemsResolved;
}

// Get unresolved line items
function getUnresolvedLineItems(order: CanonicalSalesOrder): number[] {
  return order.line_items
    .filter(item => item.match?.status !== ResolutionStatus.Resolved)
    .map(item => item.row);
}
```

## Example 7: Event Streaming

```typescript
import {
  OrderProcessingEvent,
  ActorType,
} from '@order-processing/types';

// Sequence of events for a case
const events: OrderProcessingEvent[] = [
  {
    ts: '2025-01-15T10:30:00Z',
    event_type: 'case.created',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 0,
    actor: { type: ActorType.User, aad_user_id: 'user-123' },
    data: {},
  },
  {
    ts: '2025-01-15T10:30:15Z',
    event_type: 'file.uploaded',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 1,
    actor: { type: ActorType.User, aad_user_id: 'user-123' },
    data: { filename: 'order.xlsx' },
  },
  {
    ts: '2025-01-15T10:30:30Z',
    event_type: 'parsing.started',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 2,
    actor: { type: ActorType.System },
    data: {},
  },
  {
    ts: '2025-01-15T10:30:45Z',
    event_type: 'parsing.completed',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 3,
    actor: { type: ActorType.System },
    data: { line_items_found: 5 },
  },
  {
    ts: '2025-01-15T10:35:00Z',
    event_type: 'order.approved',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 4,
    actor: { type: ActorType.User, aad_user_id: 'user-123' },
    data: { approval_method: 'adaptive_card' },
  },
  {
    ts: '2025-01-15T10:35:15Z',
    event_type: 'zoho.salesorder_created',
    case_id: 'case-2025-001',
    tenant_id: 'tenant-abc-123',
    sequence: 5,
    actor: { type: ActorType.System },
    data: { salesorder_id: 'SO-12345' },
  },
];

// Helper to get events by type
function getEventsByType(
  events: OrderProcessingEvent[],
  eventType: string
): OrderProcessingEvent[] {
  return events.filter(e => e.event_type === eventType);
}

// Get timeline of a case
function getCaseTimeline(events: OrderProcessingEvent[]): string[] {
  return events
    .sort((a, b) => a.sequence - b.sequence)
    .map(e => `${e.ts}: ${e.event_type}`);
}
```
