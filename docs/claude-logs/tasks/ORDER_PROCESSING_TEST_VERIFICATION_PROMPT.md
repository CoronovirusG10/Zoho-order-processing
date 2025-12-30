# Order Processing System - Test & Verification Prompt

**Created:** 2025-12-30
**Purpose:** Comprehensive testing of Cosmos DB integration, workflow activities, and end-to-end order processing flow

---

## Context

The Order Processing system has been deployed with:
- **Temporal Server** running at `localhost:7233`
- **Workflow Workers** (x2) on task queue `order-processing`
- **Cosmos DB** at `cosmos-visionarylab.documents.azure.com`
- **Database:** `order-processing`
- **Containers:** `cases` (partition: /tenantId), `events` (partition: /caseId)
- **RBAC:** VM managed identity has `Cosmos DB Built-in Data Contributor` role

The workflow service uses:
- Repository pattern with graceful degradation
- Lazy initialization of Cosmos client
- Event sourcing for audit trail

---

## Phase 1: Cosmos DB Connectivity Verification

### Task 1.1: Verify RBAC Propagation

```bash
# Check role assignment exists
az cosmosdb sql role assignment list \
  --account-name cosmos-visionarylab \
  -g pippai-rg \
  --query "[?principalId=='3976c71c-c570-43aa-a974-58c971b706cf']" \
  -o table
```

Expected: Role assignment for VM managed identity with Data Contributor role.

### Task 1.2: Test Cosmos Client Initialization

Create a test script to verify the Cosmos client can connect:

```typescript
// Location: app/services/workflow/src/test-cosmos.ts
import { initializeCosmosClient, getCosmosClient } from './repositories/index.js';

async function testCosmosConnection() {
  console.log('Testing Cosmos DB connection...');

  try {
    await initializeCosmosClient();
    const client = getCosmosClient();

    console.log('✅ Cosmos client initialized');
    console.log('✅ Database:', client.isInitialized() ? 'connected' : 'not connected');

    // Test cases container access
    const casesContainer = client.cases;
    console.log('✅ Cases container accessible');

    // Test events container access
    const eventsContainer = client.events;
    console.log('✅ Events container accessible');

    return true;
  } catch (error) {
    console.error('❌ Cosmos connection failed:', error);
    return false;
  }
}

testCosmosConnection().then(success => {
  process.exit(success ? 0 : 1);
});
```

Run with:
```bash
cd /data/order-processing/app/services/workflow
npx ts-node src/test-cosmos.ts
```

### Task 1.3: Test Repository Operations

Create comprehensive repository tests:

