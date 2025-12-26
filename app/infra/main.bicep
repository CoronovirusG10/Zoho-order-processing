targetScope = 'subscription'

// ============================================
// Parameters
// ============================================

@description('Environment name')
@allowed(['dev', 'test', 'prod'])
param environment string

@description('Location for resources')
param location string = 'swedencentral'

@description('Unique suffix for globally unique names')
param uniqueSuffix string = substring(uniqueString(subscription().id, environment), 0, 6)

@description('Owner tag value')
param owner string = 'sales-team'

@description('Cosmos DB throughput mode')
@allowed(['serverless', 'provisioned'])
param cosmosThroughputMode string = 'serverless'

@description('Function App hosting plan type')
@allowed(['Consumption', 'Premium'])
param functionPlanType string = 'Consumption'

@description('Enable private endpoints (recommended for prod)')
param enablePrivateEndpoints bool = (environment == 'prod')

@description('Log Analytics retention in days')
param logRetentionDays int = 730

@description('Blob storage retention in days')
param blobRetentionDays int = 1825

@description('Foundry Hub resource ID (existing)')
param foundryHubResourceId string = ''

@description('Foundry Project resource ID (existing)')
param foundryProjectResourceId string = ''

@description('Zoho OAuth Client ID (will be stored in Key Vault)')
@secure()
param zohoClientId string = ''

@description('Zoho OAuth Client Secret (will be stored in Key Vault)')
@secure()
param zohoClientSecret string = ''

@description('Zoho Refresh Token (will be stored in Key Vault)')
@secure()
param zohoRefreshToken string = ''

@description('Teams Tenant ID (Tenant B)')
param teamsAppTenantId string = ''

@description('Teams App ID')
param teamsAppId string = ''

@description('Deploy AI Foundry resources')
param deployAiFoundry bool = true

@description('OpenAI API Key (for GPT models)')
@secure()
param openAiApiKey string = ''

@description('Anthropic API Key (for Claude models)')
@secure()
param anthropicApiKey string = ''

@description('Google AI API Key (for Gemini models)')
@secure()
param googleAiApiKey string = ''

@description('DeepSeek API Key')
@secure()
param deepSeekApiKey string = ''

@description('xAI API Key (for Grok models)')
@secure()
param xAiApiKey string = ''

// ============================================
// Variables
// ============================================

var resourceGroupName = 'order-processing-${environment}-rg'
var commonTags = {
  environment: environment
  project: 'order-processing'
  owner: owner
  managedBy: 'bicep'
}

// ============================================
// Resource Group
// ============================================

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

// ============================================
// Networking (if private endpoints enabled)
// ============================================

module vnet 'modules/vnet.bicep' = if (enablePrivateEndpoints) {
  scope: rg
  name: 'vnet-deployment'
  params: {
    location: location
    environment: environment
    tags: commonTags
  }
}

// ============================================
// Monitoring & Observability
// ============================================

module logAnalytics 'modules/loganalytics.bicep' = {
  scope: rg
  name: 'loganalytics-deployment'
  params: {
    location: location
    environment: environment
    retentionDays: logRetentionDays
    tags: commonTags
  }
}

module appInsights 'modules/appinsights.bicep' = {
  scope: rg
  name: 'appinsights-deployment'
  params: {
    location: location
    environment: environment
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: commonTags
  }
}

// ============================================
// Storage
// ============================================

module storage 'modules/storage.bicep' = {
  scope: rg
  name: 'storage-deployment'
  params: {
    location: location
    environment: environment
    uniqueSuffix: uniqueSuffix
    retentionDays: blobRetentionDays
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    enablePrivateEndpoint: enablePrivateEndpoints
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    privateEndpointSubnetId: enablePrivateEndpoints ? vnet.outputs.privateEndpointSubnetId : ''
    tags: commonTags
  }
}

// ============================================
// Cosmos DB
// ============================================

