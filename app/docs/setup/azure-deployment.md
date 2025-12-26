# Azure Deployment Guide

## Prerequisites

- Azure CLI installed and logged in
- Bicep CLI (included with Azure CLI)
- Appropriate Azure subscription access
- Teams admin access for app deployment

## Deployment Steps

### 1. Deploy Infrastructure

```bash
cd /data/order-processing/app/infra

# Deploy to development
./scripts/deploy.sh dev swedencentral

# Deploy to production
./scripts/deploy.sh prod swedencentral
```

This creates:
- Resource Group: `order-processing-{env}-rg`
- Storage Account with containers
- Cosmos DB with collections
- Key Vault with managed identities
- Function App for workflow
- Application Insights
- Azure Bot resource

### 2. Configure Secrets in Key Vault

After infrastructure deployment:

```bash
# Get Key Vault name from outputs
KV_NAME=$(az deployment sub show --name main --query properties.outputs.keyVaultName.value -o tsv)

# Set Zoho secrets
az keyvault secret set --vault-name $KV_NAME --name ZohoClientId --value "your-client-id"
az keyvault secret set --vault-name $KV_NAME --name ZohoClientSecret --value "your-client-secret"
az keyvault secret set --vault-name $KV_NAME --name ZohoRefreshToken --value "your-refresh-token"
```

### 3. Deploy Application Code

```bash
# Build all packages
npm run build

# Deploy Function App
cd services/workflow
func azure functionapp publish order-processing-{env}-func

# Deploy API (Container App or App Service)
az containerapp update --name order-processing-api --resource-group order-processing-{env}-rg --image your-acr.azurecr.io/order-processing-api:latest

# Deploy Tab (Static Web App)
az staticwebapp deploy --app-location services/teams-tab/dist --resource-group order-processing-{env}-rg
```

### 4. Configure Azure Bot

1. Navigate to Azure Portal → Bot Services
2. Select your bot resource
3. Go to Channels → Microsoft Teams
4. Enable the Teams channel
5. Update messaging endpoint to your API URL: `https://your-api.azurecontainerapps.io/api/messages`

### 5. Register Entra Applications

See [Cross-Tenant Configuration](cross-tenant.md) for detailed Entra app setup.

## Environment-Specific Configuration

### Development
- Consumption Function App plan
- Serverless Cosmos DB
- Minimal redundancy

### Production
- Premium Function App plan
- Provisioned Cosmos DB throughput
- Zone-redundant storage
- Private endpoints
- Immutable blob policies

## Monitoring

### Application Insights Queries

```kusto
// Failed orders in last 24h
traces
| where timestamp > ago(24h)
| where message contains "order" and severityLevel >= 3
| summarize count() by bin(timestamp, 1h)

// Zoho API latency
dependencies
| where name contains "zoho"
| summarize avg(duration), percentile(duration, 95) by bin(timestamp, 1h)
```

### Alerts to Configure

1. Order processing failures > 5/hour
2. Zoho API errors > 10/hour
3. Function App exceptions
4. Queue depth growing (retry backlog)

## Rollback Procedure

```bash
# Get previous deployment
az deployment group list --resource-group order-processing-prod-rg --query "[1].name" -o tsv

# Rollback to previous version
az functionapp deployment source config-zip --resource-group order-processing-prod-rg --name order-processing-func --src previous-version.zip
```

## Security Checklist

- [ ] All secrets in Key Vault
- [ ] Managed Identity enabled
- [ ] Private endpoints configured
- [ ] Diagnostic logging enabled
- [ ] Immutable blob policy active
- [ ] RBAC properly assigned
- [ ] Network restrictions in place
