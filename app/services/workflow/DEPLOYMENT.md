# Workflow Orchestrator - Deployment Guide

Complete deployment guide for the Workflow Orchestrator service to Azure Functions.

## Prerequisites

- Azure CLI installed (`az --version`)
- Azure Functions Core Tools v4 (`func --version`)
- Node.js 20+ LTS
- Resource group in Sweden Central
- Azure Storage account (for Durable Functions state)
- Application Insights instance

## Azure Resources Required

1. **Azure Functions App** (Premium or Dedicated plan for production)
   - Runtime: Node.js 20
   - Region: Sweden Central
   - Plan: Premium EP1 or higher (for always-on, VNET integration)

2. **Azure Storage Account**
   - For Durable Functions state persistence
   - Standard performance, LRS redundancy minimum
   - Queue, Table, and Blob services enabled

3. **Cosmos DB** (if not already provisioned)
   - For case state storage
   - Serverless or provisioned throughput

4. **Application Insights**
   - For monitoring and telemetry

## Step 1: Create Azure Resources

```bash
# Set variables
RESOURCE_GROUP="order-processing-rg"
LOCATION="swedencentral"
STORAGE_ACCOUNT="opworkflowstorage"
FUNCTION_APP="op-workflow-func"
APP_INSIGHTS="op-workflow-insights"

# Create storage account for Durable Functions
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get storage connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create Application Insights
az monitor app-insights component create \
  --app $APP_INSIGHTS \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web

# Get App Insights connection string
APPINSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create Function App (Premium plan for production)
az functionapp plan create \
  --name "${FUNCTION_APP}-plan" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku EP1 \
  --is-linux

az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --plan "${FUNCTION_APP}-plan" \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --storage-account $STORAGE_ACCOUNT \
  --os-type Linux
```

## Step 2: Configure Application Settings

```bash
# Set required application settings
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "AzureWebJobsStorage=$STORAGE_CONNECTION" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION" \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "WEBSITE_NODE_DEFAULT_VERSION=~20" \
    "AzureWebJobsFeatureFlags=EnableWorkerIndexing"

# Set Cosmos DB connection (update with your values)
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/" \
    "COSMOS_DATABASE_ID=order-processing"

# Set service URLs (update with your values)
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "PARSER_SERVICE_URL=https://op-parser-func.azurewebsites.net/api" \
    "COMMITTEE_SERVICE_URL=https://op-committee-func.azurewebsites.net/api" \
    "ZOHO_SERVICE_URL=https://op-zoho-func.azurewebsites.net/api" \
    "TEAMS_BOT_SERVICE_URL=https://op-teams-bot.azurewebsites.net/api"

# Set Cosmos DB key from Key Vault reference
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_KEY=@Microsoft.KeyVault(SecretUri=https://your-keyvault.vault.azure.net/secrets/CosmosDbKey/)"

# Set blob storage connection from Key Vault
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "BLOB_STORAGE_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://your-keyvault.vault.azure.net/secrets/BlobStorageConnection/)"
```

## Step 3: Enable Managed Identity and Key Vault Access

```bash
# Enable system-assigned managed identity
az functionapp identity assign \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP

# Get the principal ID
PRINCIPAL_ID=$(az functionapp identity show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name your-keyvault \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

## Step 4: Build and Deploy

```bash
# Navigate to service directory
cd /data/order-processing/app/services/workflow

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Azure
func azure functionapp publish $FUNCTION_APP
```

## Step 5: Configure Durable Functions

The Durable Functions configuration is in `host.json`:

```json
{
  "extensions": {
    "durableTask": {
      "hubName": "OrderProcessingHub",
      "storageProvider": {
        "type": "azureStorage",
        "connectionStringName": "AzureWebJobsStorage",
        "partitionCount": 4
      },
      "maxConcurrentActivityFunctions": 10,
      "maxConcurrentOrchestratorFunctions": 10
    }
  }
}
```

For production, consider:
- Increase `partitionCount` for higher throughput (4-16)
- Adjust `maxConcurrent*` based on expected load
- Enable extended sessions for frequently accessed orchestrations

## Step 6: Configure Monitoring

```bash
# Enable detailed logging
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "LOG_LEVEL=info"

# Set up alerts
az monitor metrics alert create \
  --name "Workflow-FailedOrchestrations" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNCTION_APP" \
  --condition "count Failed > 5" \
  --window-size 5m \
  --evaluation-frequency 1m

az monitor metrics alert create \
  --name "Workflow-HighRetries" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNCTION_APP" \
  --condition "count ActivityFunctionRetries > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## Step 7: Test Deployment

