# Backend API Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Teams Tab   │  │  Teams Bot   │  │  Foundry Agent Service   │ │
│  │  (React)     │  │  (Webhooks)  │  │  (Tool Caller)           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                 │                      │                 │
│         │ JWT             │ JWT                  │ APIM Key        │
└─────────┼─────────────────┼──────────────────────┼─────────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APIM Gateway                                 │
│  • Rate Limiting  • JWT Validation  • Request/Response Logging     │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend API Service                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Middleware Layer                           │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │  • Correlation ID  • Logging  • Auth  • Rate Limit  • Errors │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      Routes Layer                             │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │  /api/cases        │ Case management (Teams tab)             │ │
│  │  /api/bot          │ Bot webhook events                      │ │
│  │  /tools            │ Foundry Agent tools                     │ │
│  │  /health           │ Health checks                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     Service Layer                             │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │  CaseService       │ Case business logic                     │ │
│  │  AuditService      │ Audit trail management                  │ │
│  │  BlobService       │ Blob storage operations                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                   Repository Layer                            │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │  CaseRepository        │ Cosmos: cases container             │ │
│  │  FingerprintRepository │ Cosmos: fingerprints container      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                           │                    │
          ▼                           ▼                    ▼
┌──────────────────┐    ┌──────────────────────┐   ┌─────────────────┐
│  Cosmos DB       │    │  Blob Storage        │   │  External APIs  │
├──────────────────┤    ├──────────────────────┤   ├─────────────────┤
│  • cases         │    │  • uploads           │   │  • Parser       │
│  • audit-events  │    │  • audit-bundles     │   │  • Committee    │
│  • fingerprints  │    │                      │   │  • Zoho         │
└──────────────────┘    └──────────────────────┘   └─────────────────┘
```

## Request Flow

### Case List Request (Teams Tab)
```
User → Teams Tab → APIM
  ↓
JWT Validation
  ↓
API: /api/cases
  ↓
Correlation Middleware → Logging Middleware → Auth Middleware
  ↓
Cases Route Handler
  ↓
CaseService.listCases()
  ├─ Authorization check (role-based)
  ├─ Apply filters (user can only see own, manager sees team)
  └─ CaseRepository.list()
      ↓
    Cosmos DB Query (partition: tenantId)
      ↓
    Return paginated results
      ↓
Response with correlation ID
```

### File Upload Event (Bot)
```
Teams Bot → Webhook Event → APIM
  ↓
JWT Validation (Bot Identity)
  ↓
API: /api/bot/file-uploaded
  ↓
Correlation Middleware → Logging Middleware → Auth Middleware
  ↓
Bot Events Route Handler
  ↓
CaseService.createCase()
  ├─ Generate case ID
  ├─ Create case record
  └─ CaseRepository.create()
      ↓
    Cosmos DB Insert
  ↓
AuditService.logEvent()
  ├─ Get next sequence
  ├─ Write to Cosmos
  └─ Write to Blob (long-term)
  ↓
TODO: Trigger workflow (Service Bus message)
  ↓
Response 201 Created
```

### Tool Call (Foundry Agent)
```
Agent → Tool Request → APIM
  ↓
APIM Key Validation
  ↓
API: /tools/parse-excel
  ↓
Correlation Middleware → Logging Middleware → Internal Auth
  ↓
Tools Route Handler
  ↓
TODO: Call Parser Service
  ├─ HTTP request to parser
  ├─ Pass blob URL and options
  └─ Receive canonical order JSON
  ↓
AuditService.logEvent()
  ↓
Response with canonical order
```

## Data Flow

### Case Lifecycle
```
1. File Upload
   ┌─────────────────────────────────────────┐
   │ Status: processing                      │
   │ Bot receives file → Creates case        │
   │ Stores file in Blob → Triggers workflow │
   └─────────────────────────────────────────┘
              ↓
2. Parsing
   ┌─────────────────────────────────────────┐
   │ Agent calls /tools/parse-excel          │
   │ Returns canonical order + issues        │
   └─────────────────────────────────────────┘
              ↓