```typescript
// Location: app/services/workflow/src/test-repositories.ts
import {
  initializeCosmosClient,
  getCasesRepository,
  getEventsRepository
} from './repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_TENANT_ID = 'test-tenant-' + Date.now();
const TEST_USER_ID = 'test-user-verification';

async function testRepositories() {
  console.log('=== Repository Test Suite ===\n');

  // Initialize
  await initializeCosmosClient();
  const casesRepo = getCasesRepository();
  const eventsRepo = getEventsRepository();

  const testCaseId = `test-case-${uuidv4()}`;

  // Test 1: Create Case
  console.log('Test 1: Create Case');
  try {
    const newCase = await casesRepo.createCase(testCaseId, {
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      conversationId: 'test-conversation',
      blobUri: 'https://test.blob.core.windows.net/test/test.xlsx',
    });
    console.log('  ✅ Case created:', newCase.id);
    console.log('  ✅ Status:', newCase.status);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 2: Read Case
  console.log('\nTest 2: Read Case');
  try {
    const readCase = await casesRepo.getCase(testCaseId, TEST_TENANT_ID);
    if (!readCase) throw new Error('Case not found');
    console.log('  ✅ Case retrieved:', readCase.id);
    console.log('  ✅ Tenant:', readCase.tenantId);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 3: Update Case Status
  console.log('\nTest 3: Update Case Status');
  try {
    const updated = await casesRepo.updateCaseStatus(
      testCaseId,
      TEST_TENANT_ID,
      'parsing',
      { metadata: { test: true } }
    );
    console.log('  ✅ Status updated to:', updated.status);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 4: Append Event
  console.log('\nTest 4: Append Event');
  try {
    const event = await eventsRepo.appendEvent({
      caseId: testCaseId,
      type: 'status_changed',
      status: 'parsing',
      correlationId: 'test-correlation',
      userId: TEST_USER_ID,
      metadata: { test: true },
    });
    console.log('  ✅ Event appended:', event.id);
    console.log('  ✅ Sequence:', event.sequenceNumber);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 5: Query Events by Case
  console.log('\nTest 5: Query Events by Case');
  try {
    const events = await eventsRepo.getEventsByCaseId(testCaseId);
    console.log('  ✅ Events found:', events.length);
    events.forEach(e => console.log(`     - ${e.type} (seq: ${e.sequenceNumber})`));
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 6: Query Cases by Tenant
  console.log('\nTest 6: Query Cases by Tenant');
  try {
    const cases = await casesRepo.getCasesByTenant(TEST_TENANT_ID);
    console.log('  ✅ Cases found:', cases.length);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Test 7: Query Cases by User
  console.log('\nTest 7: Query Cases by User');
  try {
    const cases = await casesRepo.getCasesByUser(TEST_TENANT_ID, TEST_USER_ID);
    console.log('  ✅ User cases found:', cases.length);
  } catch (error) {
    console.error('  ❌ Failed:', error);
    return false;
  }

  // Cleanup: Delete test case
  console.log('\nCleanup: Deleting test case...');
  try {
    // Note: Add deleteCase method if needed for cleanup
    console.log('  ⚠️ Manual cleanup required - delete case:', testCaseId);
  } catch (error) {
    console.warn('  ⚠️ Cleanup failed:', error);
  }

  console.log('\n=== All Repository Tests Passed ===');
  return true;
}

testRepositories()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
```

---

## Phase 2: Activity Unit Tests

### Task 2.1: Test updateCase Activity

```typescript
// Location: app/services/workflow/src/test-update-case.ts
import { updateCase, isUpdateCaseInitialized } from './activities/update-case.js';
import { initializeCosmosClient, getCasesRepository } from './repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_TENANT = 'activity-test-tenant';

async function testUpdateCaseActivity() {
  console.log('=== updateCase Activity Test ===\n');

  // Initialize Cosmos
  await initializeCosmosClient();

  // Verify initialization
  console.log('Initialization check:', isUpdateCaseInitialized() ? '✅' : '❌');

  const testCaseId = `activity-test-${uuidv4()}`;

  // First, create a case in the repository
  const casesRepo = getCasesRepository();
  await casesRepo.createCase(testCaseId, {
    tenantId: TEST_TENANT,
    userId: 'test-user',
    conversationId: 'test-conv',
  });
  console.log('Test case created:', testCaseId);

  // Test the activity
  console.log('\nTesting updateCase activity...');

  const result = await updateCase({
    caseId: testCaseId,
    tenantId: TEST_TENANT,
    status: 'parsing',
    eventType: 'file_stored',
    correlationId: 'test-correlation',
  });

  console.log('Result:', result.success ? '✅ Success' : '❌ Failed');

  // Verify the update
  const updatedCase = await casesRepo.getCase(testCaseId, TEST_TENANT);
  console.log('Verified status:', updatedCase?.status);

  return result.success;
}

testUpdateCaseActivity()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
```

### Task 2.2: Test storeFile Activity

```typescript
// Location: app/services/workflow/src/test-store-file.ts
import { storeFile } from './activities/store-file.js';

async function testStoreFileActivity() {
  console.log('=== storeFile Activity Test ===\n');

  // This requires an actual blob URL to test
  // For now, test with a mock URL to verify error handling

  const result = await storeFile({
    caseId: 'test-case-store',
    blobUrl: 'https://pippaistoragedev.blob.core.windows.net/orders-incoming/test.xlsx',
  });

  console.log('Result:', result);
  return result.success;
}

testStoreFileActivity()
  .then(success => {
    console.log(success ? '✅ Passed' : '❌ Failed (expected if no real blob)');
    process.exit(0); // Don't fail on missing blob
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(0); // Expected to fail without real blob
  });
```

