// ============================================
// Azure AI Foundry Module (Hub + Project)
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Key Vault name for storing API keys')
param keyVaultName string

@description('Storage Account name for AI artifacts')
param storageAccountName string

@description('Application Insights name')
param appInsightsName string

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var hubName = 'order-processing-${environment}-hub'
var projectName = 'order-processing-${environment}-project'

// ============================================
// Resource References
// ============================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

// ============================================
// AI Services Account (Cognitive Services)
// ============================================

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: 'order-processing-${environment}-aiservices'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: environment == 'prod' ? 'S0' : 'F0'
  }
  properties: {
    customSubDomainName: 'order-processing-${environment}-ai'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// ============================================
// Azure AI Hub (Workspace Hub)
// ============================================

resource aiHub 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: hubName
  location: location
  tags: tags
  kind: 'Hub'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    friendlyName: 'Order Processing AI Hub (${environment})'
    description: 'Azure AI Foundry Hub for order processing workflows'
    storageAccount: storageAccount.id
    keyVault: keyVault.id
    applicationInsights: appInsights.id
    publicNetworkAccess: 'Enabled'
    managedNetwork: {
      isolationMode: 'Disabled'
    }
  }
}

// ============================================
// Azure AI Project (Workspace)
// ============================================

resource aiProject 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: projectName
  location: location
  tags: tags
  kind: 'Project'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    friendlyName: 'Order Processing Project (${environment})'
    description: 'AI Project for Excel parsing, committee voting, and order processing'
    hubResourceId: aiHub.id
    publicNetworkAccess: 'Enabled'
  }
}

// ============================================
// AI Services Connection to Hub
// ============================================

resource aiServicesConnection 'Microsoft.MachineLearningServices/workspaces/connections@2024-04-01' = {
  parent: aiHub
  name: 'aiservices-connection'
  properties: {
    category: 'AIServices'
    target: aiServices.properties.endpoint
    authType: 'ApiKey'
    credentials: {
      key: aiServices.listKeys().key1
    }
    metadata: {
      ApiVersion: '2024-04-01-preview'
      ResourceId: aiServices.id
    }
  }
}

// ============================================
// External Model Connections (Placeholders)
// These will use API keys from Key Vault
// ============================================

// Note: OpenAI, Anthropic, and other external model connections
// should be configured manually or via a separate deployment
// after API keys are stored in Key Vault

// ============================================
// Diagnostic Settings
// ============================================

resource hubDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'hub-diagnostics'
  scope: aiHub
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AmlComputeClusterEvent'
        enabled: true
      }
      {
        category: 'AmlComputeJobEvent'
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

resource projectDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'project-diagnostics'
  scope: aiProject
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AmlComputeClusterEvent'
        enabled: true
      }
      {
        category: 'AmlComputeJobEvent'
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

output hubName string = aiHub.name
output hubId string = aiHub.id
output hubPrincipalId string = aiHub.identity.principalId
output projectName string = aiProject.name
output projectId string = aiProject.id
output projectPrincipalId string = aiProject.identity.principalId
output aiServicesName string = aiServices.name
output aiServicesEndpoint string = aiServices.properties.endpoint