module cosmos 'modules/cosmos.bicep' = {
  scope: rg
  name: 'cosmos-deployment'
  params: {
    location: location
    environment: environment
    throughputMode: cosmosThroughputMode
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    enablePrivateEndpoint: enablePrivateEndpoints
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    privateEndpointSubnetId: enablePrivateEndpoints ? vnet.outputs.privateEndpointSubnetId : ''
    tags: commonTags
  }
}

// ============================================
// Key Vault
// ============================================

module keyVault 'modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-deployment'
  params: {
    location: location
    environment: environment
    uniqueSuffix: uniqueSuffix
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    enablePrivateEndpoint: enablePrivateEndpoints
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    privateEndpointSubnetId: enablePrivateEndpoints ? vnet.outputs.privateEndpointSubnetId : ''
    tags: commonTags
  }
}

// ============================================
// Function Apps
// ============================================

module functionAppWorkflow 'modules/functionapp.bicep' = {
  scope: rg
  name: 'functionapp-workflow-deployment'
  params: {
    location: location
    environment: environment
    functionAppName: 'order-workflow-${environment}-func'
    planType: functionPlanType
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosAccountName: cosmos.outputs.accountName
    cosmosDatabaseName: cosmos.outputs.databaseName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    functionSubnetId: enablePrivateEndpoints ? vnet.outputs.functionSubnetId : ''
    tags: commonTags
  }
}

module functionAppParser 'modules/functionapp.bicep' = {
  scope: rg
  name: 'functionapp-parser-deployment'
  params: {
    location: location
    environment: environment
    functionAppName: 'order-parser-${environment}-func'
    planType: functionPlanType
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosAccountName: cosmos.outputs.accountName
    cosmosDatabaseName: cosmos.outputs.databaseName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    functionSubnetId: enablePrivateEndpoints ? vnet.outputs.functionSubnetId : ''
    tags: commonTags
  }
}

module functionAppZoho 'modules/functionapp.bicep' = {
  scope: rg
  name: 'functionapp-zoho-deployment'
  params: {
    location: location
    environment: environment
    functionAppName: 'order-zoho-${environment}-func'
    planType: functionPlanType
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosAccountName: cosmos.outputs.accountName
    cosmosDatabaseName: cosmos.outputs.databaseName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    vnetId: enablePrivateEndpoints ? vnet.outputs.vnetId : ''
    functionSubnetId: enablePrivateEndpoints ? vnet.outputs.functionSubnetId : ''
    tags: commonTags
  }
}

// ============================================
// Azure Bot
// ============================================

module bot 'modules/bot.bicep' = {
  scope: rg
  name: 'bot-deployment'
  params: {
    location: 'global'
    environment: environment
    teamsAppId: teamsAppId
    functionAppWorkflowEndpoint: functionAppWorkflow.outputs.functionAppDefaultHostName
    keyVaultName: keyVault.outputs.keyVaultName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: commonTags
  }
}

// ============================================
// Static Web App (Teams Tab)
// ============================================

module staticWebApp 'modules/staticwebapp.bicep' = {
  scope: rg
  name: 'staticwebapp-deployment'
  params: {
    location: location
    environment: environment
    appInsightsConnectionString: appInsights.outputs.connectionString
    tags: commonTags
  }
}

// ============================================
// Container App (Optional - for bot runtime)
// ============================================

module containerApp 'modules/containerapp.bicep' = if (environment == 'prod') {
  scope: rg
  name: 'containerapp-deployment'
  params: {
    location: location
    environment: environment
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    tags: commonTags
  }
}

// ============================================
// Azure AI Foundry (Hub + Project)
// ============================================

module aiFoundry 'modules/aifoundry.bicep' = if (deployAiFoundry) {
  scope: rg
  name: 'aifoundry-deployment'
  params: {
    location: location
    environment: environment
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    appInsightsName: appInsights.outputs.appInsightsName
    tags: commonTags
  }
  dependsOn: [
    keyVault
    storage
    appInsights
  ]
}

// ============================================
// Key Vault Secrets
// ============================================