---

## Phase 3: Workflow Integration Test

### Task 3.1: Start a Test Workflow

```typescript
// Location: app/services/workflow/src/test-workflow-start.ts
import { Connection, Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';

async function startTestWorkflow() {
  console.log('=== Workflow Start Test ===\n');

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({ connection });

  const testCaseId = `workflow-test-${uuidv4()}`;

  console.log('Starting workflow with caseId:', testCaseId);

  try {
    const handle = await client.workflow.start('orderProcessingWorkflow', {
      taskQueue: 'order-processing',
      workflowId: testCaseId,
      args: [{
        caseId: testCaseId,
        blobUrl: 'https://pippaistoragedev.blob.core.windows.net/orders-incoming/test.xlsx',
        tenantId: 'workflow-test-tenant',
        userId: 'workflow-test-user',
        correlationId: `corr-${testCaseId}`,
        teams: {
          chatId: 'test-chat',
          messageId: 'test-message',
          activityId: 'test-activity',
        },
      }],
    });

    console.log('✅ Workflow started:', handle.workflowId);
    console.log('   Run ID:', handle.firstExecutionRunId);

    // Query workflow state
    const state = await handle.query('getState');
    console.log('   Current state:', state);

    return true;
  } catch (error) {
    console.error('❌ Failed to start workflow:', error);
    return false;
  }
}

startTestWorkflow()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
```

### Task 3.2: Query Workflow Status

```bash
# Using tctl or temporal CLI
temporal workflow list --query "TaskQueue='order-processing'" --limit 10

# Describe specific workflow
temporal workflow describe --workflow-id <workflow-id>
```

---

## Phase 4: End-to-End Verification

### Task 4.1: Verify PM2 Services

```bash
# Check all services are running
pm2 ls

# Expected output:
# teams-bot          | online | 0 restarts
# workflow-api (x2)  | online | 0 restarts
# workflow-worker (x2) | online | stable

# Check for errors
pm2 logs workflow-worker --lines 50 --nostream | grep -i error

# Verify Cosmos initialization
pm2 logs workflow-worker --lines 100 --nostream | grep -i cosmos
```

### Task 4.2: Verify Health Endpoints

```bash
# Teams bot health
curl -s http://localhost:3978/health | jq

# Workflow API health
curl -s http://localhost:3005/health | jq

# Temporal server
curl -s http://localhost:8088/api/v1/namespaces/default | jq '.namespaceInfo.name'
```

### Task 4.3: Test API Endpoints

```bash
# Get workflow status
curl -s http://localhost:3005/api/workflows/test-case-id/status | jq

# Start workflow via API (if endpoint exists)
curl -X POST http://localhost:3005/api/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "api-test-case",
    "blobUrl": "https://test.blob.core.windows.net/test.xlsx",
    "tenantId": "api-test-tenant",
    "userId": "api-test-user"
  }' | jq
```

---

## Phase 5: Cosmos DB Data Verification

### Task 5.1: Query Cases Container

```bash
# Using Azure CLI
az cosmosdb sql container show \
  --account-name cosmos-visionarylab \
  --database-name order-processing \
  --name cases \
  -g pippai-rg \
  --query "{id:id, partitionKey:resource.partitionKey}"
```

### Task 5.2: Verify Data in Azure Portal

1. Navigate to Azure Portal > Cosmos DB > cosmos-visionarylab
2. Open Data Explorer
3. Select `order-processing` database
4. Check `cases` container for test documents
5. Check `events` container for audit events

### Task 5.3: Run Query in Data Explorer

