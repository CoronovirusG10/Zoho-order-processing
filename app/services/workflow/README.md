# Workflow Orchestrator Service

Temporal.io-based workflow orchestrator for order processing. Implements the complete order processing workflow from Excel file upload to Zoho Books draft sales order creation, running as an Express.js server with a Temporal worker.

## Architecture

This service uses **Temporal.io** for reliable, stateful workflow orchestration:

- **Durable workflows** - Fault-tolerant execution with automatic retries and replay
- **Activity functions** - Individual steps with configurable retry policies
- **Signals** - User interactions trigger workflow progression
- **Queries** - Real-time workflow state inspection
- **State persistence** - Automatic state management via Temporal server

### Service Components

- **Express.js API Server** - HTTP endpoints for workflow management (port 3000)
- **Temporal Worker** - Executes workflows and activities
- **Temporal Server** - Workflow orchestration engine (gRPC port 7233)

## Workflow Steps

```
1. FileReceived -> StoreFile
   |
2. ParseExcel -> [success/blocked/failed]
   | (if blocked: formulas/protected)
   -> NotifyUser (re-upload required)
   -> Wait for FileReuploaded signal
   -> Restart workflow
   | (if success)
3. RunCommittee -> [consensus/needs_human]
   | (if needs_human: disagreements)
   -> NotifyUser (correction required)
   -> Wait for CorrectionsSubmitted signal
   -> ApplyCorrections
   |
4. ResolveCustomer -> [resolved/needs_human]
   | (if needs_human: ambiguous)
   -> NotifyUser (selection required)
   -> Wait for SelectionsSubmitted signal
   -> ApplySelections
   |
5. ResolveItems -> [all_resolved/needs_human]
   | (if needs_human: unresolved items)
   -> NotifyUser (selection required)
   -> Wait for SelectionsSubmitted signal
   -> ApplySelections
   |
6. AwaitApproval
   -> NotifyUser (ready for approval)
   -> Wait for ApprovalReceived signal
   | (if approved)
7. CreateZohoDraft -> [success/queued/failed]
   | (if success)
8. NotifyComplete
   -> UpdateCase (status: completed)
```

## Directory Structure

```
services/workflow/
├── package.json
├── tsconfig.json
├── ecosystem.config.js              # PM2 process configuration
├── docker-compose.temporal.yml      # Temporal server setup
├── .env.example                     # Environment configuration template
├── src/
│   ├── index.ts                     # Express server entry point
│   ├── worker.ts                    # Temporal worker entry point
│   ├── types.ts                     # TypeScript type definitions
│   ├── client.ts                    # Temporal client utilities
│   ├── workflows/
│   │   └── order-processing.ts      # Main workflow definition
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
│   ├── routes/
│   │   ├── workflow.ts              # Workflow API routes
│   │   └── health.ts                # Health check endpoints
│   └── utils/
│       └── temporal-client.ts       # Temporal client utilities
```

## Dependencies

```json
{
  "@temporalio/client": "^1.x",
  "@temporalio/worker": "^1.x",
  "@temporalio/workflow": "^1.x",
  "@temporalio/activity": "^1.x",
  "express": "^4.x"
}
```

## Ports

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| Express API | 3000 | HTTP | Workflow management endpoints |
| Temporal Server | 7233 | gRPC | Temporal workflow engine |
| Temporal Web UI | 8080 | HTTP | Workflow monitoring dashboard |

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
  "workflowId": "uuid",
  "runId": "uuid",
  "caseId": "uuid",
  "status": "started"
}
```

### Send Signal (External Event)
```http
POST /api/workflow/{workflowId}/signal/{signalName}
Content-Type: application/json

{
  // Signal-specific data
}

Response: 202 Accepted
{
  "workflowId": "uuid",
  "signalName": "CorrectionsSubmitted",
  "status": "signal_sent"
}
```

### Query Workflow Status
```http
GET /api/workflow/{workflowId}/status

Response: 200 OK
{
  "workflowId": "uuid",
  "runId": "uuid",
  "status": "RUNNING|COMPLETED|FAILED|CANCELLED",
  "input": { ... },
  "currentStep": "...",
  "startTime": "2025-12-25T10:00:00Z",
  "closeTime": null
}
```

### Cancel Workflow
```http
POST /api/workflow/{workflowId}/cancel
Content-Type: application/json

{
  "reason": "User cancelled"
}

Response: 200 OK
{
  "workflowId": "uuid",
  "status": "cancelled",
  "reason": "User cancelled"
}
```

### Health Check
```http
GET /health

