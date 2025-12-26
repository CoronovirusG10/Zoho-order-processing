# Data Flow Documentation

## Overview

This document describes the complete request flow through the Order Processing system, from file upload in Teams to draft sales order creation in Zoho Books.

## High-Level Flow

```mermaid
flowchart LR
    subgraph Teams["Microsoft Teams"]
        User[("User")]
        Bot["Teams Bot"]
        Tab["Personal Tab"]
    end

    subgraph Azure["Azure (Tenant A)"]
        API["API Service"]
        Workflow["Durable Functions"]
        Parser["Parser Service"]
        Committee["Committee Engine"]
        Zoho["Zoho Service"]
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
    Bot -->|Start workflow| Workflow
    Workflow -->|Parse| Parser
    Workflow -->|Review| Committee
    Committee -->|Query| AIProviders
    Workflow -->|Resolve| Zoho
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
    participant W as Workflow

    U->>T: Upload order.xlsx
    T->>B: POST /api/messages (attachment)

    Note over B: Generate Case ID & Correlation ID

    B->>S: PUT orders-incoming/{caseId}/original.xlsx
    S-->>B: 201 Created

    B->>C: INSERT case (status: pending)
    C-->>B: OK

    B->>W: POST /api/workflow/start
    W-->>B: 202 Accepted (instanceId)

    B->>T: Adaptive Card (Processing...)
    T->>U: Display card

    Note over U,W: Case ID = Correlation ID for tracing
```

### 2. Parsing Phase

```mermaid
sequenceDiagram
    autonumber
    participant W as Workflow
    participant P as Parser
    participant S as Blob Storage
    participant C as Cosmos DB

    W->>P: Parse(caseId, blobUrl)
    P->>S: GET original.xlsx
    S-->>P: File contents

    Note over P: Formula Detection

    alt Formulas Found
        P-->>W: BLOCKED (formulas_detected)
        W->>C: UPDATE case (status: blocked)
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
    participant W as Workflow
    participant CE as Committee Engine
    participant P1 as Provider 1<br/>(GPT-5)
    participant P2 as Provider 2<br/>(Claude)
    participant P3 as Provider 3<br/>(DeepSeek)
    participant S as Blob Storage

    W->>CE: ReviewMappings(evidencePack)

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
    else Split/No Consensus
        CE-->>W: Requires human review
    end
```

### 4. Human Correction Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant T as Teams
    participant B as Bot
    participant W as Workflow
    participant C as Cosmos DB

    Note over W: Workflow waiting for event

    W->>B: NotifyUser(issues)
    B->>T: Adaptive Card (Issues)
    T->>U: Display correction form

    U->>T: Submit corrections
    T->>B: Card action data

    B->>W: RaiseEvent(CorrectionsSubmitted, data)

    Note over W: Apply corrections<br/>Revalidate

    W->>C: UPDATE case (corrections applied)

    alt Still has issues
        W->>B: NotifyUser(remaining issues)
    else All resolved
        W->>C: UPDATE case (status: ready)
        W->>B: NotifyUser(ready for approval)
    end
```

### 5. Entity Resolution

```mermaid
sequenceDiagram
    autonumber
    participant W as Workflow
    participant Z as Zoho Service
    participant Cache as Customer/Item Cache
    participant API as Zoho Books API

    W->>Z: ResolveCustomer(inputName)
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

    W->>Z: ResolveItems(lineItems[])

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
    participant W as Workflow
    participant Z as Zoho Service
    participant API as Zoho Books API
    participant S as Blob Storage
    participant C as Cosmos DB

    W->>B: NotifyUser(ReadyForApproval)
    B->>T: Review Card (order preview)
    T->>U: Display with Approve/Reject

    U->>T: Click Approve
    T->>B: Action: approve
    B->>W: RaiseEvent(ApprovalReceived, approved=true)

    W->>Z: CreateDraftSalesOrder(order)

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
    W->>B: NotifyUser(Success)
    B->>T: Success Card (Zoho link)
    T->>U: Display confirmation