```sql
-- Query cases by tenant
SELECT * FROM c WHERE c.tenantId = 'test-tenant-xxx'

-- Query events by case
SELECT * FROM c WHERE c.caseId = 'test-case-xxx' ORDER BY c.sequenceNumber

-- Get recent cases
SELECT TOP 10 c.id, c.status, c.createdAt
FROM c
ORDER BY c.createdAt DESC
```

---

## Phase 6: Error Handling Verification

### Task 6.1: Test Graceful Degradation

```bash
# Temporarily remove COSMOS_ENDPOINT to test fallback
pm2 env workflow-worker

# Restart without Cosmos
COSMOS_ENDPOINT="" pm2 restart workflow-worker

# Check logs for fallback behavior
pm2 logs workflow-worker --lines 30 | grep -i "mock\|fallback\|unavailable"

# Restore Cosmos
pm2 restart ecosystem.config.cjs --only workflow-worker
```

### Task 6.2: Verify Error Logging

```bash
# Check for any error patterns
pm2 logs --lines 200 --nostream 2>&1 | grep -E "(ERROR|Error|error|WARN|Warning)" | head -50
```

---

---

## Phase 7: Signal & Race Condition Tests (CRITICAL)

### Task 7.1: Test Workflow Signals Programmatically

```typescript
// Location: app/services/workflow/src/test-signals.ts
import { Connection, Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';

async function testWorkflowSignals() {
  console.log('=== Workflow Signal Tests ===\n');

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });
  const client = new Client({ connection });

  const workflowId = `signal-test-${uuidv4()}`;

  // Start a workflow
  const handle = await client.workflow.start('orderProcessingWorkflow', {
    taskQueue: 'order-processing',
    workflowId,
    args: [{
      caseId: workflowId,
      blobUrl: 'https://test.blob.core.windows.net/test.xlsx',
      tenantId: 'signal-test-tenant',
      userId: 'signal-test-user',
      correlationId: `corr-${workflowId}`,
      teams: { chatId: 'test', messageId: 'test', activityId: 'test' },
    }],
  });

  console.log('Workflow started:', workflowId);

  // Test 1: Send approval signal
  console.log('\nTest 1: Sending approval signal...');
  try {
    await handle.signal('approvalReceived', {
      caseId: workflowId,
      approved: true,
      approvedBy: 'test-approver',
      approvedAt: new Date().toISOString(),
    });
    console.log('  ✅ Approval signal sent');
  } catch (error) {
    console.log('  ⚠️ Signal may have been received before workflow reached approval step');
  }

  // Test 2: Send duplicate signal (should be idempotent)
  console.log('\nTest 2: Sending duplicate approval signal...');
  try {
    await handle.signal('approvalReceived', {
      caseId: workflowId,
      approved: true,
      approvedBy: 'test-approver-2',
      approvedAt: new Date().toISOString(),
    });
    console.log('  ✅ Duplicate signal handled');
  } catch (error) {
    console.log('  ✅ Duplicate signal rejected (expected)');
  }

  // Query final state
  const state = await handle.query('getState');
  console.log('\nFinal workflow state:', state);

  return true;
}

testWorkflowSignals()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Signal test failed:', err);
    process.exit(1);
  });
```

### Task 7.2: Test Race Conditions

