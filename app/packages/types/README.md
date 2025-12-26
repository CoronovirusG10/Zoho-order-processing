# @order-processing/types

TypeScript type definitions for the order processing system.

## Overview

This package provides comprehensive TypeScript types for the Teams → Excel → AI Committee → Zoho Draft Sales Orders application. All types are derived from the JSON schemas in `src/schemas/`.

## Structure

- **`enums.ts`** - All enumeration types including ResolutionStatus, IssueSeverity, IssueCode, CaseStatus, etc.
- **`evidence.ts`** - Evidence types for tracking data sources in spreadsheets
- **`committee.ts`** - AI committee and consensus types
- **`teams.ts`** - Microsoft Teams related types (Uploader, Correlation)
- **`zoho.ts`** - Zoho Books integration types
- **`canonical-order.ts`** - Main CanonicalSalesOrder type and related interfaces
- **`events.ts`** - OrderProcessingEvent types for audit logging
- **`index.ts`** - Central export point for all types

## Key Types

### CanonicalSalesOrder

The core data structure representing a parsed and enriched sales order:

```typescript
import { CanonicalSalesOrder } from '@order-processing/types';

const order: CanonicalSalesOrder = {
  meta: {
    case_id: "case-123",
    tenant_id: "tenant-abc",
    received_at: "2025-01-01T00:00:00Z",
    source_filename: "order.xlsx",
    file_sha256: "abc123...",
  },
  customer: {
    input_name: "Acme Corp",
    resolution_status: ResolutionStatus.Resolved,
    zoho_customer_id: "cust-123",
  },
  line_items: [
    {
      row: 0,
      quantity: 10,
      sku: "SKU-001",
      zoho_item_id: "item-123",
    }
  ],
  confidence: {
    overall: 0.95,
  },
  issues: [],
};
```

### OrderProcessingEvent

Audit event structure for tracking all actions:

```typescript
import { OrderProcessingEvent, ActorType } from '@order-processing/types';

const event: OrderProcessingEvent = {
  ts: "2025-01-01T00:00:00Z",
  event_type: "order.created",
  case_id: "case-123",
  tenant_id: "tenant-abc",
  sequence: 1,
  actor: {
    type: ActorType.User,
    aad_user_id: "user-123",
  },
  data: {
    salesorder_id: "so-123",
  },
};
```

## Usage

```typescript
import {
  CanonicalSalesOrder,
  OrderProcessingEvent,
  ResolutionStatus,
  IssueSeverity,
  IssueCode,
  CaseStatus,
} from '@order-processing/types';
```

## Type Safety

- All types are strictly typed (no `any`)
- Discriminated unions used where appropriate
- Optional fields marked with `?` or `| null`
- Additional properties allowed via index signatures where schemas specify `additionalProperties: true`

## Build

```bash
npm run build
```

Compiles TypeScript to JavaScript with type declarations in `dist/`.

## Schema Source

Types are based on JSON schemas:
- `src/schemas/canonical-sales-order.schema.json`
- `src/schemas/order-processing-event.schema.json`
