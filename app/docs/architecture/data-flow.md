# Data Flow Documentation

## Overview

This document describes the complete request flow through the Order Processing system, from file upload in Teams to draft sales order creation in Zoho Books.

The system runs on a VM-only architecture using Temporal for workflow orchestration, with an Express.js API server handling HTTP requests and triggering Temporal workflows.

## High-Level Flow

```mermaid
flowchart LR
    subgraph Teams["Microsoft Teams"]
        User[("User")]
        Bot["Teams Bot"]
        Tab["Personal Tab"]
    end

    subgraph VM["Azure VM"]
        API["Express API"]
        Temporal["Temporal Server"]
        Worker["Temporal Worker"]
        Parser["Parser Activity"]
        Committee["Committee Activity"]
        Zoho["Zoho Activity"]
    end

    subgraph Storage["Azure Storage"]
        Blob[("Blob Storage")]
        Cosmos[("Cosmos DB")]
    end

    subgraph External["External"]
        ZohoAPI["Zoho Books API"]
        AIProviders["AI Providers"]
    end

    User -->|Upload .xlsx| Bot
    Bot -->|Store file| Blob
    Bot -->|Create case| Cosmos
    Bot -->|POST /workflow/start| API
    API -->|Start workflow| Temporal
    Temporal -->|Schedule| Worker
    Worker -->|Execute| Parser
    Worker -->|Execute| Committee
    Committee -->|Query| AIProviders
    Worker -->|Execute| Zoho
    Zoho -->|Create draft| ZohoAPI
    Tab -->|View cases| API
    API -->|Query| Cosmos
```

## Detailed Flow Diagrams

### 1. File Upload Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant T as Teams
    participant B as Bot Service
    participant S as Blob Storage
    participant C as Cosmos DB
    participant E as Express API
    participant Temp as Temporal

    U->>T: Upload order.xlsx
    T->>B: POST /api/messages (attachment)

    Note over B: Generate Case ID & Correlation ID

    B->>S: PUT orders-incoming/{caseId}/original.xlsx
    S-->>B: 201 Created

    B->>C: INSERT case (status: pending)
    C-->>B: OK

    B->>E: POST /api/workflow/start
    E->>Temp: client.workflow.start(orderProcessingWorkflow)
    Temp-->>E: workflowId, runId
    E-->>B: 202 Accepted (workflowId)

    B->>T: Adaptive Card (Processing...)
    T->>U: Display card

    Note over U,Temp: Case ID = Workflow ID = Correlation ID for tracing
```

### 2. Parsing Phase

```mermaid
sequenceDiagram
    autonumber
    participant Temp as Temporal Server
    participant W as Temporal Worker
    participant P as Parser Activity
    participant S as Blob Storage
    participant C as Cosmos DB

    Temp->>W: Schedule parseOrder activity
    W->>P: Execute parseOrder(caseId, blobUrl)
    P->>S: GET original.xlsx
    S-->>P: File contents

    Note over P: Formula Detection

    alt Formulas Found
        P-->>W: ActivityFailure (formulas_detected)
        W->>Temp: Activity failed
        Temp->>C: UPDATE case (status: blocked)
    else No Formulas
        Note over P: Sheet Selection<br/>Header Detection<br/>Schema Inference<br/>Row Extraction<br/>Validation

        P->>S: PUT orders-audit/{caseId}/canonical.json
        P->>S: PUT orders-audit/{caseId}/evidence.json

        P-->>W: CanonicalOrder + Issues

        alt Has Blocker Issues
            W->>C: UPDATE case (status: blocked)
        else Has Error Issues
            W->>C: UPDATE case (status: needs_input)
        else Success
            W->>C: UPDATE case (status: parsing_complete)
        end
    end
```

### 3. Committee Review

```mermaid
sequenceDiagram
    autonumber
    participant Temp as Temporal Server
    participant W as Temporal Worker
    participant CE as Committee Activity
    participant P1 as Provider 1<br/>(GPT-5)
    participant P2 as Provider 2<br/>(Claude)
    participant P3 as Provider 3<br/>(DeepSeek)
    participant S as Blob Storage

    Temp->>W: Schedule reviewMappings activity
    W->>CE: Execute reviewMappings(evidencePack)

    Note over CE: Select 3 random providers<br/>Prepare bounded evidence pack

    par Parallel Provider Calls
        CE->>P1: Schema mapping request
        CE->>P2: Schema mapping request
        CE->>P3: Schema mapping request
    end

    P1-->>CE: Mappings + confidence
    P2-->>CE: Mappings + confidence
    P3-->>CE: Mappings + confidence

    Note over CE: Validate JSON schemas<br/>Aggregate weighted votes<br/>Detect consensus

    CE->>S: PUT committee-outputs/{taskId}/

    alt Unanimous/Majority
        CE-->>W: Consensus result
        W-->>Temp: Activity success
    else Split/No Consensus
        CE-->>W: Requires human review
        W-->>Temp: Workflow awaits signal
    end
