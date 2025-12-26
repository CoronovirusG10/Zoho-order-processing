# Agent 9: Infrastructure as Code (Bicep) - Summary

**Date:** 2025-12-25
**Agent:** IaC Bicep Agent
**Status:** COMPLETED

## Overview

Reviewed and enhanced the existing Bicep infrastructure code in `/data/order-processing/app/infra/`. The infrastructure was already substantially implemented but required additions for Azure AI Foundry, a cache container in Cosmos DB, model API keys, test environment parameters, and updated runtime configuration.

## Infrastructure Components

### Main Modules (Sweden Central Default)

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| Storage Account | COMPLETE | `modules/storage.bicep` | Blob containers (orders-incoming, orders-audit, logs-archive, committee-evidence), lifecycle management, immutability, versioning |
| Cosmos DB | COMPLETE | `modules/cosmos.bicep` | Serverless mode, containers: cases, fingerprints, events, agentThreads, committeeVotes, **cache** (NEW) |
| Key Vault | COMPLETE | `modules/keyvault.bicep` | RBAC authorization, soft-delete, purge protection (prod) |
| Azure Functions | COMPLETE | `modules/functionapp.bicep` | Premium/Consumption plans, Node.js 20 runtime, Durable Functions support |
| Azure Bot Service | COMPLETE | `modules/bot.bicep` | Teams channel enabled, messaging endpoint configured |
| Static Web App | COMPLETE | `modules/staticwebapp.bicep` | For Teams personal tab |
| Container App | COMPLETE | `modules/containerapp.bicep` | Optional for prod (bot runtime) |
| Azure AI Foundry | **NEW** | `modules/aifoundry.bicep` | Hub + Project + AI Services |
| Application Insights | COMPLETE | `modules/appinsights.bicep` | Linked to Log Analytics |
| Log Analytics | COMPLETE | `modules/loganalytics.bicep` | ContainerInsights, Security solutions |

### Networking

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| VNet | COMPLETE | `modules/vnet.bicep` | Optional, enabled for prod |
| Private Endpoints | COMPLETE | Integrated | Storage, Cosmos, Key Vault |
| NSG | COMPLETE | `modules/vnet.bicep` | HTTPS, Azure Load Balancer rules |
| Service Endpoints | COMPLETE | `modules/vnet.bicep` | Storage, Key Vault, Cosmos DB |

### Parameterization

| Parameter | Default | Notes |
|-----------|---------|-------|
| environment | required | dev/test/prod |
| location | swedencentral | Azure region |
| cosmosThroughputMode | serverless | serverless/provisioned |
| functionPlanType | Consumption | Consumption/Premium |
| enablePrivateEndpoints | false (dev/test), true (prod) | VNet integration |
| logRetentionDays | 730 | Max 2 years |
| blobRetentionDays | 1825 | 5 years for audit |
| deployAiFoundry | true | Deploy AI Foundry resources |

### Key Vault Secrets

| Secret | Purpose |
|--------|---------|
| ZohoClientId | Zoho OAuth |
| ZohoClientSecret | Zoho OAuth |
| ZohoRefreshToken | Zoho OAuth |
| StorageConnectionString | Storage access |
| CosmosConnectionString | Cosmos DB access |
| AppInsightsConnectionString | Monitoring |
| TeamsAppPassword | Bot Framework |
| OpenAiApiKey | GPT models (committee) |
| AnthropicApiKey | Claude models (committee) |
| GoogleAiApiKey | Gemini models (committee) |
| DeepSeekApiKey | DeepSeek models (committee) |
| XAiApiKey | Grok models (committee) |

### Outputs

The main.bicep now exports comprehensive outputs:

**Resource Names:**
- resourceGroupName, storageAccountName, cosmosAccountName, keyVaultName
- appInsightsName, logAnalyticsWorkspaceName, botName, staticWebAppName
- functionAppWorkflowName, functionAppParserName, functionAppZohoName

**Endpoint URLs:**
- staticWebAppUrl, functionAppWorkflowUrl, functionAppParserUrl, functionAppZohoUrl
- botEndpoint, storageEndpoint, cosmosEndpoint, keyVaultUri

**Connection Strings:**
- appInsightsConnectionString, appInsightsInstrumentationKey, logAnalyticsWorkspaceId

**Managed Identity Principal IDs:**
- functionAppWorkflowPrincipalId, functionAppParserPrincipalId
- functionAppZohoPrincipalId, containerAppPrincipalId

