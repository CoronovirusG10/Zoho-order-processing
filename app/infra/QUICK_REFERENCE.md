# Infrastructure Quick Reference

## One-Page Cheat Sheet for Developers

### Deployment Commands

```bash
# Deploy to dev
cd /data/order-processing/app/infra
./scripts/deploy.sh dev swedencentral

# Deploy to prod with what-if
./scripts/deploy.sh prod swedencentral --what-if

# Validate without deploying
az deployment sub validate \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @main.parameters.dev.json
```

### Environment Configuration

```bash
# Set Azure subscription
az account set --subscription <subscription-id>

# Login to Azure
az login --tenant <tenant-id>

# Check current context
az account show
```

### Post-Deployment Setup

```bash
# 1. Configure secrets
./scripts/setup-secrets.sh dev <key-vault-name>

# 2. Validate deployment
./scripts/validate.sh dev

# 3. Get resource names
RESOURCE_GROUP="order-processing-dev-rg"
STORAGE=$(az storage account list -g $RESOURCE_GROUP --query "[0].name" -o tsv)
COSMOS=$(az cosmosdb list -g $RESOURCE_GROUP --query "[0].name" -o tsv)
KEYVAULT=$(az keyvault list -g $RESOURCE_GROUP --query "[0].name" -o tsv)
```

### Common Operations

```bash
# List all resources
az resource list --resource-group order-processing-dev-rg -o table

# View Function App logs
az functionapp log tail \
  --name order-workflow-dev-func \
  --resource-group order-processing-dev-rg

# Set Key Vault secret
az keyvault secret set \
  --vault-name $KEYVAULT \
  --name ZohoClientId \
  --value "your-client-id"

# Get secret value
az keyvault secret show \
  --vault-name $KEYVAULT \
  --name ZohoClientId \
  --query value -o tsv

# Upload blob
az storage blob upload \
  --account-name $STORAGE \
  --container-name orders-incoming \
  --file test.xlsx \
  --name test.xlsx \
  --auth-mode login

# Query Cosmos DB
az cosmosdb sql container query \
  --account-name $COSMOS \
  --database-name order-processing \
  --name cases \
  --query-text "SELECT * FROM c WHERE c.status = 'pending'" \
  --resource-group order-processing-dev-rg
```

### Key Resource Names

| Resource | Dev Name Pattern | Example |
|----------|------------------|---------|
| Resource Group | `order-processing-dev-rg` | `order-processing-dev-rg` |
| Storage | `orderstor{unique}` | `orderstorabc123` |
| Cosmos DB | `order-processing-dev-cosmos` | `order-processing-dev-cosmos` |
| Key Vault | `orderkv{unique}` | `orderkvabc123` |
| Function (Workflow) | `order-workflow-dev-func` | `order-workflow-dev-func` |
| Function (Parser) | `order-parser-dev-func` | `order-parser-dev-func` |
| Function (Zoho) | `order-zoho-dev-func` | `order-zoho-dev-func` |
| Bot | `order-processing-dev-bot` | `order-processing-dev-bot` |
| Static Web App | `order-processing-dev-swa` | `order-processing-dev-swa` |

### Storage Containers

- `orders-incoming` - Raw Excel files
- `orders-audit` - Immutable audit bundles
- `logs-archive` - Exported logs
- `committee-evidence` - AI committee results

### Storage Queues

- `case-processing` - Main workflow queue
- `zoho-retry` - Zoho API retry queue

### Cosmos DB Containers

- `cases` - Case state (partition: `/tenantId`)
- `fingerprints` - Idempotency (partition: `/fingerprint`)
- `events` - Audit events (partition: `/caseId`)
- `agentThreads` - Agent state (partition: `/threadId`)
- `committeeVotes` - Committee results (partition: `/caseId`)

### Key Vault Secrets

- `ZohoClientId` - Zoho OAuth client ID
- `ZohoClientSecret` - Zoho OAuth client secret
- `ZohoRefreshToken` - Zoho OAuth refresh token
- `TeamsAppId` - Teams app Microsoft App ID
- `TeamsAppPassword` - Teams app client secret
- `StorageConnectionString` - Storage connection string
- `CosmosConnectionString` - Cosmos connection string
- `AppInsightsConnectionString` - App Insights connection string

