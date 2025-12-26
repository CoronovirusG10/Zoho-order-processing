# Deployment Runbook

**Project:** Sales Order Intake Bot
**Version:** 1.0.0
**Last Updated:** 2025-12-26

---

## Prerequisites Checklist

Before starting deployment, verify:

- [ ] All blockers from PREDEPLOYMENT_READINESS_REPORT.md resolved
- [ ] Git repository initialized with proper .gitignore
- [ ] Azure CLI authenticated (`az account show`)
- [ ] Correct subscription selected (Azure subscription 1)
- [ ] Node.js >= 20.0.0 installed
- [ ] npm >= 10.0.0 installed
- [ ] Bicep CLI installed (`az bicep version`)
- [ ] Teams Toolkit CLI or manual packaging capability

---

## Phase 1: IaC Deployment

### 1.1 Validate Bicep (What-If)

```bash
cd /data/order-processing/app/infra

# Validate syntax
az bicep build --file main.bicep

# Run what-if for dev environment
az deployment sub what-if \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.dev.json \
  --name "order-processing-dev-$(date +%Y%m%d)"
```

**Review what-if output carefully before proceeding.**

### 1.2 Deploy to Staging

```bash
# Deploy to dev/staging
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.dev.json \
  --name "order-processing-dev-$(date +%Y%m%d)"
```

**Expected resources created:**
- Resource Group: `order-processing-dev-rg`
- Key Vault: `order-processing-dev-kv`
- Storage Account: `orderstordev<suffix>`
- Cosmos DB: `order-processing-dev-cosmos`
- Log Analytics: `order-processing-dev-logs`
- App Insights: `order-processing-dev-insights`
- AI Foundry Hub: `order-processing-dev-hub`
- AI Foundry Project: `order-processing-dev-project`
- Function Apps: workflow, parser, zoho
- Azure Bot: `order-processing-dev-bot`
- Static Web App: `order-processing-dev-tab`

### 1.3 Deploy to Production

```bash
# After staging validation succeeds
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --name "order-processing-prod-$(date +%Y%m%d)"
```

---

## Phase 2: Application Deployment

### 2.1 Build Application

```bash
cd /data/order-processing/app

# Install dependencies
npm ci

# Build all packages and services
npm run build

# Run tests
npm test

# Lint check
npm run lint
```

### 2.2 Deploy Function Apps

```bash
# Deploy workflow function
cd services/workflow
func azure functionapp publish order-processing-dev-workflow --typescript

# Deploy parser function
cd ../parser
func azure functionapp publish order-processing-dev-parser --typescript

# Deploy zoho function
cd ../zoho
func azure functionapp publish order-processing-dev-zoho --typescript
```

### 2.3 Deploy Static Web App (Teams Tab)

```bash
cd services/teams-tab

# Build for production
npm run build

# Deploy to Static Web App
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN
```

### 2.4 Deploy Bot Service

```bash
cd services/teams-bot

# Build Docker image
docker build -t order-processing-bot:latest .

# Push to Container Registry
az acr login --name <your-acr>
docker tag order-processing-bot:latest <your-acr>.azurecr.io/order-processing-bot:latest
docker push <your-acr>.azurecr.io/order-processing-bot:latest

# Update Container App (prod) or App Service (dev)
az containerapp update \
  --name order-processing-bot \
  --resource-group order-processing-prod-rg \
  --image <your-acr>.azurecr.io/order-processing-bot:latest
```

---

## Phase 3: Azure AI Foundry Setup

### 3.1 Verify Model Deployments

```bash
# List deployed models (using Azure CLI or Foundry portal)
az cognitiveservices account deployment list \
  --name order-processing-dev-aiservices \
  --resource-group order-processing-dev-rg \
  -o table
```

**Required models:**
- gpt-5.1 (or gpt-4o as fallback)
- o3, claude-opus-4-5 (committee)
- mistral-document-ai (OCR)
- Cohere-embed-v3-multilingual (embeddings)

### 3.2 Configure Capability Host (if using BYO storage)

```bash
# Create capability host at account level
az rest --method PUT \
  --uri "https://management.azure.com/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/capabilityHosts/default?api-version=2025-06-01" \
  --body '{
    "properties": {
      "capabilityHostKind": "Agents",
      "threadStorageConnections": ["cosmos-connection"],
      "vectorStoreConnections": ["search-connection"],
      "storageConnections": ["storage-connection"]
    }
  }'
```

### 3.3 Create Agent (if using Foundry Agents)

