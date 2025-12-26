# Configuration Matrix

**Project:** Sales Order Intake Bot
**Last Updated:** 2025-12-26

---

## Overview

This matrix documents all configuration keys required for deployment. **NO SECRET VALUES** are included - only key names and locations.

---

## Key Vault Secrets

| Secret Name | Purpose | Required | Environment-Specific |
|-------------|---------|----------|---------------------|
| `zoho-client-id` | Zoho OAuth client ID | Yes | No (same across envs) |
| `zoho-client-secret` | Zoho OAuth client secret | Yes | No |
| `zoho-refresh-token` | Zoho OAuth refresh token | Yes | Yes (sandbox vs prod org) |
| `zoho-organization-id` | Zoho Books organization | Yes | Yes |
| `zoho-region` | Zoho API region (eu/com) | Yes | No (always "eu") |
| `bot-app-client-id` | Bot Entra app ID | Yes | No |
| `bot-app-client-secret` | Bot Entra app secret | Dev only | No |
| `bot-app-certificate` | Bot Entra app cert (PFX) | Prod only | No |
| `tab-app-client-id` | Tab Entra app ID | Yes | No |
| `tab-app-client-secret` | Tab Entra app secret | Dev only | No |
| `app-insights-connection-string` | App Insights connection | Yes | Yes |

---

## Function App Settings

### Workflow Function App

| Setting | Source | Description |
|---------|--------|-------------|
| `AZURE_KEYVAULT_URL` | App Setting | Key Vault URL |
| `AZURE_STORAGE_ACCOUNT_NAME` | App Setting | Storage account name |
| `COSMOS_CONNECTION_STRING` | Key Vault Reference | Cosmos DB connection |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Setting | App Insights key |
| `PARSER_FUNCTION_URL` | App Setting | Parser function endpoint |
| `ZOHO_FUNCTION_URL` | App Setting | Zoho function endpoint |
| `COMMITTEE_MIN_VOTES` | App Setting | Minimum votes for consensus (default: 3) |
| `COMMITTEE_TIMEOUT_MS` | App Setting | Committee voting timeout (default: 30000) |

### Parser Function App

| Setting | Source | Description |
|---------|--------|-------------|
| `AZURE_KEYVAULT_URL` | App Setting | Key Vault URL |
| `AZURE_STORAGE_ACCOUNT_NAME` | App Setting | Storage account name |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Setting | App Insights key |
| `PARSER_VERSION` | App Setting | Parser version (default: 1.1.0) |
| `FORMULA_POLICY` | App Setting | Formula handling (strict/warn/allow) |

### Zoho Function App

| Setting | Source | Description |
|---------|--------|-------------|
| `AZURE_KEYVAULT_URL` | App Setting | Key Vault URL |
| `ZOHO_CLIENT_ID_SECRET` | App Setting | Key Vault secret name |
| `ZOHO_CLIENT_SECRET_SECRET` | App Setting | Key Vault secret name |
| `ZOHO_REFRESH_TOKEN_SECRET` | App Setting | Key Vault secret name |
| `ZOHO_ORGANIZATION_ID_SECRET` | App Setting | Key Vault secret name |
| `ZOHO_REGION` | App Setting | API region (eu) |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Setting | App Insights key |

---

## Bot Service Configuration

| Setting | Source | Description |
|---------|--------|-------------|
| `MicrosoftAppId` | Environment | Bot Entra app ID |
| `MicrosoftAppPassword` | Key Vault | Bot app secret (dev) |
| `MicrosoftAppTenantId` | Environment | Empty for multi-tenant |
| `MicrosoftAppType` | Environment | "MultiTenant" |
| `BotEndpoint` | Azure Bot Config | Messaging endpoint URL |
| `AZURE_KEYVAULT_URL` | Environment | Key Vault URL |
| `STORAGE_ACCOUNT_NAME` | Environment | For file uploads |
| `WORKFLOW_FUNCTION_URL` | Environment | Workflow trigger URL |

---

## Static Web App (Tab) Configuration

| Setting | Source | Description |
|---------|--------|-------------|
| `VITE_TAB_APP_CLIENT_ID` | Build-time | Tab Entra app ID |
| `VITE_API_BASE_URL` | Build-time | API endpoint URL |
| `VITE_TAB_APP_SCOPE` | Build-time | API scope URI |

---

