// ============================================
// Azure Bot Service Module
// ============================================

@description('Location for bot (must be global)')
param location string = 'global'

@description('Environment name')
param environment string

@description('Teams App ID (Microsoft App ID)')
param teamsAppId string

@description('Function App workflow endpoint')
param functionAppWorkflowEndpoint string

@description('Key Vault name for storing bot secret')
param keyVaultName string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var botName = 'order-processing-${environment}-bot'
var messagingEndpoint = 'https://${functionAppWorkflowEndpoint}/api/messages'

// ============================================
// Azure Bot
// ============================================

resource bot 'Microsoft.BotService/botServices@2023-09-15-preview' = {
  name: botName
  location: location
  tags: tags
  sku: {
    name: 'F0' // Free tier for dev, use S1 for prod
  }
  kind: 'azurebot'
  properties: {
    displayName: 'Order Processing Bot (${environment})'
    description: 'Sales order intake bot for Teams - Excel to Zoho workflow'
    endpoint: messagingEndpoint
    msaAppId: teamsAppId
    msaAppType: 'MultiTenant'
    msaAppTenantId: subscription().tenantId
    schemaTransformationVersion: '1.3'
    isCmekEnabled: false
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// ============================================
// Teams Channel
// ============================================

resource teamsChannel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: bot
  name: 'MsTeamsChannel'
  location: location
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      enableCalling: false
      isEnabled: true
      incomingCallRoute: 'concurrent'
      deploymentEnvironment: 'CommercialDeployment'
      acceptedTerms: true
    }
  }
}

// ============================================
// Diagnostic Settings
// ============================================

resource botDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'bot-diagnostics'
  scope: bot
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'BotRequest'
        enabled: true
      }
      {
        category: 'DependencyRequest'
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

output botName string = bot.name
output botId string = bot.id
output botEndpoint string = messagingEndpoint