Agent configuration is done via SDK in the application code. Verify:
- `AGENT_MODEL_DEPLOYMENT` environment variable set
- `AZURE_AI_FOUNDRY_ENDPOINT` configured
- Managed Identity has required permissions

---

## Phase 4: Key Vault Secret Population

### 4.1 Set Zoho Secrets

```bash
KEYVAULT_NAME="order-processing-dev-kv"

# Set Zoho credentials (get values from secure source)
az keyvault secret set --vault-name $KEYVAULT_NAME --name "zoho-client-id" --value "<client-id>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "zoho-client-secret" --value "<client-secret>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "zoho-refresh-token" --value "<refresh-token>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "zoho-organization-id" --value "<org-id>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "zoho-region" --value "eu"
```

### 4.2 Set Bot Credentials

```bash
# Bot app credentials
az keyvault secret set --vault-name $KEYVAULT_NAME --name "bot-app-client-id" --value "<bot-client-id>"

# If using client secret (dev only)
az keyvault secret set --vault-name $KEYVAULT_NAME --name "bot-app-client-secret" --value "<secret>"

# If using certificate (production)
az keyvault certificate import --vault-name $KEYVAULT_NAME --name "bot-app-certificate" --file bot-cert.pfx
```

### 4.3 Set Tab App Credentials

```bash
az keyvault secret set --vault-name $KEYVAULT_NAME --name "tab-app-client-id" --value "<tab-client-id>"
```

---

## Phase 5: Teams App Deployment

### 5.1 Package Teams App

```bash
cd /data/order-processing/app/teams-app

# Substitute environment variables in manifest
envsubst < manifest.json.template > manifest.json

# Verify icons exist
ls -la color.png outline.png

# Create package
zip -r ../sales-order-bot.zip manifest.json color.png outline.png
```

### 5.2 Deploy to Tenant B (Target Tenant)

**Tenant B Admin Actions:**

1. Navigate to Teams Admin Centre (`https://admin.teams.microsoft.com`)
2. Go to **Teams apps** > **Manage apps**
3. Click **Upload new app**
4. Upload `sales-order-bot.zip`
5. Configure permission policies to allow the app
6. Grant admin consent in Entra ID for the Tab app

See `_predeploy/artefacts/CROSS_TENANT_ENROLLMENT_STEPS.md` for detailed steps.

---

## Staging Deployment Checklist

- [ ] IaC deployed successfully (what-if clean)
- [ ] All Function Apps deployed and running
- [ ] Static Web App accessible
- [ ] Bot responding to messages in Tenant A
- [ ] Key Vault secrets populated
- [ ] Zoho API health checks pass
- [ ] Teams app sideloaded in Tenant A for testing
- [ ] End-to-end flow tested (upload → parse → committee → draft)

---

## Production Deployment Checklist

- [ ] Staging tests passed
- [ ] Production IaC deployed
- [ ] Production secrets populated
- [ ] Bot credentials rotated (certificate-based)
- [ ] Teams app uploaded to Tenant B org catalog
- [ ] Admin consent granted in Tenant B
- [ ] App roles assigned to users
- [ ] Smoke tests completed
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured

---

## Rollback Steps

### Application Rollback

```bash
# Rollback Function App to previous deployment
az functionapp deployment slot swap \
  --name order-processing-prod-workflow \
  --resource-group order-processing-prod-rg \
  --slot staging \
  --target-slot production

# Or redeploy previous version
func azure functionapp publish order-processing-prod-workflow --typescript --force
```

### IaC Rollback

```bash
# List recent deployments
az deployment sub list --query "[?contains(name, 'order-processing')].{name:name, timestamp:timestamp, state:properties.provisioningState}" -o table

# Redeploy previous version
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --name "order-processing-rollback-$(date +%Y%m%d)"
```

### Teams App Rollback

1. Tenant B Admin: Remove current app version from org catalog
2. Upload previous version of `sales-order-bot.zip`
3. Notify users to refresh Teams

---

## Post-Deployment Verification

```bash
# Check Function App status
az functionapp show --name order-processing-prod-workflow --resource-group order-processing-prod-rg --query "state"

# Check Bot health
curl -I https://<bot-endpoint>/api/messages

# Check Tab health
curl -I https://<tab-domain>/

# Verify Zoho connectivity (from deployed function)
az functionapp function invoke \
  --name order-processing-prod-zoho \
  --resource-group order-processing-prod-rg \
  --function-name healthCheck
```

---

**Runbook Version:** 1.0.0
**Last Updated:** 2025-12-26