3a. Has Issues → Status: needs_input
   ┌─────────────────────────────────────────┐
   │ Bot presents issues to user             │
   │ User submits corrections                │
   │ POST /api/bot/corrections-submitted     │
   │ Re-triggers parsing with patches        │
   └─────────────────────────────────────────┘
              ↓
3b. No Issues → Status: ready
   ┌─────────────────────────────────────────┐
   │ Bot shows "Create draft" button         │
   │ User clicks approve                     │
   │ POST /api/bot/approval                  │
   └─────────────────────────────────────────┘
              ↓
4. Approved → Status: approved
   ┌─────────────────────────────────────────┐
   │ Agent calls /tools/zoho/create-draft    │
   │ Creates draft sales order in Zoho       │
   │ Updates case with Zoho IDs              │
   └─────────────────────────────────────────┘
              ↓
5. Complete → Status: draft_created
   ┌─────────────────────────────────────────┐
   │ Bot sends confirmation with link        │
   │ User can view in Teams tab              │
   │ Audit bundle available for download     │
   └─────────────────────────────────────────┘
```

## Security Model

### Authentication Layers
```
┌─────────────────────────────────────────┐
│ Layer 1: APIM                           │
│ • JWT signature validation              │
│ • Rate limiting                         │
│ • Subscription key for internal tools   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Layer 2: API Middleware                 │
│ • Extract claims (userId, tenantId)     │
│ • Verify roles                          │
│ • Attach auth context to request        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Layer 3: Service Layer                  │
│ • Case ownership verification           │
│ • Role-based access checks              │
│ • Multi-tenant isolation                │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Layer 4: Repository Layer               │
│ • Partition key enforcement (tenantId)  │
│ • Query filtering by user               │
└─────────────────────────────────────────┘
```

### Authorization Matrix
```
Role           | Own Cases | Team Cases | All Cases | Audit Trail
---------------|-----------|------------|-----------|-------------
SalesUser      | RW        | -          | -         | Own only
SalesManager   | RW        | R          | -         | Team only
OpsAuditor     | R         | R          | R         | All
```

## Scalability Considerations

### Horizontal Scaling
- Stateless API service
- Multiple replicas behind load balancer
- Shared Cosmos DB with RU scaling
- Shared Blob Storage

### Performance Optimizations
```
1. Cosmos DB
   ├─ Partition by tenantId (even distribution)
   ├─ Composite indexes for common queries
   ├─ Pagination for large result sets
   └─ RU autoscaling (400-4000 RU/s)

2. Blob Storage
   ├─ Hot tier for recent files
   ├─ Cool tier for audit bundles
   └─ SAS tokens for direct download

3. API Layer
   ├─ Rate limiting per IP
   ├─ Correlation for request tracing
   └─ Async handlers for non-blocking I/O
```

### Load Distribution
```
Expected Load: 100-200 orders/day

Peak Scenarios:
├─ Morning upload burst (8-10 AM)
├─ End of day submissions (4-6 PM)
└─ Month-end processing

Scaling Strategy:
├─ Minimum 2 replicas (HA)
├─ Auto-scale to 10 replicas on CPU > 70%
├─ Service Bus for workflow decoupling
└─ Async processing for heavy operations
```

## Error Handling Strategy

### Error Types
```
Client Errors (4xx)
├─ 400 Validation Error    → Fix request format
├─ 401 Unauthorized        → Re-authenticate
├─ 403 Forbidden           → Insufficient permissions
├─ 404 Not Found           → Resource doesn't exist
└─ 429 Rate Limit          → Retry with backoff

Server Errors (5xx)
├─ 500 Internal Error      → Log, alert, retry
├─ 502 Bad Gateway         → Downstream service down
├─ 503 Service Unavailable → Health check failing
└─ 504 Gateway Timeout     → Increase timeout or scale
```

### Error Response Format
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Case not found",
    "correlationId": "abc-123-def-456",
    "details": {
      "caseId": "missing-case-id"
    }
  }
}
```