```bash
# Get function key
FUNCTION_KEY=$(az functionapp keys list \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query functionKeys.default -o tsv)

# Test start workflow endpoint
curl -X POST "https://$FUNCTION_APP.azurewebsites.net/api/workflow/start?code=$FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-case-123",
    "blobUrl": "https://test.blob.core.windows.net/test.xlsx",
    "tenantId": "tenant-123",
    "userId": "user-123",
    "teams": {
      "chatId": "chat-123",
      "messageId": "msg-123",
      "activityId": "activity-123"
    }
  }'

# Get orchestration status
INSTANCE_ID="test-case-123"
curl "https://$FUNCTION_APP.azurewebsites.net/api/workflow/$INSTANCE_ID/status?code=$FUNCTION_KEY"
```

## Step 8: Configure CI/CD (GitHub Actions)

Create `.github/workflows/deploy-workflow.yml`:

```yaml
name: Deploy Workflow Service

on:
  push:
    branches:
      - main
    paths:
      - 'app/services/workflow/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd app/services/workflow
          npm ci

      - name: Build
        run: |
          cd app/services/workflow
          npm run build

      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ secrets.AZURE_FUNCTIONAPP_NAME }}
          package: app/services/workflow
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

## Step 9: Configure VNET Integration (Production)

For production, integrate with VNET for secure access to Cosmos DB and other services:

```bash
# Create VNET and subnet
az network vnet create \
  --name op-vnet \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16

az network vnet subnet create \
  --name functions-subnet \
  --vnet-name op-vnet \
  --resource-group $RESOURCE_GROUP \
  --address-prefixes 10.0.1.0/24 \
  --delegations Microsoft.Web/serverFarms

# Enable VNET integration
az functionapp vnet-integration add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --vnet op-vnet \
  --subnet functions-subnet
```

## Scaling Considerations

### Premium Plan Sizing

- **EP1**: 1 vCPU, 3.5 GB RAM - Dev/Test (10-20 orders/day)
- **EP2**: 2 vCPU, 7 GB RAM - Production (100-200 orders/day)
- **EP3**: 4 vCPU, 14 GB RAM - High volume (500+ orders/day)

### Auto-scaling Configuration

```bash
az functionapp plan update \
  --name "${FUNCTION_APP}-plan" \
  --resource-group $RESOURCE_GROUP \
  --min-instances 1 \
  --max-burst 10
```

### Durable Functions Tuning

For high throughput:
- Increase `partitionCount` in `host.json` (4-16)
- Increase `maxConcurrentActivityFunctions` (10-50)
- Enable extended sessions for better performance

## Monitoring and Diagnostics

### Durable Functions Monitor

Install the Durable Functions Monitor extension:

```bash
# Install extension
func extensions install --package Microsoft.Azure.WebJobs.Extensions.DurableTask.Analyzers

# Access at: https://$FUNCTION_APP.scm.azurewebsites.net/durabletask-monitor
```

### Application Insights Queries

Key queries for monitoring:

```kusto
// Failed orchestrations in last 24h
requests
| where timestamp > ago(24h)
| where name == "OrderProcessingOrchestrator"
| where success == false
| summarize count() by bin(timestamp, 1h)

// Average orchestration duration
requests
| where timestamp > ago(24h)
| where name == "OrderProcessingOrchestrator"
| summarize avg(duration) by bin(timestamp, 1h)

// Activity retry counts
traces
| where message contains "Retry"
| summarize count() by name, bin(timestamp, 1h)
```

## Troubleshooting

### Common Issues

1. **Orchestration not starting**
   - Check storage account connection string
   - Verify Durable Functions hub name is unique
   - Check Application Insights logs

2. **Activities failing**
   - Verify service URLs are correct
   - Check managed identity has access to Key Vault
   - Review retry policies in code

3. **External events not received**
   - Verify queue name matches configuration
   - Check queue trigger is enabled
   - Ensure instanceId matches caseId

### Debug Locally

```bash
# Run with Azurite
azurite --silent --location /tmp/azurite

# Set local.settings.json
cp local.settings.json.example local.settings.json

# Start functions
npm start

# View logs
func logs
```

## Security Checklist

- [ ] Managed Identity enabled for Function App
- [ ] Key Vault secrets used for sensitive configuration
- [ ] VNET integration configured (production)
- [ ] Authentication level set to 'function' or 'admin'
- [ ] CORS configured appropriately
- [ ] Diagnostic logs enabled and exported to storage
- [ ] Alerts configured for critical failures

## Rollback Procedure

If deployment fails:

```bash
# List deployment history
az functionapp deployment list \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP

# Rollback to previous deployment
az functionapp deployment source config-zip \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --src previous-version.zip
```

## Post-Deployment Verification

1. Test workflow start endpoint
2. Verify orchestrations appear in Durable Functions Monitor
3. Check Application Insights for telemetry
4. Test external event raising
5. Verify case state updates in Cosmos DB
6. Confirm audit events are logged
7. Test failure scenarios and retries

## Support

For issues or questions:
- Check Application Insights logs
- Review Durable Functions Monitor
- Consult Azure Functions documentation
- Review orchestration replay history
