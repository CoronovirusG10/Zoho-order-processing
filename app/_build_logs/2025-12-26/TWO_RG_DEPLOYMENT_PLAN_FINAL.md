# Two-RG Deployment Plan for Order Processing Application

**Version:** 1.0 FINAL
**Date:** 2025-12-26
**Status:** Validated via Multi-Agent Review

---

## Executive Summary

Deploy the Order Processing application across two Azure Resource Groups:
- **pippai-rg** (existing): Shared platform infrastructure + compute
- **zoho-rg** (new): Application-specific data resources

**Critical Finding from Review:** The application requires Azure Functions for the workflow service (Durable Functions). This cannot run on VM alone.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AZURE (Tenant A)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐    ┌──────────────────────────────────┐ │
│  │  pippai-rg (EXISTING)          │    │  zoho-rg (NEW)                   │ │
│  │  ─────────────────────         │    │  ──────────────────────          │ │
│  │                                │    │                                  │ │
│  │  Compute:                      │    │  Compute (NEW):                  │ │
│  │  ├── pippai-vm ────────────────┼────┼─► Azure Functions App (Premium)  │ │
│  │  │   • Teams Bot (PM2)         │    │     • Workflow orchestration     │ │
│  │  │   • API Service (PM2)       │    │     • Durable Functions v3       │ │
│  │  │                             │    │                                  │ │
│  │  Shared Platform:              │    │  Data Layer:                     │ │
│  │  ├── Key Vault ◄───────────────┼────┼── Cosmos DB Account              │ │
│  │  │   (secrets)                 │ MI │    └── order-processing DB       │ │
│  │  ├── App Insights ◄────────────┼────┼──     ├── cases                  │ │
│  │  │   (telemetry)               │    │       ├── fingerprints           │ │
│  │  ├── Log Analytics ◄───────────┼────┼──     ├── audit-events           │ │
│  │  │   (diagnostics)             │    │       ├── cache                  │ │
│  │  ├── VNet (existing)           │    │       ├── committeeVotes         │ │
│  │  │   └── Subnets               │    │       └── agentThreads           │ │
│  │  └── AI Services               │    │                                  │ │
│  │                                │    │  └── Storage Account             │ │
│  └────────────────────────────────┘    │      ├── uploads (incoming)      │ │
│                                        │      ├── audit-bundles (WORM)    │ │
│                                        │      ├── committee-evidence      │ │
│                                        │      ├── logs-archive            │ │
│                                        │      └── Queues:                 │ │
│                                        │          ├── case-processing     │ │
│                                        │          └── zoho-retry          │ │
│                                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            TEAMS (Tenant B)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Teams App (Bot + Personal Tab) → Webhook to VM → Cross-tenant SSO          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Architecture Decision

### Why Azure Functions is Required

The codebase analysis revealed that the **workflow service** uses:
- `@azure/functions: ^4.6.0`
- `durable-functions: ^3.1.0`
- Azure Durable Functions v3 orchestrations with checkpointing

**Durable Functions cannot run on a VM with PM2.** They require:
1. Azure Functions runtime host
2. Azure Storage for Task Hub (state persistence)
3. Built-in timer and queue bindings

**Decision:** Deploy Azure Functions App in `zoho-rg` for workflow orchestration.

---

## Resource Allocation

### pippai-rg (Existing - Shared Platform)

| Resource | Name | Purpose | Changes |
|----------|------|---------|---------|
| Virtual Machine | pippai-vm | Teams Bot + API Service | Add MI roles for zoho-rg |
| Key Vault | pippai-keyvault-dev | Centralized secrets | Add zoho app secrets |
| App Insights | pippai-insights | Application telemetry | None |
| Log Analytics | pippai-logs | Diagnostic logs | None |
| VNet | pippai-vnet | Network isolation | None |
| AI Services | (existing) | AI model access | None |

### zoho-rg (New - Application-Specific)

| Resource | Name Pattern | Purpose | Config |
|----------|--------------|---------|--------|
| **Cosmos DB Account** | `order-processing-{env}-cosmos` | Order data | Serverless |
| Database | `order-processing` | App database | SQL API |
| Container: cases | cases | Case records | PK: `/tenantId` |
| Container: fingerprints | fingerprints | Idempotency | PK: `/fingerprint` |
| Container: audit-events | audit-events | Audit trail | PK: `/caseId` |
| Container: cache | cache | API cache (TTL 24h) | PK: `/cacheKey` |
| Container: committeeVotes | committeeVotes | AI voting logs | PK: `/caseId` |
| Container: agentThreads | agentThreads | Foundry agent state | PK: `/threadId`, TTL 30d |
| **Storage Account** | `orderstor{suffix}` | Order files | LRS |
| Container: uploads | uploads | Raw uploads | - |
| Container: audit-bundles | audit-bundles | WORM audit (5yr) | Immutable |
| Container: committee-evidence | committee-evidence | AI evidence packs | - |
| Container: logs-archive | logs-archive | Archived logs | Cool tier |
| Queue: case-processing | case-processing | Workflow queue | - |
| Queue: zoho-retry | zoho-retry | Retry queue | - |
| **Azure Functions App** | `order-processing-{env}-func` | Workflow orchestration | Premium EP1 |
| App Service Plan | `order-processing-{env}-plan` | Functions host | Elastic Premium |

