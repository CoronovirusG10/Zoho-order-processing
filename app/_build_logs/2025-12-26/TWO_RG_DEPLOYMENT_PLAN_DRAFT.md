# Two-RG Deployment Plan for Order Processing Application

**Version:** Draft v1.0
**Date:** 2025-12-26
**Status:** Pending Multi-Model Review

---

## Executive Summary

Deploy the Order Processing application across two Azure Resource Groups:
- **pippai-rg** (existing): Shared platform infrastructure
- **zoho-rg** (new): Application-specific resources

The application runs on the existing VM in pippai-rg, with data resources isolated in zoho-rg for lifecycle management and cost attribution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AZURE (Tenant A)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────┐       ┌────────────────────────────────┐    │
│  │  pippai-rg (EXISTING)      │       │  zoho-rg (NEW)                 │    │
│  │  ─────────────────────     │       │  ──────────────────────        │    │
│  │                            │       │                                │    │
│  │  Compute:                  │       │  Data Layer:                   │    │
│  │  ├── pippai-vm ◄───────────┼───────┼── Uses MI to access ──────────┐│    │
│  │  │   (runs app)            │       │  ├── Cosmos DB Account        ││    │
│  │  │                         │       │  │   └── order-processing DB  ││    │
│  │  Shared Platform:          │       │  │       ├── cases            ││    │
│  │  ├── Key Vault ◄───────────┼───────┼──│       ├── fingerprints     ││    │
│  │  │   (secrets)             │ RBAC  │  │       ├── events           ││    │
│  │  ├── App Insights ◄────────┼───────┼──│       ├── cache            ││    │
│  │  │   (telemetry)           │       │  │       └── committeeVotes   ││    │
│  │  ├── Log Analytics ◄───────┼───────┼──│                            ││    │
│  │  │   (diagnostics)         │       │  └── Storage Account          ││    │
│  │  └── VNet (existing)       │       │      ├── orders-incoming      ││    │
│  │      └── Subnets           │       │      ├── orders-audit (WORM)  ││    │
│  │                            │       │      ├── committee-evidence   ││    │
│  └────────────────────────────┘       │      └── logs-archive         ││    │
│                                        │                                │    │
│                                        └────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            TEAMS (Tenant B)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Teams App (Bot + Personal Tab) → Webhook to VM → Cross-tenant SSO          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Allocation

### pippai-rg (Existing - Shared Platform)

| Resource | Name | Purpose | Changes |
|----------|------|---------|---------|
| Virtual Machine | pippai-vm | Runs application services | Add MI roles for zoho-rg |
| Key Vault | pippai-keyvault-dev | Centralized secrets | Add zoho app secrets |
| App Insights | pippai-insights | Application telemetry | None |
| Log Analytics | pippai-logs | Diagnostic logs | None |
| VNet | pippai-vnet | Network isolation | None |
| AI Services | (existing) | AI model access | None |
| Cosmos DB | cosmos-visionarylab | Other projects | **Do NOT use** |

### zoho-rg (New - Application-Specific)

| Resource | Name | Purpose | Partition Key |
|----------|------|---------|---------------|
| Cosmos DB Account | zoho-cosmos | Order data | N/A |
| Cosmos Database | order-processing | App database | N/A |
| Container: cases | cases | Case records | `/tenantId` |
| Container: fingerprints | fingerprints | Idempotency | `/fingerprint` |
| Container: events | events | Audit trail | `/caseId` |
| Container: cache | cache | API cache (TTL 24h) | `/cacheKey` |
| Container: committeeVotes | committeeVotes | AI voting logs | `/caseId` |
| Storage Account | zohostorage{suffix} | Order files | N/A |
| Container: orders-incoming | orders-incoming | Raw uploads | N/A |
| Container: orders-audit | orders-audit | WORM audit bundles | N/A |
| Container: committee-evidence | committee-evidence | AI evidence packs | N/A |
| Container: logs-archive | logs-archive | Archived logs | N/A |

---

## VM Deployment Specification

