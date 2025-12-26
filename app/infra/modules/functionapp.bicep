// ============================================
// Function App Module
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Function App name')
param functionAppName string

@description('Hosting plan type')
@allowed(['Consumption', 'Premium'])
param planType string = 'Consumption'

@description('Storage account name for Function App')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault name')
param keyVaultName string

@description('Cosmos DB account name')
param cosmosAccountName string

@description('Cosmos DB database name')
param cosmosDatabaseName string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('VNet ID for VNet integration')
param vnetId string = ''

@description('Subnet ID for VNet integration')
param functionSubnetId string = ''

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var appServicePlanName = '${functionAppName}-plan'
// Using Node.js for TypeScript runtime (Teams Bot SDK)
var runtimeStack = 'node'
var runtimeVersion = '20'

// ============================================
// App Service Plan
// ============================================

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: planType == 'Consumption' ? {
    name: 'Y1'
    tier: 'Dynamic'
  } : {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  kind: planType == 'Consumption' ? 'functionapp' : 'elastic'
  properties: {
    reserved: true // Required for Linux
    maximumElasticWorkerCount: planType == 'Premium' ? 20 : null
  }
}

// ============================================
// Storage Account Reference
// ============================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// ============================================
// Key Vault Reference
// ============================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ============================================
// Cosmos DB Reference
// ============================================

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

// ============================================
// Function App
// ============================================

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    httpsOnly: true
    clientAffinityEnabled: false
    virtualNetworkSubnetId: !empty(functionSubnetId) ? functionSubnetId : null
    siteConfig: {
      linuxFxVersion: '${runtimeStack}|${runtimeVersion}'
      alwaysOn: planType == 'Premium'
      functionAppScaleLimit: planType == 'Consumption' ? 200 : 0
      minimumElasticInstanceCount: planType == 'Premium' ? 1 : 0
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: runtimeStack
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        // Key Vault reference for secrets
        {
          name: 'KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'ZOHO_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ZohoClientId)'
        }
        {
          name: 'ZOHO_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ZohoClientSecret)'
        }
        {
          name: 'ZOHO_REFRESH_TOKEN'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ZohoRefreshToken)'
        }
        // Cosmos DB connection
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosAccount.properties.documentEndpoint
        }
        {
          name: 'COSMOS_DATABASE'
          value: cosmosDatabaseName
        }
        // Storage containers
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
        {
          name: 'STORAGE_BLOB_ENDPOINT'
          value: storageAccount.properties.primaryEndpoints.blob
        }
        // Environment
        {
          name: 'ENVIRONMENT'
          value: environment
        }
        // Durable Functions configuration
        {
          name: 'AzureFunctionsJobHost__extensions__durableTask__hubName'
          value: '${functionAppName}Hub'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
        ]
        supportCredentials: false
      }
    }
  }
}

// ============================================
// Diagnostic Settings
// ============================================

resource functionDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'function-diagnostics'
  scope: functionApp
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// ============================================
// Outputs
// ============================================

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output functionAppDefaultHostName string = functionApp.properties.defaultHostName
output principalId string = functionApp.identity.principalId
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