---

## Service Deployment Specification

### Services on pippai-vm (PM2)

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| Teams Bot | 3978 | Node.js + Bot Framework | Teams webhook receiver |
| API Service | 3000 | Node.js + Express | REST API gateway |

```yaml
# ecosystem.config.js
apps:
  - name: teams-bot
    script: /app/services/teams-bot/dist/index.js
    instances: 1
    port: 3978
    max_memory_restart: 512M

  - name: api-service
    script: /app/services/api/dist/index.js
    instances: 1
    port: 3000
    max_memory_restart: 512M
```

### Services on Azure Functions (zoho-rg)

| Function | Trigger | Purpose |
|----------|---------|---------|
| workflow-orchestrator | HTTP/Durable | Order processing orchestration |
| order-activities | Activity | Workflow activity functions |
| case-entity | Entity | Durable entity for case state |
| http-trigger | HTTP | API endpoints for workflow control |

---

## Identity & Access Management

### Managed Identity Configuration

**pippai-vm System-Assigned MI:**

| Target Resource | Role | Scope |
|-----------------|------|-------|
| pippai-keyvault-dev | Key Vault Secrets User | pippai-rg |
| order-processing-{env}-cosmos | Cosmos DB Built-in Data Contributor | zoho-rg |
| orderstor{suffix} | Storage Blob Data Contributor | zoho-rg |

**Azure Functions System-Assigned MI:**

| Target Resource | Role | Scope |
|-----------------|------|-------|
| pippai-keyvault-dev | Key Vault Secrets User | pippai-rg |
| order-processing-{env}-cosmos | Cosmos DB Built-in Data Contributor | zoho-rg |
| orderstor{suffix} | Storage Blob Data Contributor | zoho-rg |
| orderstor{suffix} | Storage Queue Data Contributor | zoho-rg |

### CRITICAL: Cosmos DB RBAC Fix

The existing `rbac.bicep` uses an incorrect role assignment mechanism. Use Cosmos DB SQL role assignments:

```bicep
// CORRECT: Use Cosmos DB native SQL role assignments
resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, principalId, 'data-contributor')
  properties: {
    // Built-in Cosmos DB Data Contributor role
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: principalId
    scope: cosmosAccount.id
  }
}
```

---

## Secrets Management

### Secrets in pippai-keyvault-dev

| Secret Name | Source | Used By |
|-------------|--------|---------|
| ZohoClientId | Zoho Developer Console | Functions |
| ZohoClientSecret | Zoho Developer Console | Functions |
| ZohoRefreshToken | OAuth flow | Functions |
| ZohoOrganizationId | Zoho Books | Functions |
| MicrosoftAppId | Azure App Registration | Teams Bot |
| MicrosoftAppPassword | Azure App Registration | Teams Bot |
| OpenAiApiKey | Azure AI Foundry | Committee engine |
| GoogleAiApiKey | Google Cloud | Committee engine |
| AppInsightsConnectionString | pippai-rg | All services |

**Note:** Do NOT store Cosmos/Storage connection strings. Use Managed Identity with endpoint URLs only.

### Environment Variables - VM Services

```bash
# Key Vault (for secret retrieval)
KEY_VAULT_NAME=pippai-keyvault-dev

# Cosmos DB (MI auth - no keys)
COSMOS_ENDPOINT=https://order-processing-dev-cosmos.documents.azure.com:443/
COSMOS_DATABASE=order-processing

# Storage (MI auth - no keys)
STORAGE_ACCOUNT_URL=https://orderstor{suffix}.blob.core.windows.net

# App Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=<from-key-vault>

# Teams Bot
MICROSOFT_APP_ID=<from-key-vault>
MICROSOFT_APP_PASSWORD=<from-key-vault>
MICROSOFT_APP_TYPE=MultiTenant
```

### Environment Variables - Azure Functions

```bash
# Functions runtime
AzureWebJobsStorage=<storage-connection-for-task-hub>
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_RUN_FROM_PACKAGE=1

# Key Vault integration
KEY_VAULT_NAME=pippai-keyvault-dev

# Cosmos DB (MI auth)
COSMOS_ENDPOINT=https://order-processing-dev-cosmos.documents.azure.com:443/
COSMOS_DATABASE=order-processing

# Storage (MI auth)
STORAGE_ACCOUNT_URL=https://orderstor{suffix}.blob.core.windows.net
```