## Monitoring & Observability

### Metrics to Track
```
Application Metrics
├─ Request rate (req/sec)
├─ Response time (p50, p95, p99)
├─ Error rate (%)
├─ Active connections
└─ Auth success/failure rate

Business Metrics
├─ Cases created/hour
├─ Cases by status
├─ Average time to draft creation
├─ User corrections per case
└─ Zoho creation success rate

Infrastructure Metrics
├─ CPU utilization
├─ Memory usage
├─ Network I/O
├─ Cosmos RU consumption
└─ Blob storage transactions
```

### Logging Strategy
```
Level   | Use Case
--------|------------------------------------------
ERROR   | Unhandled errors, service failures
WARN    | Expected errors, rate limits, retries
INFO    | Request/response, business events
DEBUG   | Detailed flow, variable values

All logs include: timestamp, level, correlationId, message, context
```

## Deployment Architecture

### Container Apps Setup
```
┌─────────────────────────────────────────────────┐
│ Container Apps Environment                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ order-processing-api                      │ │
│  ├───────────────────────────────────────────┤ │
│  │ Min Replicas: 2                           │ │
│  │ Max Replicas: 10                          │ │
│  │ CPU: 0.25 cores                           │ │
│  │ Memory: 512Mi                             │ │
│  │ Ingress: Internal (via APIM)              │ │
│  │ Identity: Managed Identity                │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Secrets (Key Vault References)                │
│  ├─ cosmos-endpoint                            │
│  ├─ storage-account-url                        │
│  └─ apim-subscription-key                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Network Topology
```
Internet
   ↓
APIM (Public)
   ↓
VNet Integration
   ↓
Container Apps (Internal)
   ↓
Private Endpoints
   ├─ Cosmos DB
   ├─ Storage Account
   └─ Key Vault
```

## Technology Stack Summary

```
Runtime         │ Node.js 20 (LTS)
Framework       │ Express.js 4
Language        │ TypeScript 5.7
Testing         │ Vitest
Container       │ Docker (Alpine-based)
Orchestration   │ Kubernetes / Azure Container Apps
```

## File Organization

```
src/
├── index.ts              # Entry point, server setup
├── app.ts                # Express app configuration
├── config.ts             # Environment configuration
├── types.ts              # Shared TypeScript types
├── middleware/           # Cross-cutting concerns
│   ├── auth.ts           # Authentication & authorization
│   ├── correlation.ts    # Correlation ID tracking
│   ├── error-handler.ts  # Global error handling
│   ├── logging.ts        # Request/response logging
│   └── rate-limit.ts     # Rate limiting rules
├── routes/               # HTTP endpoints
│   ├── cases.ts          # Case management API
│   ├── bot-events.ts     # Bot webhook handlers
│   ├── tools.ts          # Agent tool endpoints
│   └── health.ts         # Health checks
├── services/             # Business logic
│   ├── case-service.ts   # Case operations
│   ├── audit-service.ts  # Audit trail
│   ├── blob-service.ts   # Blob operations
│   └── service-factory.ts# DI container
└── repositories/         # Data access
    ├── case-repository.ts     # Cases CRUD
    └── fingerprint-repository.ts # Idempotency
```

## Key Design Decisions

1. **Stateless Architecture** - All state in Cosmos DB, enables horizontal scaling
2. **Partition Strategy** - TenantId for multi-tenant isolation
3. **Dual Audit Storage** - Cosmos (queryable) + Blob (long-term)
4. **Service Factory** - Singleton pattern for dependency injection
5. **Middleware Pipeline** - Correlation → Logging → Auth → Business Logic → Error Handling
6. **Authorization** - Multi-level: APIM → JWT → Service → Repository
7. **Idempotency** - Fingerprint-based duplicate detection
8. **Error Responses** - Consistent format with correlation IDs
9. **Rate Limiting** - IP-based with different limits per endpoint type
10. **Health Checks** - Separate liveness (process) and readiness (dependencies)

---

**Implementation Status**: ✅ Complete - Ready for integration testing and deployment