module secrets 'modules/secrets.bicep' = {
  scope: rg
  name: 'secrets-deployment'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    zohoClientId: zohoClientId
    zohoClientSecret: zohoClientSecret
    zohoRefreshToken: zohoRefreshToken
    storageConnectionString: storage.outputs.connectionString
    cosmosConnectionString: cosmos.outputs.connectionString
    appInsightsConnectionString: appInsights.outputs.connectionString
    openAiApiKey: openAiApiKey
    anthropicApiKey: anthropicApiKey
    googleAiApiKey: googleAiApiKey
    deepSeekApiKey: deepSeekApiKey
    xAiApiKey: xAiApiKey
  }
  dependsOn: [
    keyVault
    storage
    cosmos
    appInsights
  ]
}

// ============================================
// RBAC Assignments
// ============================================

module rbac 'modules/rbac.bicep' = {
  scope: rg
  name: 'rbac-deployment'
  params: {
    storageAccountName: storage.outputs.storageAccountName
    cosmosAccountName: cosmos.outputs.accountName
    keyVaultName: keyVault.outputs.keyVaultName
    functionAppWorkflowPrincipalId: functionAppWorkflow.outputs.principalId
    functionAppParserPrincipalId: functionAppParser.outputs.principalId
    functionAppZohoPrincipalId: functionAppZoho.outputs.principalId
    containerAppPrincipalId: environment == 'prod' ? containerApp.outputs.principalId : ''
  }
}

// ============================================
// Outputs - Resource Names
// ============================================

output resourceGroupName string = resourceGroupName
output storageAccountName string = storage.outputs.storageAccountName
output cosmosAccountName string = cosmos.outputs.accountName
output keyVaultName string = keyVault.outputs.keyVaultName
output appInsightsName string = appInsights.outputs.appInsightsName
output logAnalyticsWorkspaceName string = logAnalytics.outputs.workspaceName
output botName string = bot.outputs.botName
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output functionAppWorkflowName string = functionAppWorkflow.outputs.functionAppName
output functionAppParserName string = functionAppParser.outputs.functionAppName
output functionAppZohoName string = functionAppZoho.outputs.functionAppName

// ============================================
// Outputs - Endpoint URLs
// ============================================

output staticWebAppUrl string = 'https://${staticWebApp.outputs.defaultHostname}'
output functionAppWorkflowUrl string = functionAppWorkflow.outputs.functionAppUrl
output functionAppParserUrl string = functionAppParser.outputs.functionAppUrl
output functionAppZohoUrl string = functionAppZoho.outputs.functionAppUrl
output botEndpoint string = bot.outputs.botEndpoint
output storageEndpoint string = storage.outputs.blobEndpoint
output cosmosEndpoint string = cosmos.outputs.endpoint
output keyVaultUri string = keyVault.outputs.keyVaultUri

// ============================================
// Outputs - Connection Strings (for local dev)
// ============================================

output appInsightsConnectionString string = appInsights.outputs.connectionString
output appInsightsInstrumentationKey string = appInsights.outputs.instrumentationKey
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId

// ============================================
// Outputs - Managed Identity Principal IDs
// ============================================

output functionAppWorkflowPrincipalId string = functionAppWorkflow.outputs.principalId
output functionAppParserPrincipalId string = functionAppParser.outputs.principalId
output functionAppZohoPrincipalId string = functionAppZoho.outputs.principalId
output containerAppPrincipalId string = environment == 'prod' ? containerApp.outputs.principalId : ''

// ============================================
// Outputs - AI Foundry (if deployed)
// ============================================

output aiFoundryHubName string = deployAiFoundry ? aiFoundry.outputs.hubName : ''
output aiFoundryProjectName string = deployAiFoundry ? aiFoundry.outputs.projectName : ''
output aiFoundryHubPrincipalId string = deployAiFoundry ? aiFoundry.outputs.hubPrincipalId : ''
output aiFoundryProjectPrincipalId string = deployAiFoundry ? aiFoundry.outputs.projectPrincipalId : ''
output aiServicesEndpoint string = deployAiFoundry ? aiFoundry.outputs.aiServicesEndpoint : ''

// ============================================
// Outputs - Cosmos DB Details
// ============================================

output cosmosDatabaseName string = cosmos.outputs.databaseName
