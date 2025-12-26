# Deployment Guide - Teams Personal Tab

This guide covers deploying the Teams personal tab to Azure.

## Prerequisites

- Azure subscription
- Azure CLI installed and authenticated
- Node.js 18+ installed
- Teams app manifest prepared

## Option 1: Azure Static Web Apps (Recommended)

Azure Static Web Apps is ideal for SPA deployments with automatic HTTPS, global CDN, and CI/CD integration.

### Step 1: Create Static Web App

```bash
# Create resource group (if not exists)
az group create \
  --name rg-order-processing-prod \
  --location swedencentral

# Create Static Web App
az staticwebapp create \
  --name swa-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --location westeurope \
  --sku Standard
```

### Step 2: Configure Environment Variables

```bash
# Set environment variables
az staticwebapp appsettings set \
  --name swa-order-processing-tab \
  --setting-names \
    VITE_API_BASE_URL=https://api-order-processing.azurewebsites.net/api \
    VITE_TAB_APP_CLIENT_ID=your-tab-app-client-id
```

### Step 3: Deploy

```bash
# Build the app
npm run build

# Deploy (using Azure CLI or GitHub Actions)
az staticwebapp deploy \
  --name swa-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --app-location dist
```

### Step 4: Configure Custom Domain (Optional)

```bash
# Add custom domain
az staticwebapp hostname set \
  --name swa-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --hostname tab.order-processing.company.com
```

## Option 2: Azure App Service

### Step 1: Create App Service Plan

```bash
# Create App Service Plan
az appservice plan create \
  --name asp-order-processing \
  --resource-group rg-order-processing-prod \
  --sku B1 \
  --is-linux
```

### Step 2: Create Web App

```bash
# Create Web App
az webapp create \
  --name app-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --plan asp-order-processing \
  --runtime "NODE:18-lts"
```

### Step 3: Configure Web App

```bash
# Enable HTTPS only
az webapp update \
  --name app-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --https-only true

# Set environment variables
az webapp config appsettings set \
  --name app-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --settings \
    VITE_API_BASE_URL=https://api-order-processing.azurewebsites.net/api \
    VITE_TAB_APP_CLIENT_ID=your-tab-app-client-id
```

### Step 4: Deploy

```bash
# Build the app
npm run build

# Create deployment package
cd dist
zip -r ../deploy.zip .
cd ..

# Deploy
az webapp deployment source config-zip \
  --name app-order-processing-tab \
  --resource-group rg-order-processing-prod \
  --src deploy.zip
```

## CI/CD with GitHub Actions

### Create Workflow

Create `.github/workflows/deploy-teams-tab.yml`:

```yaml
name: Deploy Teams Tab

on:
  push:
    branches:
      - main
    paths:
      - 'app/services/teams-tab/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: app/services/teams-tab/package-lock.json

      - name: Install dependencies
        working-directory: app/services/teams-tab
        run: npm ci

      - name: Type check
        working-directory: app/services/teams-tab
        run: npm run type-check

      - name: Lint
        working-directory: app/services/teams-tab
        run: npm run lint

      - name: Build
        working-directory: app/services/teams-tab
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          VITE_TAB_APP_CLIENT_ID: ${{ secrets.TAB_APP_CLIENT_ID }}

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: 'app/services/teams-tab'
          output_location: 'dist'
```

### Configure Secrets

In GitHub repository settings, add secrets:
- `API_BASE_URL`
- `TAB_APP_CLIENT_ID`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

## Teams App Manifest Configuration

Update your Teams app manifest with the deployed URL:

```json
{
  "staticTabs": [
    {
      "entityId": "myCases",
      "name": "My Cases",
      "contentUrl": "https://swa-order-processing-tab.azurestaticapps.net",
      "websiteUrl": "https://swa-order-processing-tab.azurestaticapps.net",
      "scopes": ["personal"]
    }
  ],
  "webApplicationInfo": {
    "id": "{TAB_APP_CLIENT_ID}",
    "resource": "api://{TAB_APP_CLIENT_ID}"
  },
  "validDomains": [
    "swa-order-processing-tab.azurestaticapps.net"
  ]
}
```

## Post-Deployment Steps

### 1. Test SSO Flow

1. Upload Teams app package to Tenant B
2. Install app for a test user
3. Open personal tab
4. Verify SSO authentication works
5. Check API calls succeed

### 2. Configure CORS on API

Ensure API allows requests from tab domain:

```bash
az webapp cors add \
  --name api-order-processing \
  --resource-group rg-order-processing-prod \
  --allowed-origins https://swa-order-processing-tab.azurestaticapps.net
```

### 3. Monitor and Logs

```bash
# View Static Web App logs
az staticwebapp logs show \
  --name swa-order-processing-tab \
  --resource-group rg-order-processing-prod
```

### 4. Configure Application Insights

```bash
# Link Application Insights
az staticwebapp appsettings set \
  --name swa-order-processing-tab \
  --setting-names \
    APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string
```

## Security Checklist

- [ ] HTTPS enforced (automatic with Azure)
- [ ] Environment variables set correctly
- [ ] CORS configured on API
- [ ] Entra app registration multi-tenant configured
- [ ] Valid domains in Teams manifest
- [ ] CSP headers configured (if needed)
- [ ] No secrets in client-side code

## Troubleshooting

### Build Fails

- Check Node.js version matches local dev
- Verify all dependencies installed
- Check environment variables set

### SSO Not Working

- Verify `webApplicationInfo` in manifest
- Check Entra app redirect URIs
- Review browser console for errors
- Test token exchange endpoint

### API Calls Fail

- Check CORS configuration
- Verify API_BASE_URL environment variable
- Test API endpoints directly
- Review network tab in browser

### Theme Not Updating

- Clear browser cache
- Check Teams SDK initialization
- Verify CSS loaded correctly

## Rollback

If deployment fails:

```bash
# List deployments
az staticwebapp show \
  --name swa-order-processing-tab \
  --resource-group rg-order-processing-prod

# Rollback (redeploy previous version)
# Or use Azure Portal to swap deployment slots
```

## Performance Optimization

### Enable CDN

```bash
# Enable Azure CDN
az cdn endpoint create \
  --name cdn-order-processing-tab \
  --profile-name cdn-profile \
  --resource-group rg-order-processing-prod \
  --origin swa-order-processing-tab.azurestaticapps.net
```

### Enable Compression

Compression is automatic with Static Web Apps.

### Cache Headers

Configure in `staticwebapp.config.json`:

```json
{
  "routes": [
    {
      "route": "/assets/*",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    }
  ]
}
```

## Monitoring

### Application Insights

Add to `index.html`:

```html
<script type="module">
  import { ApplicationInsights } from '@microsoft/applicationinsights-web';

  const appInsights = new ApplicationInsights({
    config: {
      connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING
    }
  });
  appInsights.loadAppInsights();
  appInsights.trackPageView();
</script>
```

### Health Check

Create basic health endpoint or use Static Web Apps built-in health checks.
