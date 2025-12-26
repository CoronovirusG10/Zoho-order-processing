// ============================================
// Static Web App Module (Teams Tab)
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var staticWebAppName = 'order-processing-${environment}-swa'

// ============================================
// Static Web App
// ============================================

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Free'
    tier: environment == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    repositoryUrl: '' // To be configured via GitHub Actions or Azure DevOps
    branch: environment == 'prod' ? 'main' : 'develop'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'None' // Set to 'GitHub' or 'DevOps' when configuring CI/CD
    enterpriseGradeCdnStatus: 'Disabled'
    buildProperties: {
      appLocation: '/apps/teams-tab'
      apiLocation: ''
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
      apiBuildCommand: ''
    }
  }
}

// ============================================
// App Settings
// ============================================

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    ENVIRONMENT: environment
  }
}

// ============================================
// Custom Domain (optional for prod)
// ============================================

// Note: Custom domains need to be added manually or via separate deployment
// after DNS records are configured

// ============================================
// Outputs
// ============================================

output staticWebAppName string = staticWebApp.name
output staticWebAppId string = staticWebApp.id
output defaultHostname string = staticWebApp.properties.defaultHostname
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
