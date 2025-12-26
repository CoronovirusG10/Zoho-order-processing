# Teams Bot Deployment Guide

This guide covers deploying the Teams bot service to Azure in a cross-tenant configuration.

## Prerequisites

- Azure subscription (Tenant A - hosting)
- Microsoft Teams tenant (Tenant B - users)
- Azure CLI installed
- Node.js 18+ installed
- Access to Azure portal and Teams admin center

## 1. Azure Bot Registration (Tenant A)

### Create Multi-Tenant App Registration

1. Navigate to Azure Portal > Microsoft Entra ID > App registrations
2. Click "New registration"
3. Configure:
   - Name: `OrderProcessingBot`
   - Supported account types: **Accounts in any organizational directory (Multi-tenant)**
   - Redirect URI: Leave blank for now
4. Click "Register"
5. Note the **Application (client) ID**
6. Note the **Directory (tenant) ID**

### Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: `Teams Bot Secret`
4. Expires: Choose appropriate duration
5. Click "Add"
6. **Important:** Copy the secret value immediately (you won't see it again)

### Configure API Permissions (if using Graph fallback)

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Add: `Files.Read`, `Files.Read.All`
6. Click "Add permissions"

## 2. Azure Bot Service

### Create Bot Resource

```bash
az bot create \
  --resource-group order-processing-rg \
  --name order-processing-bot \
  --app-type MultiTenant \
  --appid <APP_ID> \
  --password <APP_SECRET> \
  --location swedencentral
```

### Enable Teams Channel

```bash
az bot teams create \
  --resource-group order-processing-rg \
  --name order-processing-bot
```

### Configure Messaging Endpoint

Set the messaging endpoint to your deployed service URL:

```bash
az bot update \
  --resource-group order-processing-rg \
  --name order-processing-bot \
  --endpoint "https://<your-app-service>.azurewebsites.net/api/messages"
```

## 3. Deploy to Azure App Service

### Create App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name order-processing-plan \
  --resource-group order-processing-rg \
  --location swedencentral \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --plan order-processing-plan \
  --runtime "NODE|18-lts"
```

### Configure Managed Identity

```bash
# Enable system-assigned managed identity
az webapp identity assign \
  --name order-processing-bot \
  --resource-group order-processing-rg

# Grant Storage Blob Data Contributor role
az role assignment create \
  --assignee <MANAGED_IDENTITY_PRINCIPAL_ID> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/order-processing-rg/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT>
```

### Configure App Settings

```bash
az webapp config appsettings set \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --settings \
    MICROSOFT_APP_ID="<APP_ID>" \
    MICROSOFT_APP_PASSWORD="<APP_SECRET>" \
    MICROSOFT_APP_TYPE="MultiTenant" \
    MICROSOFT_APP_TENANT_ID="<TENANT_A_ID>" \
    AZURE_STORAGE_ACCOUNT_NAME="<STORAGE_ACCOUNT>" \
    AZURE_STORAGE_CONTAINER_INCOMING="orders-incoming" \
    PARSER_ENDPOINT="https://parser.azurewebsites.net" \
    WORKFLOW_ENDPOINT="https://workflow.azurewebsites.net" \
    NODE_ENV="production" \
    LOG_LEVEL="info"
```

### Deploy Code

```bash
# Build the application
npm run build

# Create deployment package
zip -r deploy.zip dist package.json

# Deploy to App Service
az webapp deployment source config-zip \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --src deploy.zip
```

## 4. Teams App Package (Tenant B)

### Create Manifest

Create `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<APP_ID>",
  "packageName": "com.yourcompany.orderprocessing",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://yourcompany.com",
    "privacyUrl": "https://yourcompany.com/privacy",
    "termsOfUseUrl": "https://yourcompany.com/terms"
  },
  "name": {
    "short": "Order Processing",
    "full": "Sales Order Processing Bot"
  },
  "description": {
    "short": "Create draft sales orders from Excel files",
    "full": "Upload Excel spreadsheets to automatically create draft sales orders in Zoho Books with AI-powered validation"
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "<APP_ID>",
      "scopes": ["personal"],
      "supportsFiles": true,
      "isNotificationOnly": false
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["*.azurewebsites.net"]
}
```

### Create App Package

1. Create icons:
   - `color.png` (192x192)
   - `outline.png` (32x32)
2. Package files:
   ```bash
   zip teams-app.zip manifest.json color.png outline.png
   ```

### Upload to Teams (Tenant B)

1. Navigate to Teams Admin Center (Tenant B)
2. Go to "Teams apps" > "Manage apps"
3. Click "Upload new app"
4. Upload `teams-app.zip`
5. Configure app policies to allow the app for target users
6. Grant admin consent for the app registration

## 5. Configure Cross-Tenant Access (Tenant B)

If Tenant B has strict external collaboration policies:

1. Navigate to Microsoft Entra admin center (Tenant B)
2. Go to "External Identities" > "Cross-tenant access settings"
3. Add organization (Tenant A)
4. Configure outbound access:
   - Allow users and groups
   - Allow applications: Add the bot app registration
5. Save changes

## 6. Verify Deployment

### Test Bot Endpoint

```bash
curl https://order-processing-bot.azurewebsites.net/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "teams-bot",
  "timestamp": "2025-12-25T..."
}
```

### Test in Teams

1. Open Teams (Tenant B)
2. Search for "Order Processing" in the app store
3. Add the bot to a personal chat
4. Send "help" message
5. Upload a test Excel file
6. Verify processing card appears

## 7. Monitoring

### Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app order-processing-bot-insights \
  --location swedencentral \
  --resource-group order-processing-rg

# Link to App Service
az webapp config appsettings set \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="<CONNECTION_STRING>"
```

### View Logs

```bash
# Stream logs
az webapp log tail \
  --name order-processing-bot \
  --resource-group order-processing-rg

# Download logs
az webapp log download \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --log-file bot-logs.zip
```

## 8. Security Checklist

- [ ] App secret stored in Azure Key Vault
- [ ] Managed Identity enabled for storage access
- [ ] HTTPS only enforced on App Service
- [ ] Minimum TLS version set to 1.2
- [ ] Application Insights configured
- [ ] Diagnostic logs enabled
- [ ] Cross-tenant access configured correctly
- [ ] Bot validates tenant ID from activities
- [ ] No sensitive data in logs

## Troubleshooting

### Bot not responding

1. Check App Service is running
2. Verify messaging endpoint in Bot Service configuration
3. Check Application Insights for errors
4. Verify Bot Framework credentials are correct

### File upload fails

1. Check Managed Identity has Blob Data Contributor role
2. Verify storage account name in configuration
3. Check network access to storage account
4. Review logs for specific error messages

### Cross-tenant issues

1. Verify app is multi-tenant
2. Check cross-tenant access settings in Tenant B
3. Ensure admin consent granted in Tenant B
4. Verify Teams app is approved in Tenant B admin center

## Rollback

To rollback to a previous version:

```bash
az webapp deployment slot swap \
  --name order-processing-bot \
  --resource-group order-processing-rg \
  --slot staging
```

## References

- [Bot Framework Documentation](https://docs.microsoft.com/en-us/azure/bot-service/)
- [Teams App Manifest Schema](https://docs.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Multi-tenant Apps in Azure AD](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-convert-app-to-be-multi-tenant)