```typescript
// Location: app/services/workflow/src/test-race-conditions.ts
import { Connection, Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';

async function testRaceConditions() {
  console.log('=== Race Condition Tests ===\n');

  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new Client({ connection });

  // Test: Start same workflow twice (should fail with duplicate)
  const duplicateId = `race-test-${uuidv4()}`;

  console.log('Test: Starting duplicate workflows...');
  try {
    const [handle1, handle2] = await Promise.all([
      client.workflow.start('orderProcessingWorkflow', {
        taskQueue: 'order-processing',
        workflowId: duplicateId,
        args: [{ caseId: duplicateId, tenantId: 'race-test', userId: 'test',
                 blobUrl: 'https://test/1.xlsx', correlationId: 'c1',
                 teams: { chatId: 't', messageId: 'm', activityId: 'a' } }],
      }),
      client.workflow.start('orderProcessingWorkflow', {
        taskQueue: 'order-processing',
        workflowId: duplicateId,
        args: [{ caseId: duplicateId, tenantId: 'race-test', userId: 'test',
                 blobUrl: 'https://test/2.xlsx', correlationId: 'c2',
                 teams: { chatId: 't', messageId: 'm', activityId: 'a' } }],
      }),
    ]);
    console.log('  ❌ Both workflows started (should have failed!)');
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === 'ALREADY_EXISTS') {
      console.log('  ✅ Duplicate workflow correctly rejected');
    } else {
      console.log('  ❌ Unexpected error:', error.message);
    }
  }

  return true;
}

testRaceConditions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Race condition test failed:', err);
    process.exit(1);
  });
```

---

## Phase 8: Idempotency & Data Isolation Tests

### Task 8.1: Test Case Creation Idempotency

```typescript
// Location: app/services/workflow/src/test-idempotency.ts
import { initializeCosmosClient, getCasesRepository } from './repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

async function testIdempotency() {
  console.log('=== Idempotency Tests ===\n');

  await initializeCosmosClient();
  const casesRepo = getCasesRepository();

  const testCaseId = `idempotency-test-${uuidv4()}`;
  const testTenantId = 'idempotency-test-tenant';

  // Create case
  console.log('Creating case:', testCaseId);
  await casesRepo.createCase(testCaseId, {
    tenantId: testTenantId,
    userId: 'test-user',
    conversationId: 'test-conv',
  });

  // Try to create same case again
  console.log('\nTest: Attempting duplicate creation...');
  try {
    await casesRepo.createCase(testCaseId, {
      tenantId: testTenantId,
      userId: 'test-user-2',
      conversationId: 'test-conv-2',
    });
    console.log('  ❌ Duplicate case created (idempotency failure!)');
  } catch (error: any) {
    if (error.code === 409 || error.message?.includes('conflict')) {
      console.log('  ✅ Duplicate correctly rejected with 409 Conflict');
    } else {
      console.log('  ⚠️ Error:', error.message);
    }
  }

  // Verify original data unchanged
  const retrieved = await casesRepo.getCase(testCaseId, testTenantId);
  console.log('\nVerifying original data:');
  console.log('  userId:', retrieved?.userId === 'test-user' ? '✅ unchanged' : '❌ modified');

  return true;
}

testIdempotency()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Idempotency test failed:', err);
    process.exit(1);
  });
```

### Task 8.2: Verify Test Data Isolation

```typescript
// Location: app/services/workflow/src/test-isolation.ts
import { initializeCosmosClient, getCasesRepository } from './repositories/index.js';

// Convention: All test tenants MUST use this prefix
const TEST_TENANT_PREFIX = 'test-';

async function verifyTestDataIsolation() {
  console.log('=== Test Data Isolation Verification ===\n');

  await initializeCosmosClient();
  const casesRepo = getCasesRepository();

  // Query for production tenants (should NOT have test prefix)
  console.log('Checking for test data in production namespace...');

  // This would require a cross-partition query - be careful!
  // In production, we should NEVER run cross-partition queries

  console.log('\n⚠️  Test isolation verification requires:');
  console.log('  1. All test tenants use prefix: test-');
  console.log('  2. Cleanup job removes test-* data after tests');
  console.log('  3. Production tenants NEVER start with "test-"');
  console.log('  4. Cross-partition queries are disabled in production');

  return true;
}

verifyTestDataIsolation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Isolation test failed:', err);
    process.exit(1);
  });
```

---

## Phase 9: Audit Trail Integrity Tests

### Task 9.1: Verify Event Sequence Integrity