```

### 4. Human Correction Flow (Temporal Signals)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant T as Teams
    participant B as Bot
    participant E as Express API
    participant Temp as Temporal
    participant W as Temporal Worker
    participant C as Cosmos DB

    Note over Temp: Workflow waiting for signal

    Temp->>B: NotifyUser callback (issues)
    B->>T: Adaptive Card (Issues)
    T->>U: Display correction form

    U->>T: Submit corrections
    T->>B: Card action data

    B->>E: POST /api/workflow/{workflowId}/signal
    E->>Temp: client.workflow.signal(correctionsSubmitted, data)

    Note over Temp: Workflow receives signal<br/>Resumes execution

    Temp->>W: Schedule applyCorrections activity
    W->>W: Apply corrections, revalidate

    W->>C: UPDATE case (corrections applied)

    alt Still has issues
        Temp->>B: NotifyUser callback (remaining issues)
    else All resolved
        W->>C: UPDATE case (status: ready)
        Temp->>B: NotifyUser callback (ready for approval)
    end
```

### 5. Entity Resolution

```mermaid
sequenceDiagram
    autonumber
    participant Temp as Temporal Server
    participant W as Temporal Worker
    participant Z as Zoho Activity
    participant Cache as Customer/Item Cache
    participant API as Zoho Books API

    Temp->>W: Schedule resolveCustomer activity
    W->>Z: Execute resolveCustomer(inputName)
    Z->>Cache: Lookup customer

    alt Cache Hit
        Cache-->>Z: Customer data
    else Cache Miss
        Z->>API: Search customers
        API-->>Z: Results
        Z->>Cache: Update cache
    end

    Note over Z: Exact match?<br/>Fuzzy match?<br/>Multiple candidates?

    alt Single Match
        Z-->>W: Resolved (zoho_customer_id)
    else Multiple Candidates
        Z-->>W: Ambiguous (candidates[])
    else No Match
        Z-->>W: Not found
    end

    Temp->>W: Schedule resolveItems activity
    W->>Z: Execute resolveItems(lineItems[])

    loop For each line item
        Z->>Cache: Lookup by SKU
        alt SKU Found
            Cache-->>Z: Item with Zoho rate
        else Try GTIN
            Z->>Cache: Lookup by GTIN
        else Not Found
            Z-->>W: Unresolved item
        end
    end

    Z-->>W: Item matches (with Zoho rates)
```

### 6. Approval and Creation

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant T as Teams
    participant B as Bot
    participant E as Express API
    participant Temp as Temporal
    participant W as Temporal Worker
    participant Z as Zoho Activity
    participant API as Zoho Books API
    participant S as Blob Storage
    participant C as Cosmos DB

    Temp->>B: NotifyUser callback (ReadyForApproval)
    B->>T: Review Card (order preview)
    T->>U: Display with Approve/Reject

    U->>T: Click Approve
    T->>B: Action: approve
    B->>E: POST /api/workflow/{workflowId}/signal
    E->>Temp: client.workflow.signal(approvalReceived, approved=true)

    Note over Temp: Workflow receives approval signal

    Temp->>W: Schedule createDraftSalesOrder activity
    W->>Z: Execute createDraftSalesOrder(order)

    Note over Z: Compute fingerprint<br/>Check for duplicate

    alt Duplicate Found
        Z-->>W: Existing order link
    else New Order
        Z->>API: POST /salesorders (draft)
        API-->>Z: Sales Order created

        Z->>S: PUT zoho-audit-logs/{correlationId}.json
        Z->>C: INSERT fingerprint

        Z-->>W: Success (SO number, link)
    end

    W->>C: UPDATE case (status: created, zohoOrderId)
    Temp->>B: NotifyUser callback (Success)
    B->>T: Success Card (Zoho link)
    T->>U: Display confirmation