---

## Security Requirements (from Review)

### Must Fix Before Production

| Issue | Severity | Fix |
|-------|----------|-----|
| JWT verification disabled | HIGH | Implement JWT signature verification, don't just decode |
| Tenant isolation missing | HIGH | Add middleware to enforce `tenantId` on all queries |
| APIM key timing attack | HIGH | Use constant-time comparison for subscription key |
| Connection strings in outputs | HIGH | Remove from Bicep outputs, use MI only |

### Implementation Details

**1. JWT Verification (auth.ts):**
```typescript
// WRONG: jwt.decode() without verification
// RIGHT: Use Azure AD JWKS endpoint for verification
import jwksClient from 'jwks-rsa';
const client = jwksClient({ jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys' });
const verified = jwt.verify(token, getKey, { algorithms: ['RS256'] });
```

**2. Tenant Isolation Middleware:**
```typescript
// Add to all database queries
const tenantId = req.user.tenantId;
const query = { query: 'SELECT * FROM c WHERE c.tenantId = @tenantId', parameters: [{ name: '@tenantId', value: tenantId }] };
```

**3. Constant-time APIM Key Comparison:**
```typescript
import { timingSafeEqual } from 'crypto';
const isValid = timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
```

---

## Networking

### Connectivity Pattern

```
Internet → APIM/Load Balancer → pippai-vm (3000, 3978)
                                      │
                                      ├── Azure Functions (zoho-rg) via HTTPS
                                      ├── Cosmos DB (zoho-rg) via MI + HTTPS
                                      ├── Blob Storage (zoho-rg) via MI + HTTPS
                                      ├── Key Vault (pippai-rg) via MI + HTTPS
                                      └── App Insights (pippai-rg) via SDK
```

### Network Security Configuration

| Resource | Configuration |
|----------|---------------|
| Cosmos DB | Service endpoint + VNet firewall |
| Storage | Service endpoint + VNet firewall |
| Key Vault | Service endpoint + VNet firewall |
| Functions | VNet integration for outbound |

**CORS Configuration (Required for Production):**
```typescript
// MUST have explicit origins - no wildcard fallback
const CORS_ORIGINS = process.env.CORS_ORIGINS;
if (!CORS_ORIGINS && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGINS required in production');
}
```

---

## Deployment Sequence

### Phase 1: Create zoho-rg Resources

```bash
# 1. Create resource group
az group create --name zoho-rg --location swedencentral

# 2. Deploy infrastructure
az deployment group create \
  --resource-group zoho-rg \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.dev.json
```

Includes:
- Cosmos DB account with 6 containers
- Storage account with 4 containers + 2 queues
- Azure Functions App (Premium)
- Diagnostic settings → pippai-logs

### Phase 2: Configure Cross-RG Access

```bash
# Get VM Managed Identity
VM_MI=$(az vm identity show --name pippai-vm --resource-group pippai-rg --query principalId -o tsv)

# Get Functions Managed Identity
FUNC_MI=$(az functionapp identity show --name order-processing-dev-func --resource-group zoho-rg --query principalId -o tsv)

# Assign Cosmos DB roles (use Cosmos DB native RBAC)
# For VM
az cosmosdb sql role assignment create \
  --account-name order-processing-dev-cosmos \
  --resource-group zoho-rg \
  --role-definition-id 00000000-0000-0000-0000-000000000002 \
  --principal-id $VM_MI \
  --scope /dbs/order-processing

# For Functions
az cosmosdb sql role assignment create \
  --account-name order-processing-dev-cosmos \
  --resource-group zoho-rg \
  --role-definition-id 00000000-0000-0000-0000-000000000002 \
  --principal-id $FUNC_MI \
  --scope /dbs/order-processing

# Assign Storage roles
az role assignment create --assignee $VM_MI --role "Storage Blob Data Contributor" --scope /subscriptions/{sub}/resourceGroups/zoho-rg/providers/Microsoft.Storage/storageAccounts/orderstor{suffix}

az role assignment create --assignee $FUNC_MI --role "Storage Blob Data Contributor" --scope /subscriptions/{sub}/resourceGroups/zoho-rg/providers/Microsoft.Storage/storageAccounts/orderstor{suffix}

az role assignment create --assignee $FUNC_MI --role "Storage Queue Data Contributor" --scope /subscriptions/{sub}/resourceGroups/zoho-rg/providers/Microsoft.Storage/storageAccounts/orderstor{suffix}
```

### Phase 3: Add Secrets to Key Vault