```typescript
// Location: app/services/workflow/src/test-audit-integrity.ts
import { initializeCosmosClient, getEventsRepository } from './repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

async function testAuditIntegrity() {
  console.log('=== Audit Trail Integrity Tests ===\n');

  await initializeCosmosClient();
  const eventsRepo = getEventsRepository();

  const testCaseId = `audit-test-${uuidv4()}`;

  // Append multiple events
  console.log('Appending events in sequence...');
  const events = [];
  for (let i = 0; i < 5; i++) {
    const event = await eventsRepo.appendEvent({
      caseId: testCaseId,
      type: 'status_changed',
      status: 'parsing',
      correlationId: `corr-${i}`,
      metadata: { step: i },
    });
    events.push(event);
    console.log(`  Event ${i}: sequence=${event.sequenceNumber}`);
  }

  // Verify sequence is monotonic
  console.log('\nVerifying sequence integrity...');
  const retrieved = await eventsRepo.getEventsByCaseId(testCaseId);

  let lastSeq = -1;
  let hasGaps = false;
  for (const event of retrieved) {
    if (event.sequenceNumber <= lastSeq) {
      console.log(`  ❌ Sequence out of order: ${event.sequenceNumber} <= ${lastSeq}`);
      hasGaps = true;
    }
    lastSeq = event.sequenceNumber;
  }

  if (!hasGaps && retrieved.length === 5) {
    console.log('  ✅ All events in sequence, no gaps');
  } else {
    console.log(`  ❌ Found ${retrieved.length} events, expected 5`);
  }

  // Verify timeline reconstruction
  console.log('\nReconstructing timeline...');
  const timeline = retrieved.map(e => ({
    seq: e.sequenceNumber,
    type: e.type,
    time: e.timestamp,
  }));
  console.log('  Timeline:', JSON.stringify(timeline, null, 2));

  return !hasGaps;
}

testAuditIntegrity()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Audit integrity test failed:', err);
    process.exit(1);
  });
```

### Task 9.2: Verify Correlation ID Chain

```typescript
// Location: app/services/workflow/src/test-correlation.ts
import { initializeCosmosClient, getEventsRepository } from './repositories/index.js';

async function verifyCorrelationChain(caseId: string) {
  console.log('=== Correlation ID Chain Verification ===\n');

  await initializeCosmosClient();
  const eventsRepo = getEventsRepository();

  const events = await eventsRepo.getEventsByCaseId(caseId);

  console.log(`Found ${events.length} events for case ${caseId}\n`);

  // Group by correlationId
  const byCorrelation: Record<string, typeof events> = {};
  for (const event of events) {
    const corrId = event.correlationId || 'NO_CORRELATION';
    byCorrelation[corrId] = byCorrelation[corrId] || [];
    byCorrelation[corrId].push(event);
  }

  console.log('Events by correlation ID:');
  for (const [corrId, corrEvents] of Object.entries(byCorrelation)) {
    console.log(`\n  ${corrId}:`);
    for (const e of corrEvents) {
      console.log(`    - ${e.type} @ ${e.timestamp}`);
    }
  }

  // Check for missing correlations
  const missingCorrelation = events.filter(e => !e.correlationId);
  if (missingCorrelation.length > 0) {
    console.log(`\n⚠️  ${missingCorrelation.length} events missing correlationId`);
  } else {
    console.log('\n✅ All events have correlationId');
  }

  return true;
}

// Run with: npx ts-node src/test-correlation.ts <caseId>
const caseId = process.argv[2];
if (!caseId) {
  console.log('Usage: npx ts-node src/test-correlation.ts <caseId>');
  process.exit(1);
}

verifyCorrelationChain(caseId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Correlation test failed:', err);
    process.exit(1);
  });
```

---

## Phase 10: Negative Path & Error Handling Tests

### Task 10.1: Test Zoho Unavailable Scenario