### Environment Variables (Function Apps)

```bash
# Key Vault references
ZOHO_CLIENT_ID=@Microsoft.KeyVault(VaultName=orderkv{unique};SecretName=ZohoClientId)
ZOHO_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=orderkv{unique};SecretName=ZohoClientSecret)
ZOHO_REFRESH_TOKEN=@Microsoft.KeyVault(VaultName=orderkv{unique};SecretName=ZohoRefreshToken)

# Direct values
COSMOS_ENDPOINT=https://order-processing-dev-cosmos.documents.azure.com:443/
COSMOS_DATABASE=order-processing
STORAGE_ACCOUNT_NAME=orderstor{unique}
ENVIRONMENT=dev
```

### Monitoring

```bash
# Application Insights query
az monitor app-insights query \
  --app order-processing-dev-ai \
  --analytics-query "requests | where timestamp > ago(1h) | summarize count() by resultCode"

# Log Analytics query
az monitor log-analytics query \
  --workspace order-processing-dev-logs \
  --analytics-query "FunctionAppLogs | where TimeGenerated > ago(1h) | project TimeGenerated, Message"

# Check Function App status
az functionapp show \
  --name order-workflow-dev-func \
  --resource-group order-processing-dev-rg \
  --query state -o tsv
```

### Troubleshooting

```bash
# Check RBAC assignments
az role assignment list \
  --assignee <principal-id> \
  --all -o table

# View deployment error
az deployment sub show \
  --name <deployment-name> \
  --query properties.error

# Check resource health
az resource show \
  --ids <resource-id> \
  --query properties.provisioningState -o tsv

# Stream Function App logs
az functionapp log tail \
  --name order-workflow-dev-func \
  --resource-group order-processing-dev-rg
```

### Cost Management

```bash
# View costs by resource group
az consumption usage list \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --query "[?contains(instanceName, 'order-processing')]" -o table

# Set budget alert
az consumption budget create \
  --resource-group order-processing-dev-rg \
  --budget-name dev-monthly-budget \
  --amount 100 \
  --time-grain Monthly
```

### Cleanup

```bash
# Delete entire environment
az group delete \
  --name order-processing-dev-rg \
  --yes --no-wait

# Delete specific resource
az resource delete \
  --ids <resource-id>

# Purge deleted Key Vault (if purge protection disabled)
az keyvault purge \
  --name orderkv{unique} \
  --location swedencentral
```

### Bicep Development

```bash
# Install/update Bicep
az bicep install
az bicep upgrade

# Lint template
az bicep lint --file main.bicep

# Build template (generates ARM JSON)
az bicep build --file main.bicep

# Decompile ARM to Bicep
az bicep decompile --file template.json
```

### Testing

```bash
# Unit test - validate syntax
az deployment sub validate \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @main.parameters.dev.json

# Integration test - what-if
az deployment sub what-if \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @main.parameters.dev.json

# E2E test - run validation script
./scripts/validate.sh dev
```

### Useful Azure Portal Links

- Resource Group: `https://portal.azure.com/#resource/subscriptions/{sub-id}/resourceGroups/order-processing-dev-rg`
- Application Insights: `https://portal.azure.com/#@{tenant}/resource/subscriptions/{sub-id}/resourceGroups/order-processing-dev-rg/providers/microsoft.insights/components/order-processing-dev-ai`
- Log Analytics: `https://portal.azure.com/#@{tenant}/resource/subscriptions/{sub-id}/resourceGroups/order-processing-dev-rg/providers/Microsoft.OperationalInsights/workspaces/order-processing-dev-logs`

### Emergency Contacts

- **Azure Support**: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- **Zoho Support**: https://help.zoho.com/portal/en/home
- **Teams Admin**: https://admin.teams.microsoft.com/

---

**Tip**: Save this file locally and customize with your actual subscription ID, tenant ID, and resource names after deployment.