```

### 7. Workflow State Machine (Temporal)

```mermaid
flowchart TD
    subgraph Temporal["Temporal Workflow"]
        Start([Start]) --> Parse
        Parse["parseOrder Activity"]
        Parse --> ParseResult{Result?}

        ParseResult -->|Blocked| NotifyBlocked["Notify User"]
        ParseResult -->|Errors| WaitCorrections["Await Signal:<br/>correctionsSubmitted"]
        ParseResult -->|Success| Committee["reviewMappings Activity"]

        Committee --> CommitteeResult{Consensus?}
        CommitteeResult -->|Yes| Resolve["resolveEntities Activity"]
        CommitteeResult -->|No| WaitHumanMapping["Await Signal:<br/>mappingsProvided"]

        WaitHumanMapping -->|Signal| ApplyMappings["applyMappings Activity"]
        ApplyMappings --> Resolve

        Resolve --> ResolveResult{All Resolved?}
        ResolveResult -->|Yes| WaitApproval["Await Signal:<br/>approvalReceived"]
        ResolveResult -->|No| WaitSelection["Await Signal:<br/>selectionMade"]

        WaitSelection -->|Signal| ApplySelection["applySelection Activity"]
        ApplySelection --> ResolveResult

        WaitApproval -->|Approved| CreateDraft["createDraftSalesOrder Activity"]
        WaitApproval -->|Rejected| Cancelled([Cancelled])

        CreateDraft --> CreateResult{Success?}
        CreateResult -->|Yes| Complete([Completed])
        CreateResult -->|ActivityFailure| RetryLogic
    end

    subgraph RetryLogic["Temporal Retry Policy"]
        RetryLogic --> RetryCheck{Retries<br/>Exhausted?}
        RetryCheck -->|No| CreateDraft
        RetryCheck -->|Yes| Failed([Failed])
    end

    subgraph ExternalEvents["Signal Handling"]
        NotifyBlocked --> |User re-uploads| Start
        WaitCorrections --> |User corrects| Parse
        Complete([Completed])
        Failed([Failed])
        Cancelled([Cancelled])
    end
```

## Data Structures

### Case Record (Cosmos DB)

```json
{
  "id": "case_abc123",
  "caseId": "case_abc123",
  "tenantId": "tenant-guid",
  "userId": "user-guid",
  "status": "ready",
  "fingerprint": "sha256:...",
  "createdAt": "2025-12-25T10:00:00Z",
  "updatedAt": "2025-12-25T10:05:00Z",
  "blobPrefix": "orders-incoming/case_abc123/",
  "fileName": "order.xlsx",
  "fileSha256": "abc123...",
  "customerName": "Acme Corp",
  "zohoCustomerId": null,
  "zohoOrderId": null,
  "zohoOrderNumber": null,
  "temporalWorkflowId": "order-case_abc123",
  "temporalRunId": "run-xyz789",
  "correlationId": "case_abc123"
}
```

### Audit Event (Blob Storage)

```json
{
  "ts": "2025-12-25T10:01:00Z",
  "sequence": 3,
  "event_type": "PARSE_COMPLETE",
  "case_id": "case_abc123",
  "tenant_id": "tenant-guid",
  "correlation": {
    "trace_id": "abc",
    "span_id": "def",
    "case_id": "case_abc123",
    "temporal_workflow_id": "order-case_abc123",
    "temporal_run_id": "run-xyz789"
  },
  "actor": {
    "type": "system",
    "service": "parser-activity"
  },
  "data": {
    "lines_extracted": 15,
    "issues_count": 2,
    "confidence": 0.92,
    "detected_language": "en"
  },
  "pointers": {
    "canonical_order": "orders-audit/case_abc123/canonical.json",
    "evidence": "orders-audit/case_abc123/evidence.json"
  }
}
```

### Fingerprint Record (Cosmos DB)

```json
{
  "id": "fp_sha256:abc...",
  "fingerprint": "sha256:abc123def456...",
  "caseId": "case_abc123",
  "tenantId": "tenant-guid",
  "zohoOrderId": "so_123",
  "zohoOrderNumber": "SO-00042",
  "createdAt": "2025-12-25T10:10:00Z"
}
```

### Committee Output (Blob Storage)

```json
{
  "taskId": "task_xyz789",
  "caseId": "case_abc123",
  "temporalWorkflowId": "order-case_abc123",
  "timestamp": "2025-12-25T10:02:00Z",
  "selectedProviders": [
    "azure-gpt-5.2",
    "azure-claude-opus-4.5",
    "azure-deepseek-v3.2"
  ],
  "providerOutputs": [
    {
      "providerId": "azure-gpt-5.2",
      "mappings": [...],
      "confidence": 0.94,
      "latencyMs": 1523
    }
  ],
  "aggregatedResult": {
    "consensus": "majority",
    "finalMappings": {...},
    "disagreements": [],
    "overallConfidence": 0.91
  },
  "requiresHumanReview": false,
  "executionTimeMs": 2341
}
```

## Correlation ID Propagation

```mermaid
flowchart LR
    subgraph Teams
        Activity["Activity ID"]
    end

    subgraph Headers["HTTP Headers"]
        XCorrelation["x-correlation-id"]
        XTrace["x-trace-id"]
        XSpan["x-span-id"]
    end

    subgraph Temporal["Temporal Context"]
        WorkflowId["Workflow ID"]
        RunId["Run ID"]
        ActivityId["Activity Task ID"]
    end

    subgraph Storage["Storage"]
        CosmosField["correlation_id field"]
        BlobPath["blob path includes case_id"]
    end

    subgraph Logs["Structured Logs"]
        LogField["correlationId"]
    end

    Activity --> XCorrelation
    XCorrelation --> WorkflowId
    WorkflowId --> CosmosField
    XCorrelation --> LogField
    XCorrelation --> BlobPath
    WorkflowId --> LogField