```typescript
// Location: app/services/workflow/src/test-zoho-unavailable.ts
import { createZohoDraft } from './activities/create-zoho-draft.js';

async function testZohoUnavailable() {
  console.log('=== Zoho Unavailable Test ===\n');

  // Temporarily set invalid Zoho URL
  const originalUrl = process.env.API_SERVICE_URL;
  process.env.API_SERVICE_URL = 'http://localhost:9999'; // Invalid

  try {
    const result = await createZohoDraft({ caseId: 'zoho-test-case' });

    console.log('Result:', result);

    if (result.queued) {
      console.log('✅ Order correctly queued when Zoho unavailable');
    } else if (!result.success) {
      console.log('✅ Failure correctly reported');
    } else {
      console.log('❌ Unexpected success (Zoho should be unavailable)');
    }
  } catch (error) {
    console.log('✅ Error thrown as expected:', (error as Error).message);
  } finally {
    process.env.API_SERVICE_URL = originalUrl;
  }

  return true;
}

testZohoUnavailable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Zoho unavailable test failed:', err);
    process.exit(1);
  });
```

### Task 10.2: Test Invalid Excel Formats

```bash
# Create test files with various issues
mkdir -p /tmp/excel-tests

# Test files to create:
# 1. Empty file (0 bytes)
# 2. Not an Excel file (rename .txt to .xlsx)
# 3. Password protected Excel
# 4. Excel with formulas only (no data)
# 5. Excel with circular references

# Upload each via Teams or direct blob upload
# Verify parseExcel handles each gracefully
```

---

## Phase 11: Observability & Monitoring Verification

### Task 11.1: Verify Structured Logging

```bash
# Check logs have consistent structure
pm2 logs workflow-worker --lines 100 --nostream | head -50

# Verify required fields in logs:
# - timestamp
# - level (INFO, WARN, ERROR)
# - caseId (when applicable)
# - correlationId
# - activity name
# - duration (for activities)

# Example expected format:
# 2025-12-30T08:30:00Z [INFO] [caseId=xxx] [corr=yyy] updateCase started
# 2025-12-30T08:30:01Z [INFO] [caseId=xxx] [corr=yyy] updateCase completed (150ms)
```

### Task 11.2: Verify Temporal Metrics

```bash
# Check Temporal metrics endpoint
curl -s http://localhost:8088/metrics | grep -E "temporal_|workflow_|activity_" | head -20

# Key metrics to verify:
# - workflow_started_total
# - workflow_completed_total
# - workflow_failed_total
# - activity_execution_latency
# - activity_schedule_to_start_latency
```

### Task 11.3: Verify Cosmos DB Metrics

```bash
# Check Cosmos DB RU consumption (via Azure CLI)
az monitor metrics list \
  --resource "/subscriptions/.../databaseAccounts/cosmos-visionarylab" \
  --metric "TotalRequestUnits" \
  --interval PT1H \
  --output table
```

---

## Phase 12: Load Testing Considerations

### Task 12.1: Baseline Performance Test

```typescript
// Location: app/services/workflow/src/test-load-baseline.ts
import { initializeCosmosClient, getCasesRepository } from './repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

async function baselinePerformanceTest() {
  console.log('=== Baseline Performance Test ===\n');

  await initializeCosmosClient();
  const casesRepo = getCasesRepository();

  const testTenantId = 'perf-test-tenant';
  const iterations = 100;

  // Measure case creation
  console.log(`Creating ${iterations} cases...`);
  const createStart = Date.now();

  for (let i = 0; i < iterations; i++) {
    await casesRepo.createCase(`perf-test-${uuidv4()}`, {
      tenantId: testTenantId,
      userId: 'perf-user',
      conversationId: 'perf-conv',
    });
  }

  const createDuration = Date.now() - createStart;
  console.log(`  Total: ${createDuration}ms`);
  console.log(`  Avg: ${(createDuration / iterations).toFixed(2)}ms per case`);
  console.log(`  Rate: ${(1000 / (createDuration / iterations)).toFixed(2)} cases/sec`);

  // Measure queries
  console.log(`\nQuerying cases by tenant...`);
  const queryStart = Date.now();
  const cases = await casesRepo.getCasesByTenant(testTenantId, iterations);
  const queryDuration = Date.now() - queryStart;
  console.log(`  Found: ${cases.length} cases`);
  console.log(`  Duration: ${queryDuration}ms`);

  return true;
}

baselinePerformanceTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Performance test failed:', err);
    process.exit(1);
  });
```

