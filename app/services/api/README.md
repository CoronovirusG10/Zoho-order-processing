# Order Processing API Service

Backend API service for the Teams → Excel → AI Committee → Zoho Draft Sales Orders application.

## Overview

This service provides:

1. **Case Management API** - REST endpoints for Teams tab to list/view cases
2. **Bot Webhook Handlers** - Endpoints for Teams bot events (file uploads, corrections, approvals)
3. **Tool Endpoints** - OpenAPI-compliant tools for Azure AI Foundry Agent Service
4. **Health Monitoring** - Health check endpoints for Kubernetes/Container Apps

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Service                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Routes                                                 │
│  ├─ /api/cases          (Teams tab)                    │
│  ├─ /api/bot            (Bot webhooks)                 │
│  ├─ /tools              (Foundry Agent tools)          │
│  └─ /health             (Health checks)                │
│                                                         │
│  Services                                              │
│  ├─ CaseService         (Case management)              │
│  ├─ AuditService        (Audit trail)                  │
│  └─ BlobService         (SAS URL generation)           │
│                                                         │
│  Repositories                                          │
│  ├─ CaseRepository      (Cosmos: cases)                │
│  └─ FingerprintRepository (Cosmos: fingerprints)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Case Management (`/api/cases`)

**Authentication:** Required (JWT from Teams SSO)

#### List Cases
```http
GET /api/cases?status=processing&limit=50&offset=0
```

Query Parameters:
- `status` - Filter by status (can be multiple)
- `customer` - Filter by customer name (partial match)
- `dateFrom` - Filter cases created after date (ISO 8601)
- `dateTo` - Filter cases created before date (ISO 8601)
- `userId` - Filter by user (managers only)
- `limit` - Page size (default: 50)
- `offset` - Pagination offset (default: 0)

Response:
```json
{
  "cases": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

#### Get Case
```http
GET /api/cases/:caseId
```

Authorization: User must own case or be manager/auditor

Response: Full `Case` object

#### Get Audit Trail
```http
GET /api/cases/:caseId/audit
```

Authorization: User must own case or be manager/auditor

Response:
```json
{
  "events": [
    {
      "sequence": 1,
      "timestamp": "2025-12-25T10:00:00Z",
      "eventType": "file_uploaded",
      "userId": "...",
      "data": {...}
    }
  ]
}
```

#### Get Download SAS URL
```http
GET /api/cases/:caseId/download-sas
```

Authorization: User must own case or be manager/auditor

Response:
```json
{
  "sasUrl": "https://...",
  "expiresAt": "2025-12-25T11:00:00Z"
}
```

### Bot Events (`/api/bot`)

**Authentication:** Required (Bot service principal)

#### File Uploaded
```http
POST /api/bot/file-uploaded
```

Body:
```json
{
  "caseId": "...",
  "blobUrl": "https://...",
  "tenantId": "...",
  "userId": "...",
  "activityId": "...",
  "fileName": "order.xlsx",
  "fileSha256": "..."
}
```

#### Corrections Submitted
```http
POST /api/bot/corrections-submitted
```

Body:
```json
{
  "caseId": "...",
  "corrections": [
    {
      "field": "customer.zoho_customer_id",
      "value": "123456"
    }
  ],
  "userId": "...",
  "tenantId": "..."
}
```

#### Approval
```http
POST /api/bot/approval
```

Body:
```json
{
  "caseId": "...",
  "approved": true,
  "userId": "...",
  "tenantId": "..."
}
```

### Tool Endpoints (`/tools`)

**Authentication:** Internal (APIM subscription key or Managed Identity)

These endpoints implement the OpenAPI specification in `v7/specs/internal-tools.openapi.yaml`.

#### Parse Excel
```http
POST /tools/parse-excel
```

Body:
```json
{
  "case_id": "...",
  "blob_url": "https://...",
  "options": {
    "block_if_formulas": true,
    "preferred_customer_hint": "Acme Corp"
  }
}
```

#### Committee Review
```http
POST /tools/committee-review
```

Body:
```json
{
  "case_id": "...",
  "task_type": "schema_mapping_review",
  "canonical_order": {...}
}
```

#### Create Draft Sales Order
```http
POST /tools/zoho/create-draft-salesorder
```

Body:
```json
{
  "case_id": "...",
  "canonical_order": {...},
  "dry_run": false
}
```

### Health Endpoints (`/health`)

**Authentication:** None required

```http
GET /health        # Basic health
GET /health/ready  # Readiness probe
GET /health/live   # Liveness probe
```

## Development

### Prerequisites
- Node.js 20+
- Azure Cosmos DB account
- Azure Storage account
- Azure credentials configured (DefaultAzureCredential)

### Install Dependencies
```bash
npm install
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reload.

### Build
```bash
npm run build
```

### Run Production
```bash
npm start
```

## Authentication & Authorization

### User Roles
- `SalesUser` - Can view own cases
- `SalesManager` - Can view team cases
- `OpsAuditor` - Can view all cases and audit trails

### JWT Claims
Required claims in JWT token:
- `oid` or `sub` - User ID
- `tid` - Tenant ID
- `roles` - Array of role names

### Internal Authentication
Tool endpoints require either:
- APIM subscription key in `ocp-apim-subscription-key` header
- Managed Identity JWT in `Authorization` header

## Cosmos DB Schema

### Cases Container
Partition key: `tenantId`

```typescript
{
  id: string;              // Same as caseId
  caseId: string;
  tenantId: string;
  userId: string;
  status: CaseStatus;
  blobUrl: string;
  fileName: string;
  fileSha256: string;
  customerName?: string;
  zohoSalesOrderId?: string;
  zohoSalesOrderNumber?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  correlationId: string;
}
```

### Fingerprints Container
Partition key: `tenantId`

Unique constraint on `fingerprint` field.

```typescript
{
  id: string;              // Same as fingerprint
  fingerprint: string;
  caseId: string;
  tenantId: string;
  createdAt: string;
  zohoSalesOrderId?: string;
}
```

### Audit Events Container
Partition key: `caseId`

```typescript
{
  id: string;
  caseId: string;
  tenantId: string;
  sequence: number;        // Auto-increment per case
  timestamp: string;
  eventType: string;
  userId?: string;
  data: object;
  correlationId: string;
}
```

## Error Handling

All errors return consistent format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "correlationId": "...",
    "details": {...}
  }
}
```

Error codes:
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)

## Logging

All logs are JSON formatted with:
- `level` - info, warn, error
- `message` - Log message
- `correlationId` - Request correlation ID
- Additional context fields

Never log:
- Secrets or credentials
- Full JWT tokens
- Sensitive customer data (use redaction)

## Rate Limiting

- Public API endpoints: 100 requests / 15 minutes per IP
- Bot webhooks: 30 requests / minute per IP

## Security

- All endpoints use HTTPS (enforced by APIM/ingress)
- Helmet.js for security headers
- CORS configured for Teams origins
- JWT validation (delegated to APIM in production)
- No secrets in logs
- Managed Identity for Azure service access

## Deployment

### Container Apps
```bash
# Build container
docker build -t order-processing-api .

# Deploy to Azure Container Apps
az containerapp update \
  --name api \
  --resource-group order-processing \
  --image order-processing-api:latest
```

### Environment Variables
Set in Container Apps configuration:
- `COSMOS_ENDPOINT`
- `COSMOS_DATABASE`
- `STORAGE_ACCOUNT_URL`
- `APIM_SUBSCRIPTION_KEY`

Use Key Vault references for secrets.

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

Private - Internal use only