```

### Correlation Context Structure

```typescript
interface CorrelationContext {
  // End-to-end trace ID (same across all services)
  trace_id: string;

  // Current operation span
  span_id: string;

  // Parent span for distributed tracing
  parent_span_id?: string;

  // Business correlation (= case ID)
  case_id: string;

  // Teams-specific IDs
  teams_activity_id?: string;
  teams_conversation_id?: string;

  // Temporal workflow context
  temporal_workflow_id: string;
  temporal_run_id: string;
  temporal_activity_id?: string;
}
```

### Propagation Methods

| Channel | Method |
|---------|--------|
| HTTP Requests | `x-correlation-id`, `x-trace-id` headers |
| Temporal Workflows | Workflow ID, Run ID in context |
| Temporal Activities | Activity context propagation |
| Cosmos DB | Document fields (`correlationId`, `caseId`, `temporalWorkflowId`) |
| Blob Storage | Path includes case ID |
| Structured Logs | `correlationId`, `workflowId` fields |

## Service Interactions

```mermaid
graph TB
    subgraph Teams["Microsoft Teams"]
        Bot["Teams Bot<br/>/services/teams-bot"]
        Tab["Personal Tab<br/>/services/teams-tab"]
    end

    subgraph VM["Azure VM (VM-Only Architecture)"]
        subgraph Express["Express API Server"]
            API["Express Routes<br/>/api/*"]
            TemporalClient["Temporal Client"]
        end

        subgraph TemporalCluster["Temporal Server"]
            Frontend["Frontend Service"]
            History["History Service"]
            Matching["Matching Service"]
            TemporalDB[("SQLite/PostgreSQL")]
        end

        subgraph Workers["Temporal Workers"]
            Worker1["Worker Process"]
            Activities["Activities"]
        end

        subgraph ActivityImpl["Activity Implementations"]
            Parser["Parser Activity"]
            Committee["Committee Activity"]
            Zoho["Zoho Activity"]
            Storage["Storage Activity"]
        end
    end

    subgraph Data["Data Layer"]
        Blob[("Azure Blob<br/>5y retention")]
        Cosmos[("Cosmos DB<br/>Case state")]
        KeyVault[("Key Vault<br/>Secrets")]
    end

    subgraph External["External Services"]
        ZohoAPI["Zoho Books API"]
        AIFoundry["Azure AI Foundry"]
        Gemini["Google Gemini"]
        XAI["xAI Grok"]
    end

    Bot --> API
    Bot --> Blob
    Tab --> API
    API --> TemporalClient
    TemporalClient --> Frontend
    API --> Cosmos

    Frontend --> History
    Frontend --> Matching
    History --> TemporalDB
    Matching --> Worker1

    Worker1 --> Activities
    Activities --> Parser
    Activities --> Committee
    Activities --> Zoho
    Activities --> Storage

    Parser --> Blob
    Committee --> AIFoundry
    Committee --> Gemini
    Committee --> XAI
    Committee --> Blob

    Zoho --> ZohoAPI
    Zoho --> Cosmos
    Zoho --> Blob
    Zoho --> KeyVault

    Storage --> Blob
    Storage --> Cosmos
