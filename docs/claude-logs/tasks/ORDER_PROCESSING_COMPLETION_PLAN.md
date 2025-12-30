# Order Processing App - Completion Plan

**Created**: 2025-12-30T08:30:00Z
**Status**: Analysis Complete, Ready for Implementation

---

## Executive Summary

Based on comprehensive codebase analysis, the order-processing system is **~75% complete** with solid infrastructure and core services operational. The remaining work focuses on wiring together components and implementing persistence for human-in-the-loop interactions.

### Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Infrastructure | 100% | Temporal, Cosmos, Blob, PM2, nginx all operational |
| Parser Service | 100% | ExcelJS with formula detection, evidence packs |
| Committee Service | 100% | Multi-model AI consensus with weighted voting |
| Teams Bot (File Upload) | 95% | Missing selection cards and Cosmos persistence |
| Workflow Orchestration | 90% | 8-step workflow complete, finalizeAudit not wired |
| Activities (Real) | 9/11 | 2 activities are stubs |
| Zoho Service (Library) | 95% | Library complete, API routes are mocks |

### Critical Gaps (Blocking User Path)

1. **applyCorrections/applySelections are stubs** - User corrections not persisted
2. **resolveItems calls non-existent HTTP service** - Item resolution fails
3. **Zoho API tools routes are mocks** - Draft creation returns fake data
4. **Selection cards missing** - Can't present disambiguation to users

---

## Phase 1: CRITICAL - Enable Minimal User Path

These items must be completed for **any** user to successfully complete the flow.

### P1.1 - Refactor resolveItems to Use Zoho Library Directly

**Problem**: `resolveItems` activity makes HTTP calls to `ZOHO_SERVICE_URL` (default `http://localhost:3010`) which doesn't exist.

**Solution**: Refactor to use `@order-processing/zoho` library directly instead of HTTP calls.

**Files to Modify**:
- `/data/order-processing/app/services/workflow/src/activities/resolve-items.ts`

**Implementation**:
```typescript
// Remove HTTP calls
// Import from Zoho library
import { ItemMatcher, ZohoClient } from '@order-processing/zoho';

// Initialize in activity or via dependency injection
const itemMatcher = new ItemMatcher(zohoClient);

// Use directly
const result = await itemMatcher.matchItem({ sku, gtin, name });
```

**Complexity**: Medium
**Dependencies**: None (library already exists)

---

### P1.2 - Implement applyCorrections with Cosmos Persistence

**Problem**: `applyCorrections` logs corrections but does NOT persist them to Cosmos DB.

**Solution**: Load case from CasesRepository, apply corrections, save back.

**Files to Modify**:
- `/data/order-processing/app/services/workflow/src/activities/apply-corrections.ts`

**Implementation**:
```typescript
// 1. Load current case from Cosmos
const caseData = await casesRepository.getCase(caseId, tenantId);

// 2. Apply each correction to canonicalData
for (const correction of corrections) {
  applyJsonPatch(caseData.canonicalData, correction.path, correction.value);
}

// 3. Save updated case
await casesRepository.updateCase(caseId, tenantId, {
  canonicalData: caseData.canonicalData,
  status: 'corrections_applied'
});

// 4. Append event
await eventsRepository.appendEvent({
  caseId,
  type: 'corrections_applied',
  metadata: { corrections }
});
```

**Complexity**: Medium
**Dependencies**: Repositories already exist at `/data/order-processing/app/services/workflow/src/repositories/`

---

### P1.3 - Implement applySelections with Cosmos Persistence

**Problem**: `applySelections` logs selections but does NOT persist them.

**Solution**: Update customer/item IDs in canonicalData and persist.

**Files to Modify**:
- `/data/order-processing/app/services/workflow/src/activities/apply-selections.ts`

**Implementation**:
```typescript
// For customer selection
caseData.canonicalData.customer.zoho_customer_id = selection.zohoCustomerId;
caseData.canonicalData.customer.match_metadata.selection_source = 'user_selected';

// For item selection
const lineItem = caseData.canonicalData.line_items.find(li => li.row === selection.lineRow);
lineItem.zoho_item_id = selection.zohoItemId;
lineItem.match_metadata.selection_source = 'user_selected';

// Persist
await casesRepository.updateCase(caseId, tenantId, { canonicalData, status });
await eventsRepository.appendEvent({ caseId, type: 'selection_applied', metadata: { selection } });
```