### Services Running on pippai-vm

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| Teams Bot | 3978 | Node.js + Bot Framework | Teams webhook receiver |
| API Service | 3000 | Node.js + Express | REST API gateway |

### Process Management (PM2)

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

### Managed Identity Configuration

The VM's System-Assigned Managed Identity requires RBAC roles:

**In pippai-rg:**
- Key Vault Secrets User → pippai-keyvault-dev

**In zoho-rg (Cross-RG RBAC):**
- Cosmos DB Data Contributor → zoho-cosmos
- Storage Blob Data Contributor → zohostorage{suffix}
- Storage Queue Data Contributor → zohostorage{suffix}

---

## Secrets Management

### Secrets in pippai-keyvault-dev

| Secret Name | Source | Used By |
|-------------|--------|---------|
| ZohoClientId | Zoho Developer Console | VM app |
| ZohoClientSecret | Zoho Developer Console | VM app |
| ZohoRefreshToken | OAuth flow | VM app |
| ZohoOrganizationId | Zoho Books | VM app |
| MicrosoftAppId | Azure App Registration | Teams Bot |
| MicrosoftAppPassword | Azure App Registration | Teams Bot |
| CosmosConnectionString | zoho-rg Cosmos | VM app |
| StorageConnectionString | zoho-rg Storage | VM app |
| OpenAiApiKey | Azure AI Foundry | Committee engine |
| GoogleAiApiKey | Google Cloud | Committee engine |

### Environment Variables on VM

```bash
# Azure Identity (from Managed Identity - no secrets needed)
# KEY_VAULT_NAME=pippai-keyvault-dev

# Cosmos DB (connection via MI)
COSMOS_ENDPOINT=https://zoho-cosmos.documents.azure.com:443/
COSMOS_DATABASE=order-processing

# Storage (connection via MI)
STORAGE_ACCOUNT_NAME=zohostorage{suffix}

# App Insights (from pippai-rg)
APPLICATIONINSIGHTS_CONNECTION_STRING=<from-key-vault>

# Teams (from Key Vault)
MICROSOFT_APP_ID=<from-key-vault>
MICROSOFT_APP_PASSWORD=<from-key-vault>
```

---

## Networking

### Connectivity Pattern

```
Internet → Azure Load Balancer/APIM → pippai-vm (ports 3000, 3978)
                                           │
                                           ├── Cosmos DB (zoho-rg) via MI + HTTPS
                                           ├── Blob Storage (zoho-rg) via MI + HTTPS
                                           ├── Key Vault (pippai-rg) via MI + HTTPS
                                           └── App Insights (pippai-rg) via SDK
```

### Network Access

| Source | Destination | Protocol | Access Method |
|--------|-------------|----------|---------------|
| pippai-vm | Cosmos DB (zoho-rg) | HTTPS/443 | Public endpoint + MI |
| pippai-vm | Storage (zoho-rg) | HTTPS/443 | Public endpoint + MI |
| pippai-vm | Key Vault (pippai-rg) | HTTPS/443 | Public endpoint + MI |
| Teams | pippai-vm:3978 | HTTPS/443 | Via APIM/LB |
| Tab SPA | pippai-vm:3000 | HTTPS/443 | Via APIM/LB |

**Note:** Private endpoints are optional. Initial deployment uses public endpoints with Managed Identity authentication and Azure service firewalls.

---

## RBAC Configuration

### Cross-RG Role Assignments

```bicep
// In zoho-rg, grant pippai-vm MI access

// Cosmos DB Data Contributor
resource vmCosmosRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: cosmosAccount
  properties: {
    roleDefinitionId: '/providers/Microsoft.Authorization/roleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: '<pippai-vm-mi-principal-id>'
    principalType: 'ServicePrincipal'
  }
}

// Storage Blob Data Contributor
resource vmStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  properties: {
    roleDefinitionId: '/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    principalId: '<pippai-vm-mi-principal-id>'
    principalType: 'ServicePrincipal'
  }
}
```

---