```

### 7. Error Handling Flow

```mermaid
flowchart TD
    subgraph Workflow["Workflow Orchestrator"]
        Start([Start]) --> Parse
        Parse --> ParseResult{Result?}

        ParseResult -->|Blocked| NotifyBlocked
        ParseResult -->|Errors| WaitCorrections
        ParseResult -->|Success| Committee

        Committee --> CommitteeResult{Consensus?}
        CommitteeResult -->|Yes| Resolve
        CommitteeResult -->|No| WaitHumanMapping

        WaitHumanMapping -->|Event| ApplyMappings
        ApplyMappings --> Resolve

        Resolve --> ResolveResult{All Resolved?}
        ResolveResult -->|Yes| WaitApproval
        ResolveResult -->|No| WaitSelection

        WaitSelection -->|Event| ApplySelection
        ApplySelection --> ResolveResult

        WaitApproval -->|Approved| CreateDraft
        WaitApproval -->|Rejected| Cancelled

        CreateDraft --> CreateResult{Success?}
        CreateResult -->|Yes| Complete
        CreateResult -->|Queued| Queued
        CreateResult -->|Failed| Failed
    end

    subgraph States["Case States"]
        NotifyBlocked --> |User re-uploads| Start
        WaitCorrections --> |User corrects| Parse
        Queued --> |Retry succeeds| Complete
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
  "workflowInstanceId": "wf-xyz789",
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
    "case_id": "case_abc123"
  },
  "actor": {
    "type": "system",
    "service": "parser"
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

    subgraph Storage["Storage"]
        CosmosField["correlation_id field"]
        BlobPath["blob path includes case_id"]
    end

    subgraph Logs["Structured Logs"]
        LogField["correlationId"]
        AppInsights["customDimensions.caseId"]
    end

    Activity --> XCorrelation
    XCorrelation --> CosmosField
    XCorrelation --> LogField
    XCorrelation --> AppInsights
    XCorrelation --> BlobPath
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

  // Workflow-specific
  workflow_instance_id?: string;

  // Foundry agent run
  foundry_run_id?: string;
}
```

### Propagation Methods

| Channel | Method |
|---------|--------|
| HTTP Requests | `x-correlation-id`, `x-trace-id` headers |
| Service Bus | Message properties |
| Cosmos DB | Document fields (`correlationId`, `caseId`) |
| Blob Storage | Path includes case ID |
| Structured Logs | `correlationId` field |
| App Insights | `customDimensions.caseId` |

## Service Interactions

```mermaid
graph TB
    subgraph Teams["Microsoft Teams"]
        Bot["Teams Bot<br/>/services/teams-bot"]
        Tab["Personal Tab<br/>/services/teams-tab"]
    end

    subgraph Core["Core Services"]
        API["API Service<br/>/services/api"]
        Workflow["Workflow<br/>/services/workflow"]
    end

    subgraph Processing["Processing Services"]
        Parser["Parser<br/>/services/parser"]
        Committee["Committee<br/>/services/committee"]
        Zoho["Zoho Service<br/>/services/zoho"]
        Storage["Storage<br/>/services/storage"]
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
    API --> Cosmos
    API --> Workflow

    Workflow --> Parser
    Workflow --> Committee
    Workflow --> Zoho
    Workflow --> Storage

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

## Queue and Retry Patterns

### Zoho Retry Queue

```mermaid
sequenceDiagram
    participant W as Workflow
    participant Z as Zoho Service
    participant Q as Retry Queue
    participant API as Zoho API

    W->>Z: CreateDraftSalesOrder
    Z->>API: POST /salesorders

    alt Success
        API-->>Z: 201 Created
        Z-->>W: Success
    else Rate Limited (429)
        API-->>Z: 429 Too Many Requests
        Z->>Q: Enqueue(caseId, payload, attempt=1)
        Z-->>W: Queued for retry
    else Server Error (5xx)
        API-->>Z: 500/502/503/504
        Z->>Q: Enqueue(caseId, payload, attempt=1)
        Z-->>W: Queued for retry
    end

    Note over Q: Timer: Every 5 minutes

    loop Process Queue
        Q->>Q: Dequeue ready items
        Q->>API: Retry request
        alt Success
            API-->>Q: 201 Created
            Q->>W: Event: OrderCreated
        else Still failing
            alt Max retries reached
                Q->>W: Event: OrderFailed
            else Retry later
                Q->>Q: Enqueue with backoff
            end
        end
    end
```

### Exponential Backoff Schedule

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | 1 minute | 1 minute |
| 2 | 2 minutes | 3 minutes |
| 3 | 4 minutes | 7 minutes |
| 4 | 8 minutes | 15 minutes |
| 5 | 16 minutes | 31 minutes |
| 6+ | 1 hour (max) | - |