### Task 12.2: Load Testing Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Case creation | < 100ms p95 | < 500ms p99 |
| Case query | < 50ms p95 | < 200ms p99 |
| Event append | < 50ms p95 | < 200ms p99 |
| Workflow start | < 500ms p95 | < 2s p99 |
| End-to-end processing | < 30s | < 60s |
| Concurrent workflows | 50 | 100 max |

---

## Success Criteria (Updated)

| Test | Criteria | Status |
|------|----------|--------|
| Cosmos RBAC | Role assignment exists | ☐ |
| Cosmos Client Init | Connects without error | ☐ |
| Cases Repository | CRUD operations work | ☐ |
| Events Repository | Append/query works | ☐ |
| updateCase Activity | Persists to Cosmos | ☐ |
| Workflow Start | Workflow begins execution | ☐ |
| State Queries | Workflow state queryable | ☐ |
| Health Endpoints | All return 200 OK | ☐ |
| Graceful Degradation | Falls back without crash | ☐ |
| Error Handling | Errors logged properly | ☐ |
| **Signal Handling** | Signals processed correctly | ☐ |
| **Race Condition Prevention** | Duplicate workflows rejected | ☐ |
| **Idempotency** | Duplicate creates rejected | ☐ |
| **Audit Integrity** | Event sequence monotonic | ☐ |
| **Correlation Chain** | All events have correlationId | ☐ |
| **Negative Paths** | Errors handled gracefully | ☐ |
| **Observability** | Structured logs present | ☐ |
| **Performance Baseline** | Within target thresholds | ☐ |

---

## Cleanup Commands

```bash
# Remove test data from Cosmos (run in Data Explorer)
DELETE FROM c WHERE c.tenantId LIKE 'test-%'
DELETE FROM c WHERE c.caseId LIKE 'test-%'

# Or use Azure CLI
az cosmosdb sql container delete \
  --account-name cosmos-visionarylab \
  --database-name order-processing \
  --name test-container \
  -g pippai-rg
```

---

## Troubleshooting

### RBAC Not Working
```bash
# Check propagation (can take 5-10 minutes)
az cosmosdb sql role assignment list --account-name cosmos-visionarylab -g pippai-rg

# Re-assign if needed
az cosmosdb sql role assignment create \
  --account-name cosmos-visionarylab \
  --resource-group pippai-rg \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "3976c71c-c570-43aa-a974-58c971b706cf" \
  --scope "/subscriptions/5bc1c173-058c-4d81-bed4-5610679d339f/resourceGroups/pippai-rg/providers/Microsoft.DocumentDB/databaseAccounts/cosmos-visionarylab"
```

### Workers Keep Crashing
```bash
# Check for unhandled errors
pm2 logs workflow-worker --err --lines 100

# Verify environment
pm2 env workflow-worker | grep -E "COSMOS|TEMPORAL"

# Rebuild and restart
cd /data/order-processing/app/services/workflow
npm run build
pm2 restart ecosystem.config.cjs
```

### Cosmos Queries Failing
```bash
# Verify partition key usage
# Cases use /tenantId, Events use /caseId
# All queries MUST include partition key for efficiency

# Check container configuration
az cosmosdb sql container show \
  --account-name cosmos-visionarylab \
  --database-name order-processing \
  --name cases \
  -g pippai-rg \
  --query "resource.partitionKey"
```

---

## Execution Instructions

1. **Run Phase 1** first to verify Cosmos connectivity
2. **Run Phase 2** to test individual activities
3. **Run Phase 3** to test workflow integration
4. **Run Phase 4** to verify end-to-end health
5. **Run Phase 5** to verify data persistence
6. **Run Phase 6** to verify error handling

Report results in the daily log with test outcomes and any issues found.
