# Workflow Orchestrator Service

Azure Durable Functions-based workflow orchestrator for order processing. Implements the complete order processing workflow from Excel file upload to Zoho Books draft sales order creation.

## Architecture

This service uses **Azure Durable Functions** for reliable, stateful workflow orchestration:

- **Replayable orchestrations** - Fault-tolerant execution with automatic retries
- **Activity functions** - Individual steps with retry policies
- **External events** - User interactions trigger workflow progression
- **Durable entities** - Maintain case state across orchestrations
- **State persistence** - Automatic state management via Azure Storage

## Workflow Steps

```
1. FileReceived → StoreFile
   ↓
2. ParseExcel → [success/blocked/failed]
   ↓ (if blocked: formulas/protected)
   → NotifyUser (re-upload required)
   → Wait for FileReuploaded event
   → Restart workflow
   ↓ (if success)
3. RunCommittee → [consensus/needs_human]
   ↓ (if needs_human: disagreements)
   → NotifyUser (correction required)
   → Wait for CorrectionsSubmitted event
   → ApplyCorrections
   ↓
4. ResolveCustomer → [resolved/needs_human]
   ↓ (if needs_human: ambiguous)
   → NotifyUser (selection required)
   → Wait for SelectionsSubmitted event
   → ApplySelections
   ↓
5. ResolveItems → [all_resolved/needs_human]
   ↓ (if needs_human: unresolved items)
   → NotifyUser (selection required)
   → Wait for SelectionsSubmitted event
   → ApplySelections
   ↓
6. AwaitApproval
   → NotifyUser (ready for approval)
   → Wait for ApprovalReceived event
   ↓ (if approved)
7. CreateZohoDraft → [success/queued/failed]
   ↓ (if success)
8. NotifyComplete
   → UpdateCase (status: completed)
```

## Directory Structure

```
services/workflow/
├── package.json
├── tsconfig.json
├── host.json                        # Durable Functions configuration
├── local.settings.json.example      # Environment configuration template
├── src/
│   ├── index.ts                     # Main entry point
│   ├── types.ts                     # TypeScript type definitions
│   ├── orchestrations/
│   │   └── order-processing.ts      # Main orchestration
│   ├── activities/
│   │   ├── store-file.ts            # Store uploaded file
│   │   ├── parse-excel.ts           # Parse Excel file
│   │   ├── run-committee.ts         # Run 3-model committee
│   │   ├── resolve-customer.ts      # Resolve customer to Zoho
│   │   ├── resolve-items.ts         # Resolve items to Zoho catalog
│   │   ├── create-zoho-draft.ts     # Create Zoho draft order
│   │   ├── notify-user.ts           # Send Teams notifications
│   │   ├── update-case.ts           # Update Cosmos DB case
│   │   ├── apply-corrections.ts     # Apply user corrections
│   │   └── apply-selections.ts      # Apply user selections
│   ├── triggers/
│   │   ├── http-trigger.ts          # Start workflow (POST /api/workflow/start)
│   │   ├── queue-trigger.ts         # Handle external events from queue
│   │   ├── http-event-trigger.ts    # Raise events via HTTP
│   │   └── http-status-trigger.ts   # Get/terminate workflow status
│   ├── entities/
│   │   └── case-entity.ts           # Durable entity for case state
│   └── utils/
│       └── durable-client.ts        # Durable Functions utilities
```

## API Endpoints

### Start Workflow
```http
POST /api/workflow/start
Content-Type: application/json

{
  "caseId": "uuid",
  "blobUrl": "https://...",
  "tenantId": "uuid",
  "userId": "uuid",
  "correlationId": "uuid",
  "teams": {
    "chatId": "...",
    "messageId": "...",
    "activityId": "..."
  }
}

Response: 202 Accepted
{
  "instanceId": "uuid",
  "caseId": "uuid",
  "status": "started",
  "statusQueryGetUri": "...",
  "sendEventPostUri": "...",
  "terminatePostUri": "..."
}
```

### Raise External Event
```http
POST /api/workflow/{instanceId}/raiseEvent/{eventName}
Content-Type: application/json

{
  // Event-specific data
}

Response: 202 Accepted
{
  "instanceId": "uuid",
  "eventName": "CorrectionsSubmitted",
  "status": "event_raised"
}
```

### Get Workflow Status
```http
GET /api/workflow/{instanceId}/status

Response: 200 OK
{
  "instanceId": "uuid",
  "runtimeStatus": "Running|Completed|Failed",
  "input": { ... },
  "output": { ... },
  "createdTime": "2025-12-25T10:00:00Z",
  "lastUpdatedTime": "2025-12-25T10:05:00Z"
}
```