```bash
# Zoho secrets
az keyvault secret set --vault-name pippai-keyvault-dev --name ZohoClientId --value "<value>"
az keyvault secret set --vault-name pippai-keyvault-dev --name ZohoClientSecret --value "<value>"
az keyvault secret set --vault-name pippai-keyvault-dev --name ZohoRefreshToken --value "<value>"
az keyvault secret set --vault-name pippai-keyvault-dev --name ZohoOrganizationId --value "<value>"

# Verify Teams secrets exist
az keyvault secret show --vault-name pippai-keyvault-dev --name MicrosoftAppId
az keyvault secret show --vault-name pippai-keyvault-dev --name MicrosoftAppPassword
```

### Phase 4: Deploy Application Code

**VM Services:**
```bash
# Build
npm run build --workspaces --filter=teams-bot --filter=api

# Copy to VM
scp -r app/services/teams-bot/dist user@pippai-vm:/app/services/teams-bot/
scp -r app/services/api/dist user@pippai-vm:/app/services/api/

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

**Azure Functions:**
```bash
# Build workflow service
cd app/services/workflow
npm run build

# Deploy to Azure Functions
func azure functionapp publish order-processing-dev-func
```

### Phase 5: Configure Teams Integration

1. Update Bot endpoint in Azure Bot Service to point to VM
2. Register webhook URL with Teams
3. Configure Teams Tab SSO
4. Test end-to-end flow

---

## Monitoring & Observability

### Health Endpoints

| Endpoint | Expected Response |
|----------|-------------------|
| GET /health | `{"status":"healthy","service":"teams-bot"}` |
| GET /api/health/live | `{"status":"healthy","version":"1.0.0"}` |
| GET /api/health/ready | `{"status":"healthy","cosmos":"connected","storage":"connected"}` |

**Important:** Health endpoints must verify actual connectivity to Cosmos DB and Storage, not just return hardcoded responses.

### Diagnostic Flow

```
zoho-rg resources              pippai-rg
─────────────────              ─────────────
Cosmos DB ─────────────────────► Log Analytics
Storage ───────────────────────► (pippai-logs)
Functions ─────────────────────►
                                      │
pippai-vm ────────────────────► App Insights
(Teams Bot, API)                (pippai-insights)
```

---

## Cost Estimates

### zoho-rg Monthly Costs

| Resource | SKU | Est. Monthly Cost |
|----------|-----|-------------------|
| Cosmos DB | Serverless | $25-50 (usage-based) |
| Storage | Standard LRS | $5-10 (100GB) |
| Azure Functions | Premium EP1 | $150-200 |
| **Total zoho-rg** | | **$180-260/month** |

### pippai-rg (Existing)

Already budgeted; Order Processing adds minimal incremental cost.

---

## Rollback Plan

### If Deployment Fails

1. **zoho-rg resources**: Delete entire resource group
2. **Key Vault secrets**: Remove app-specific secrets
3. **VM changes**: Stop PM2 processes, remove `/app` directory
4. **RBAC**: Remove role assignments

### Data Recovery

- Cosmos DB: Continuous backup, 7-day PITR
- Storage: Soft delete (30 days) + versioning
- Audit container: Immutable with 5-year retention

---

## Pre-Production Checklist

### Infrastructure (Blocking)
- [ ] Fix Cosmos DB RBAC to use SQL role assignments
- [ ] Deploy Azure Functions App for workflow service
- [ ] Add private DNS zones (if using private endpoints)
- [ ] Verify cross-RG MI access works

### Security (Blocking)
- [ ] Implement JWT verification
- [ ] Add tenant isolation middleware
- [ ] Use constant-time APIM key comparison
- [ ] Remove connection strings from Bicep outputs

### Configuration
- [ ] Configure WORM policy with 5-year retention
- [ ] Set up service endpoint firewalls
- [ ] Require explicit CORS origins
- [ ] Verify container/queue names match code expectations

### Testing
- [ ] End-to-end order processing flow
- [ ] Cross-tenant Teams SSO
- [ ] Health endpoint connectivity checks
- [ ] Durable Functions orchestration

---

## Success Criteria

- [ ] VM can authenticate to Cosmos DB via Managed Identity
- [ ] VM can read/write Storage via Managed Identity
- [ ] Functions can execute Durable orchestrations
- [ ] VM can read secrets from Key Vault
- [ ] Teams Bot webhook receives messages
- [ ] API health endpoints return 200 OK with actual checks
- [ ] Logs flow to pippai-logs and pippai-insights
- [ ] End-to-end order processing completes successfully

---

## Review Summary

This plan was validated by 3 parallel review agents analyzing:
1. **Infrastructure Critical Review**: Found 14 issues including wrong RBAC mechanism, missing containers
2. **Architecture Validation**: Found critical gap - workflow service requires Azure Functions
3. **Security Review**: Found 4 HIGH severity issues requiring fixes before production

**All critical findings have been incorporated into this final plan.**

---

*Plan Version: 1.0 FINAL*
*Generated: 2025-12-26*
*Review Method: Multi-Agent Consensus (3 specialized agents)*