## Teams Manifest Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{BOT_APP_CLIENT_ID}}` | Bot Entra app ID | GUID |
| `{{TAB_APP_CLIENT_ID}}` | Tab Entra app ID | GUID |
| `{{TAB_DOMAIN}}` | Tab web app domain | tab.example.com |
| `{{BOT_DOMAIN}}` | Bot endpoint domain | bot.example.com |

---

## Environment Differences

### Development (dev)

| Configuration | Value |
|---------------|-------|
| Resource Group | `order-processing-dev-rg` |
| Key Vault | `order-processing-dev-kv` |
| Cosmos DB Tier | Free |
| Log Analytics Cap | 1GB/day |
| Private Endpoints | Disabled |
| Container Apps | Disabled |
| Zoho Organization | Pippa Sandbox |
| Bot Auth | Client Secret |

### Test (test)

| Configuration | Value |
|---------------|-------|
| Resource Group | `order-processing-test-rg` |
| Key Vault | `order-processing-test-kv` |
| Cosmos DB Tier | Free |
| Log Analytics Cap | 1GB/day |
| Private Endpoints | Disabled |
| Container Apps | Disabled |
| Zoho Organization | Pippa Sandbox |
| Bot Auth | Client Secret |

### Production (prod)

| Configuration | Value |
|---------------|-------|
| Resource Group | `order-processing-prod-rg` |
| Key Vault | `order-processing-prod-kv` |
| Cosmos DB Tier | Standard |
| Log Analytics Cap | Unlimited |
| Private Endpoints | Enabled |
| Container Apps | Enabled |
| Zoho Organization | Production Org |
| Bot Auth | Certificate |
| Purge Protection | Enabled |
| Zone Redundancy | Enabled |

---

## Azure Resource Names

| Resource | Dev | Test | Prod |
|----------|-----|------|------|
| Resource Group | order-processing-dev-rg | order-processing-test-rg | order-processing-prod-rg |
| Key Vault | order-processing-dev-kv | order-processing-test-kv | order-processing-prod-kv |
| Storage | orderstordev<suffix> | orderstortest<suffix> | orderstorprod<suffix> |
| Cosmos DB | order-processing-dev-cosmos | order-processing-test-cosmos | order-processing-prod-cosmos |
| Log Analytics | order-processing-dev-logs | order-processing-test-logs | order-processing-prod-logs |
| App Insights | order-processing-dev-ai | order-processing-test-ai | order-processing-prod-ai |
| Bot | order-processing-dev-bot | order-processing-test-bot | order-processing-prod-bot |
| Static Web App | order-processing-dev-tab | order-processing-test-tab | order-processing-prod-tab |

---

## Zoho Configuration

| Setting | Sandbox | Production |
|---------|---------|------------|
| API Base | https://www.zohoapis.eu | https://www.zohoapis.eu |
| Accounts Base | https://accounts.zoho.eu | https://accounts.zoho.eu |
| Organization ID | 20111340673 | TBD |
| Test Customer ID | TBD (create in sandbox) | N/A |

---

## Model Deployments

| Model | Deployment Name | Required Quota |
|-------|-----------------|----------------|
| gpt-5.1 | gpt-5.1 | 5,000+ TPM |
| o3 | o3 | 5,000+ TPM |
| claude-opus-4-5 | claude-opus-4-5 | 5,000+ TPM |
| mistral-document-ai | mistral-document-ai-2505 | 1,000+ TPM |
| Cohere-embed-v3 | cohere-embed-v3 | 1,000+ TPM |

---

## External API Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Zoho Books EU | https://www.zohoapis.eu/books/v3 | Sales order API |
| Zoho OAuth EU | https://accounts.zoho.eu/oauth/v2 | Token refresh |
| Azure AI Foundry | https://<project>.swedencentral.inference.ai.azure.com | Model inference |
| Bot Framework | https://<bot>.azurewebsites.net/api/messages | Bot messaging |

---

## Network Requirements

| Direction | Source | Destination | Port | Purpose |
|-----------|--------|-------------|------|---------|
| Outbound | Functions | Zoho EU | 443 | API calls |
| Outbound | Functions | Azure AI | 443 | Model inference |
| Inbound | Teams | Bot Endpoint | 443 | Bot messages |
| Inbound | Browser | Tab | 443 | Tab UI |
| Internal | Functions | Cosmos DB | 443 | Data storage |
| Internal | Functions | Storage | 443 | File storage |

---

**Matrix Version:** 1.0.0
**Last Updated:** 2025-12-26