**Complexity**: Medium
**Dependencies**: Repositories already exist

---

### P1.4 - Create Customer/Item Selection Adaptive Cards

**Problem**: No cards exist to present disambiguation choices to users.

**Solution**: Create selection cards that display candidates with confidence scores.

**Files to Create**:
- `/data/order-processing/app/services/teams-bot/src/cards/customer-selection-card.ts`
- `/data/order-processing/app/services/teams-bot/src/cards/item-selection-card.ts`

**Files to Modify**:
- `/data/order-processing/app/services/teams-bot/src/handlers/card-submit-handler.ts`

**Card Structure**:
```typescript
// Customer Selection Card
{
  type: "AdaptiveCard",
  body: [
    { type: "TextBlock", text: "Select Customer", weight: "Bolder" },
    { type: "TextBlock", text: "Multiple matches found for: ${customerName}" },
    {
      type: "Input.ChoiceSet",
      id: "selectedCustomerId",
      choices: candidates.map(c => ({
        title: `${c.name} (${c.confidence}% match)`,
        value: c.zohoCustomerId
      }))
    }
  ],
  actions: [
    { type: "Action.Submit", title: "Select", data: { action: "select_customer" } }
  ]
}
```

**Complexity**: Medium
**Dependencies**: Existing card patterns in `/data/order-processing/app/services/teams-bot/src/cards/`

---

## Phase 2: HIGH - Complete Happy Path

These items ensure the happy path works reliably.

### P2.1 - Wire resolveCustomer Dependencies in Worker

**Problem**: `resolveCustomer` falls back to mock because dependencies not initialized.

**Solution**: Initialize ZohoClient and CustomerMatcher in worker startup.

**Files to Modify**:
- `/data/order-processing/app/services/workflow/src/worker.ts`

**Implementation**:
```typescript
import { ZohoClient, CustomerMatcher } from '@order-processing/zoho';
import { initializeResolveCustomerActivity } from './activities/resolve-customer';

// In worker startup
const zohoClient = new ZohoClient(zohoConfig);
await zohoClient.initialize();

const customerMatcher = new CustomerMatcher(zohoClient);
initializeResolveCustomerActivity({
  casesRepository,
  zohoCustomerService: zohoClient,
  customerMatcher
});
```

**Complexity**: Small
**Dependencies**: P1.1 (Zoho integration working)

---

### P2.2 - Fix Teams Bot Cosmos Persistence

**Problem**: `CaseService.createCase()` doesn't persist to Cosmos, `getCaseStatus()` returns null.

**Files to Modify**:
- `/data/order-processing/app/services/teams-bot/src/services/case-service.ts`
- `/data/order-processing/app/services/teams-bot/src/services/conversation-store.ts`

**Implementation**:
```typescript
// In CaseService.createCase()
const cosmosClient = new CosmosClient(endpoint);
const database = cosmosClient.database('order-processing');
const container = database.container('cases');

await container.items.create({
  id: caseId,
  tenantId,
  userId,
  conversationId,
  status: 'created',
  createdAt: new Date().toISOString()
});
```

**Complexity**: Medium
**Dependencies**: Cosmos DB containers already exist

---

### P2.3 - Wire finalizeAudit into Workflow

**Problem**: `finalizeAudit` activity exists but is not called in the workflow.

**Files to Modify**:
- `/data/order-processing/app/services/workflow/src/workflows/order-processing.workflow.ts`

**Implementation**:
```typescript
// After createZohoDraft success
const auditResult = await proxyActivities<typeof activities>({
  startToCloseTimeout: '60 seconds',
  retry: { maximumAttempts: 3 }
}).finalizeAudit({
  caseId: input.caseId,
  tenantId: input.tenantId,
  userId: input.userId,
  correlationId: input.correlationId
});

// Include in completion notification
notifyInput.auditManifestPath = auditResult.manifestPath;
```