**AI Foundry:**
- aiFoundryHubName, aiFoundryProjectName
- aiFoundryHubPrincipalId, aiFoundryProjectPrincipalId, aiServicesEndpoint

## Files Created/Modified

### Created
- `/data/order-processing/app/infra/modules/aifoundry.bicep` - Azure AI Foundry module
- `/data/order-processing/app/infra/main.parameters.test.json` - Test environment parameters

### Modified
- `/data/order-processing/app/infra/main.bicep` - Added AI Foundry, model API keys, enhanced outputs
- `/data/order-processing/app/infra/modules/cosmos.bicep` - Added cache container
- `/data/order-processing/app/infra/modules/secrets.bicep` - Added model API key secrets
- `/data/order-processing/app/infra/modules/functionapp.bicep` - Changed to Node.js 20 runtime
- `/data/order-processing/app/infra/main.parameters.dev.json` - Added new parameters
- `/data/order-processing/app/infra/main.parameters.prod.json` - Added new parameters
- `/data/order-processing/app/infra/scripts/validate.sh` - Added AI Foundry/AI Services validation

## Deployment Scripts

### deploy.sh
```bash
# Deploy to dev
./scripts/deploy.sh dev

# Deploy to test
./scripts/deploy.sh test

# Deploy to prod with what-if
./scripts/deploy.sh prod swedencentral --what-if
```

### validate.sh
```bash
# Validate deployment
./scripts/validate.sh dev
```

### setup-secrets.sh
```bash
# Set up secrets after deployment
./scripts/setup-secrets.sh <key-vault-name>
```

## Environment Configuration

### Development (dev)
- Cosmos: Serverless, Free tier enabled
- Functions: Consumption plan
- Private endpoints: Disabled
- Log retention: 90 days

### Test (test)
- Cosmos: Serverless
- Functions: **Premium plan** (for Durable Functions testing)
- Private endpoints: Disabled
- Log retention: 180 days

### Production (prod)
- Cosmos: Provisioned throughput, Zone redundant
- Functions: Premium plan (EP1)
- Private endpoints: Enabled
- Log retention: 730 days
- Container Apps: Deployed
- Purge protection: Enabled

## Cosmos DB Containers

| Container | Partition Key | TTL | Purpose |
|-----------|---------------|-----|---------|
| cases | /tenantId | -1 (forever) | Order processing cases |
| fingerprints | /fingerprint | -1 | Idempotency tracking |
| events | /caseId | -1 | Audit trail |
| agentThreads | /threadId | 30 days | AI agent state |
| committeeVotes | /caseId | -1 | ML committee results |
| cache | /cacheKey | 24 hours | API response caching |

## Azure AI Foundry Configuration

The new `aifoundry.bicep` module deploys:

1. **AI Services Account** - Cognitive Services multi-service
2. **AI Hub** (MachineLearningServices/workspaces with kind=Hub)
   - Links to existing Storage, Key Vault, App Insights
   - System-assigned managed identity
3. **AI Project** (MachineLearningServices/workspaces with kind=Project)
   - Links to Hub
   - System-assigned managed identity
4. **AI Services Connection** - Connects AI Services to Hub

## Security Considerations

1. All secrets stored in Key Vault with RBAC authorization
2. Function Apps use managed identities (no connection string secrets in code)
3. Private endpoints available for prod environment
4. Soft-delete and purge protection on Key Vault (prod)
5. TLS 1.2 minimum on all services
6. CORS configured for Azure Portal access
7. Network ACLs with Azure Services bypass

## Next Steps for Deployment

1. Run `./scripts/deploy.sh dev` to deploy dev environment
2. Update Key Vault secrets:
   ```bash
   az keyvault secret set --vault-name <kv-name> --name ZohoClientId --value '<value>'
   az keyvault secret set --vault-name <kv-name> --name AnthropicApiKey --value '<value>'
   # ... other secrets
   ```
3. Register Teams app in Azure AD (Tenant B)
4. Deploy Function App code
5. Deploy Static Web App via GitHub Actions
6. Configure AI Foundry agent connections

## Validation

All Bicep files follow Azure best practices:
- Proper parameter decorators (@description, @allowed, @secure)
- Resource tags for cost allocation
- Diagnostic settings for all resources
- Managed identities where possible
- RBAC over access policies