## Deployment Sequence

### Phase 1: Create zoho-rg Resources

1. Create resource group `zoho-rg` in Sweden Central
2. Deploy Cosmos DB account with serverless capacity
3. Create database `order-processing` with 5 containers
4. Deploy Storage account with 4 containers
5. Configure lifecycle policies (WORM for audit, tiering)
6. Enable diagnostic settings → pippai-logs

### Phase 2: Configure Cross-RG Access

1. Get pippai-vm Managed Identity principal ID
2. Assign Cosmos DB Data Contributor in zoho-rg
3. Assign Storage Blob/Queue Data Contributor in zoho-rg
4. Verify Key Vault access already exists

### Phase 3: Add Secrets to Key Vault

1. Add Zoho OAuth secrets to pippai-keyvault-dev
2. Add Cosmos connection string (read from zoho-rg)
3. Add Storage connection string (read from zoho-rg)
4. Verify Teams app secrets exist

### Phase 4: Deploy Application to VM

1. Build application: `npm run build --workspaces`
2. Copy dist folders to VM
3. Install production dependencies
4. Configure PM2 with ecosystem.config.js
5. Start services: `pm2 start all`

### Phase 5: Configure Teams Integration

1. Update Bot endpoint in Azure Bot Service
2. Register webhook URL with Teams
3. Deploy Teams Tab (if using Static Web App in pippai-rg)
4. Test end-to-end flow

---

## Monitoring & Observability

### Diagnostics Flow

```
zoho-rg resources              pippai-rg
─────────────────              ─────────────
Cosmos DB ─────────────────────► Log Analytics
Storage ───────────────────────► (pippai-logs)
                                      │
pippai-vm ────────────────────► App Insights
(Teams Bot, API)                (pippai-insights)
```

### Health Checks

| Endpoint | Expected Response |
|----------|-------------------|
| GET /health | `{"status":"healthy","service":"teams-bot"}` |
| GET /api/health/live | `{"status":"healthy","version":"0.1.0"}` |
| GET /api/health/ready | `{"status":"healthy","cosmos":"ok","storage":"ok"}` |

---

## Cost Considerations

### zoho-rg Estimated Costs

| Resource | SKU | Est. Monthly Cost |
|----------|-----|-------------------|
| Cosmos DB | Serverless | ~$25-50 (usage-based) |
| Storage | Standard LRS | ~$5-10 (100GB) |
| **Total zoho-rg** | | **~$30-60/month** |

### pippai-rg (Existing - Shared)

Already budgeted; Order Processing adds minimal incremental cost.

---

## Rollback Plan

### If Deployment Fails

1. **zoho-rg resources**: Delete entire resource group (clean slate)
2. **Key Vault secrets**: Remove app-specific secrets
3. **VM changes**: Stop PM2 processes, remove `/app` directory
4. **RBAC**: Remove role assignments for VM MI in zoho-rg

### Data Recovery

- Cosmos DB: Continuous backup enabled, 7-day point-in-time restore
- Storage: Soft delete (30 days) + versioning enabled
- Audit containers: WORM policy prevents deletion

---

## Open Questions for Review

1. **Cosmos DB capacity mode**: Serverless vs Provisioned throughput?
2. **Private endpoints**: Required for initial deployment or later?
3. **Bot Service resource**: Deploy to pippai-rg or zoho-rg?
4. **Static Web App**: Deploy to pippai-rg (shared) or zoho-rg (app)?
5. **AI Foundry resources**: Use existing in pippai-rg or create new?

---

## Success Criteria

- [ ] VM can authenticate to zoho-rg Cosmos DB via Managed Identity
- [ ] VM can read/write zoho-rg Storage via Managed Identity
- [ ] VM can read secrets from pippai-keyvault-dev
- [ ] Teams Bot webhook receives messages
- [ ] API health endpoints return 200 OK
- [ ] Logs flow to pippai-logs and pippai-insights
- [ ] End-to-end order processing completes successfully

---

*This plan is pending multi-model review for validation.*