**Complexity**: Small
**Dependencies**: None

---

## Phase 3: MEDIUM - Production Hardening

These items improve reliability and compliance.

### P3.1 - Cosmos Persistence for Zoho Retry Queue

**Problem**: Retry queue and fingerprint store are in-memory only.

**Files to Modify**:
- `/data/order-processing/app/services/zoho/src/client.ts`

**Solution**: Wire CosmosRetryQueue and FingerprintStore (implementations exist, just not wired).

**Complexity**: Medium

---

### P3.2 - Blob Audit Logging

**Problem**: API clients log to console instead of Blob storage.

**Files to Modify**:
- `/data/order-processing/app/services/zoho/src/api/sales-orders.ts`
- `/data/order-processing/app/services/zoho/src/api/customers.ts`
- `/data/order-processing/app/services/zoho/src/api/items.ts`

**Solution**: Wire BlobAuditStore (implementation exists at `/data/order-processing/app/services/zoho/src/storage/blob-audit-store.ts`).

**Complexity**: Small

---

### P3.3 - Implement Cancel Command

**Problem**: Cancel command listed in manifest but not implemented.

**Files to Modify**:
- `/data/order-processing/app/services/teams-bot/src/handlers/message-handler.ts`

**Solution**: Handle 'cancel' command, send Temporal cancellation signal.

**Complexity**: Small

---

## Dependency Graph

```
Phase 1:
  P1.1 (Zoho Library) ─┬─> P1.2 (applyCorrections)
                       └─> P1.3 (applySelections)
  P1.4 (Selection Cards) ─> enables user to respond to ambiguity

Phase 2:
  P2.1 (Wire Dependencies) ─> requires P1.1
  P2.2 (Bot Cosmos) ─> independent
  P2.3 (finalizeAudit) ─> independent

Phase 3:
  All independent, can be done in parallel
```

---

## Implementation Order (Recommended)

1. **P1.1** - Refactor resolveItems (unblocks item resolution)
2. **P2.1** - Wire resolveCustomer dependencies (unblocks customer resolution)
3. **P1.2 + P1.3** - Implement applyCorrections/applySelections in parallel
4. **P1.4** - Create selection cards
5. **P2.2** - Fix Teams bot Cosmos persistence
6. **P2.3** - Wire finalizeAudit
7. **Phase 3** - Production hardening (parallel)

---

## Success Criteria

End-to-end test passes:
1. User uploads Excel in Teams personal chat
2. File stored to Blob with SHA-256 hash
3. Case created in Cosmos DB
4. Temporal workflow started
5. Excel parsed, formula blocking works
6. Committee review completes
7. Customer resolved (or selection card shown if ambiguous)
8. Items resolved (or selection card shown if ambiguous)
9. Corrections can be submitted and persisted
10. Approval card shown with preview
11. Zoho draft created on approval
12. Success card shows Zoho order ID
13. Audit bundle created in Blob

---

## Environment Variables Required

```bash
# Azure
COSMOS_ENDPOINT=https://cosmos-visionarylab.documents.azure.com:443/
AZURE_STORAGE_ACCOUNT_NAME=pippaistoragedev

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Teams Bot
MICROSOFT_APP_ID=<bot-app-id>
MICROSOFT_APP_PASSWORD=<bot-app-password>
MICROSOFT_APP_TENANT_ID=<tenant-id>

# Zoho (from Key Vault or env)
ZOHO_CLIENT_ID=<client-id>
ZOHO_CLIENT_SECRET=<client-secret>
ZOHO_REFRESH_TOKEN=<refresh-token>
ZOHO_ORGANIZATION_ID=<org-id>
ZOHO_REGION=eu

# Optional
GTIN_CUSTOM_FIELD_ID=<zoho-custom-field-id>
```

---

## Notes

- Infrastructure is 100% operational - no infrastructure work needed
- Parser and Committee services are production-ready
- Main work is wiring components together and fixing persistence
- Estimated total effort: 8-12 hours of focused implementation