```

## Temporal Retry and Error Handling

### Activity Retry Policy

Temporal provides built-in retry handling for activities. Each activity type has a configured retry policy:

```typescript
// Default retry policy for activities
const defaultRetryPolicy: RetryPolicy = {
  initialInterval: '1s',
  backoffCoefficient: 2.0,
  maximumInterval: '1h',
  maximumAttempts: 6,
  nonRetryableErrorTypes: [
    'ValidationError',
    'DuplicateOrderError',
    'AuthenticationError'
  ]
};

// Zoho API activity (more aggressive retries for rate limiting)
const zohoRetryPolicy: RetryPolicy = {
  initialInterval: '1m',
  backoffCoefficient: 2.0,
  maximumInterval: '1h',
  maximumAttempts: 6,
  nonRetryableErrorTypes: [
    'DuplicateOrderError',
    'InvalidPayloadError'
  ]
};
```

### Retry Flow Diagram

```mermaid
sequenceDiagram
    participant Temp as Temporal Server
    participant W as Temporal Worker
    participant Z as Zoho Activity
    participant API as Zoho Books API

    Temp->>W: Schedule createDraftSalesOrder
    W->>Z: Execute activity
    Z->>API: POST /salesorders

    alt Success
        API-->>Z: 201 Created
        Z-->>W: Activity Success
        W-->>Temp: Complete
    else Rate Limited (429)
        API-->>Z: 429 Too Many Requests
        Z-->>W: ActivityFailure (retryable)
        Note over Temp: Apply retry policy<br/>Wait initialInterval * backoffCoefficient^attempt
        Temp->>W: Retry activity (attempt 2)
    else Server Error (5xx)
        API-->>Z: 500/502/503/504
        Z-->>W: ActivityFailure (retryable)
        Note over Temp: Apply retry policy
        Temp->>W: Retry activity
    else Non-Retryable Error
        API-->>Z: 400 Bad Request
        Z-->>W: ActivityFailure (non-retryable)
        Note over Temp: Skip retries
        Temp->>Temp: Workflow handles failure
    end

    Note over Temp: After max attempts exhausted
    Temp->>Temp: Workflow receives ActivityFailure
```

### Exponential Backoff Schedule (Temporal Managed)

| Attempt | Delay (Zoho) | Cumulative |
|---------|--------------|------------|
| 1 | 1 minute | 1 minute |
| 2 | 2 minutes | 3 minutes |
| 3 | 4 minutes | 7 minutes |
| 4 | 8 minutes | 15 minutes |
| 5 | 16 minutes | 31 minutes |
| 6 | 32 minutes | 63 minutes |

### Workflow-Level Error Handling

```typescript
// In workflow definition
async function orderProcessingWorkflow(input: OrderInput): Promise<OrderResult> {
  try {
    // Activities are automatically retried per their retry policy
    const parseResult = await parseOrder(input.caseId, input.blobUrl);

    if (parseResult.hasBlockers) {
      // Workflow waits for signal to continue
      await condition(() => correctionReceived, '7d');
    }

    const reviewResult = await reviewMappings(parseResult.evidence);

    // ... rest of workflow

  } catch (error) {
    if (error instanceof ActivityFailure) {
      // All retries exhausted - update case status
      await updateCaseStatus(input.caseId, 'failed', error.message);
      throw error;
    }
    throw error;
  }
}
```

## Workflow Monitoring (Temporal Web UI)

The Temporal Web UI provides comprehensive workflow monitoring at `http://<vm-ip>:8080`:

### Monitoring Capabilities

| Feature | Description |
|---------|-------------|
| Workflow List | View all running, completed, and failed workflows |
| Workflow Detail | Inspect workflow history, inputs, outputs |
| Activity Timeline | Visual timeline of activity executions |
| Signal History | View all signals sent to workflows |
| Query Workflows | Execute queries to get workflow state |
| Retry Operations | Manually retry failed activities |
| Cancel/Terminate | Stop running workflows |

### Workflow States in UI

| State | Description |
|-------|-------------|
| Running | Workflow actively executing or waiting for signal |
| Completed | Workflow finished successfully |
| Failed | Workflow failed after all retries exhausted |
| Cancelled | Workflow was manually cancelled |
| Terminated | Workflow was forcefully terminated |
| TimedOut | Workflow exceeded execution timeout |

### Accessing Workflow Details

```bash
# Via Temporal CLI (tctl)
tctl workflow describe --workflow_id order-case_abc123

# List running workflows
tctl workflow list --query "ExecutionStatus='Running'"

# Send signal to workflow
tctl workflow signal --workflow_id order-case_abc123 \
  --name correctionsSubmitted \
  --input '{"corrections": [...]}'
```