Response: 200 OK
{
  "status": "healthy",
  "temporal": "connected",
  "uptime": 12345
}
```

## Signals (External Events)

The workflow waits for these signals from the Teams bot:

### FileReuploaded
Sent when user re-uploads a file after blocking issue.
```typescript
{
  caseId: string;
  blobUrl: string;
  correlationId: string;
}
```

### CorrectionsSubmitted
Sent when user submits corrections via adaptive card.
```typescript
{
  caseId: string;
  corrections: unknown; // JSON Patch operations
  submittedBy: string;
  submittedAt: string;
}
```

### SelectionsSubmitted
Sent when user selects customer/items from candidates.
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
Sent when user approves/rejects the order.
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

Activity retry policies are configured in the workflow:

- **Standard**: 3 attempts, 5s initial interval, exponential backoff (max 1 min)
- **Aggressive**: 5 attempts, 5s initial interval, 2x backoff coefficient
- **Long-running**: 10 attempts, 10s initial interval, 1.5x backoff (max 5 min)

Used for resilience against transient failures.

## Configuration

Environment variables (see `.env.example`):

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233      # Temporal server gRPC address
TEMPORAL_NAMESPACE=default           # Temporal namespace
TEMPORAL_TASK_QUEUE=order-processing # Task queue name

# Express Server
PORT=3000                            # API server port

# Database
COSMOS_ENDPOINT=                     # Cosmos DB endpoint
COSMOS_KEY=                          # Cosmos DB key
COSMOS_DATABASE_ID=                  # Cosmos DB database name

# Storage
BLOB_STORAGE_CONNECTION_STRING=      # Blob storage for files

# Service URLs
PARSER_SERVICE_URL=                  # Parser service endpoint
COMMITTEE_SERVICE_URL=               # Committee service endpoint
ZOHO_SERVICE_URL=                    # Zoho service endpoint
TEAMS_BOT_SERVICE_URL=               # Teams bot service endpoint

# Monitoring
APPLICATIONINSIGHTS_CONNECTION_STRING=  # App Insights (optional)
```

## Correlation and Audit

- Every workflow step propagates `correlationId` (= `caseId`)
- Audit events logged at each step with structured logging
- Temporal provides full workflow execution history
- Application Insights integration for distributed tracing

## Error Handling

- Transient errors: Automatic retry with exponential backoff (configured per activity)
- Permanent errors: Workflow fails, user notified, case marked failed
- Zoho outage: Queue order for later, notify user
- Blocking issues: Notify user, wait for signal (correction/re-upload)

## Local Development

### 1. Start Temporal Server

Using Docker Compose:
```bash
docker-compose -f docker-compose.temporal.yml up -d
```

This starts:
- Temporal server (port 7233)
- Temporal Web UI (port 8080)
- PostgreSQL (Temporal persistence)

### 2. Install Dependencies
```bash
npm install
```

### 3. Build TypeScript
```bash
npm run build
```

### 4. Configure Environment
```bash
cp .env.example .env
# Edit with your local values
```

### 5. Start Services with PM2
```bash
# Install PM2 globally if needed
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit
```

Or start individually:
```bash
# Start worker (in one terminal)
npm run worker

# Start API server (in another terminal)
npm run server
```

## PM2 Process Management

The `ecosystem.config.js` defines process configuration:

```javascript
module.exports = {
  apps: [
    {
      name: 'workflow-api',
      script: 'dist/index.js',
      instances: 1,
      env: {
        PORT: 3000
      }
    },
    {
      name: 'workflow-worker',
      script: 'dist/worker.js',
      instances: 1
    }
  ]
};
```

Common PM2 commands:
```bash
pm2 start ecosystem.config.js   # Start all
pm2 stop all                    # Stop all
pm2 restart all                 # Restart all
pm2 delete all                  # Remove all
pm2 logs workflow-api           # View API logs
pm2 logs workflow-worker        # View worker logs
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Start workflow locally
curl -X POST http://localhost:3000/api/workflow/start \
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

# Send signal
curl -X POST http://localhost:3000/api/workflow/test-123/signal/ApprovalReceived \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "approved": true,
    "approvedBy": "user-id",
    "approvedAt": "2025-12-25T10:00:00Z"
  }'

# Get status
curl http://localhost:3000/api/workflow/test-123/status

# Health check
curl http://localhost:3000/health
```

## Deployment

### Docker Deployment

```bash
# Build the service image
docker build -t workflow-service .

# Run with docker-compose
docker-compose up -d
```

### Production Setup

1. **Temporal Server**: Deploy Temporal cluster (self-hosted or Temporal Cloud)
2. **Worker Deployment**: Deploy worker containers/VMs with PM2
3. **API Server**: Deploy Express server behind load balancer

```bash
# Using PM2 for production
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Scaling

- **Workers**: Scale horizontally by adding more worker instances
- **API Servers**: Scale behind load balancer
- **Temporal**: Use Temporal Cloud for managed scaling

## Integration with Other Services

- **Teams Bot**: Calls `POST /api/workflow/start` to initiate workflow
- **Parser Service**: Called by `ParseExcel` activity
- **Committee Service**: Called by `RunCommittee` activity
- **Zoho Service**: Called by `ResolveCustomer`, `ResolveItems`, `CreateZohoDraft`
- **Cosmos DB**: Case state storage, queried by activities
- **Blob Storage**: File storage, audit bundles

## Monitoring

- **Temporal Web UI**: Full workflow visibility at `http://localhost:8080`
  - View running/completed/failed workflows
  - Inspect workflow history and state
  - Debug failed activities
- **Application Insights**: Distributed tracing integration
- **Custom Metrics**: Track workflow success rate, step durations, retry counts
- **Alerts**: Failed workflows, high retry rates, Zoho unavailability

### Temporal Web UI Features

- Real-time workflow execution view
- Searchable workflow history
- Activity retry and failure inspection
- Signal and query debugging
- Namespace and task queue management

## License

Private - Order Processing System v1