### Terminate Workflow
```http
POST /api/workflow/{instanceId}/terminate
Content-Type: application/json

{
  "reason": "User cancelled"
}

Response: 200 OK
{
  "instanceId": "uuid",
  "status": "terminated",
  "reason": "User cancelled"
}
```

## External Events

The workflow waits for these external events from the Teams bot:

### FileReuploaded
Raised when user re-uploads a file after blocking issue.
```typescript
{
  caseId: string;
  blobUrl: string;
  correlationId: string;
}
```

### CorrectionsSubmitted
Raised when user submits corrections via adaptive card.
```typescript
{
  caseId: string;
  corrections: unknown; // JSON Patch operations
  submittedBy: string;
  submittedAt: string;
}
```

### SelectionsSubmitted
Raised when user selects customer/items from candidates.
```typescript
{
  caseId: string;
  selections: {
    customer?: { zohoCustomerId: string };
    items?: Record<number, { zohoItemId: string }>;
  };
  submittedBy: string;
  submittedAt: string;
}
```

### ApprovalReceived
Raised when user approves/rejects the order.
```typescript
{
  caseId: string;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
  comments?: string;
}
```

## Retry Policies

The service includes built-in retry policies:

- **Standard**: 3 attempts, 5s initial delay, exponential backoff
- **Aggressive**: 5 attempts, 5s initial delay, 2x backoff
- **Long-running**: 10 attempts, 10s initial delay, 1.5x backoff

Used for resilience against transient failures.

## Configuration

Environment variables (see `local.settings.json.example`):

```
AzureWebJobsStorage          # Storage account for Durable Functions state
COSMOS_ENDPOINT              # Cosmos DB endpoint
COSMOS_KEY                   # Cosmos DB key
COSMOS_DATABASE_ID           # Cosmos DB database name
BLOB_STORAGE_CONNECTION_STRING  # Blob storage for files
PARSER_SERVICE_URL           # Parser service endpoint
COMMITTEE_SERVICE_URL        # Committee service endpoint
ZOHO_SERVICE_URL             # Zoho service endpoint
TEAMS_BOT_SERVICE_URL        # Teams bot service endpoint
APPLICATIONINSIGHTS_CONNECTION_STRING  # App Insights
```

## Correlation and Audit

- Every workflow step propagates `correlationId` (= `caseId`)
- Audit events logged at each step with structured logging
- Application Insights tracks entire workflow lifecycle
- Durable Functions provides automatic replay protection

## Error Handling

- Transient errors: Automatic retry with exponential backoff
- Permanent errors: Workflow fails, user notified, case marked failed
- Zoho outage: Queue order for later, notify user
- Blocking issues: Notify user, wait for correction/re-upload

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Copy settings:
```bash
cp local.settings.json.example local.settings.json
# Edit with your local values
```

4. Start Azurite (local storage emulator):
```bash
azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log
```

5. Start Functions runtime:
```bash
npm start
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Start workflow locally
curl -X POST http://localhost:7071/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "blobUrl": "https://...",
    "tenantId": "tenant-id",
    "userId": "user-id",
    "teams": {
      "chatId": "chat-id",
      "messageId": "msg-id",
      "activityId": "activity-id"
    }
  }'

# Raise event
curl -X POST http://localhost:7071/api/workflow/test-123/raiseEvent/ApprovalReceived \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "approved": true,
    "approvedBy": "user-id",
    "approvedAt": "2025-12-25T10:00:00Z"
  }'

# Get status
curl http://localhost:7071/api/workflow/test-123/status
```

## Deployment

Deploy to Azure Functions Premium or Dedicated plan:

```bash
# Using Azure CLI
az functionapp deployment source config-zip \
  --resource-group order-processing-rg \
  --name workflow-func-app \
  --src dist.zip

# Using func CLI
func azure functionapp publish workflow-func-app
```

## Integration with Other Services

- **Teams Bot**: Calls `POST /api/workflow/start` to initiate workflow
- **Parser Service**: Called by `ParseExcel` activity
- **Committee Service**: Called by `RunCommittee` activity
- **Zoho Service**: Called by `ResolveCustomer`, `ResolveItems`, `CreateZohoDraft`
- **Cosmos DB**: Case state storage, queried by activities
- **Blob Storage**: File storage, audit bundles

## Monitoring

- **Application Insights**: Full telemetry, distributed tracing
- **Durable Functions Monitor**: Web-based orchestration viewer
- **Custom Metrics**: Track workflow success rate, step durations, retry counts
- **Alerts**: Failed workflows, high retry rates, Zoho unavailability

## License

Private - Order Processing System v1
