// ============================================
// Log Analytics Workspace Module
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Log retention in days')
param retentionDays int = 730

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var workspaceName = 'order-processing-${environment}-logs'

// ============================================
// Log Analytics Workspace
// ============================================

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: min(retentionDays, 730) // Max 730 days for workspace retention
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: environment == 'prod' ? -1 : 1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================
// Solutions
// ============================================

// Container Insights (for Container Apps)
resource containerInsightsSolution 'Microsoft.OperationsManagement/solutions@2015-11-01-preview' = {
  name: 'ContainerInsights(${workspace.name})'
  location: location
  tags: tags
  plan: {
    name: 'ContainerInsights(${workspace.name})'
    product: 'OMSGallery/ContainerInsights'
    promotionCode: ''
    publisher: 'Microsoft'
  }
  properties: {
    workspaceResourceId: workspace.id
  }
}

// Security Center
resource securityCenterSolution 'Microsoft.OperationsManagement/solutions@2015-11-01-preview' = if (environment == 'prod') {
  name: 'Security(${workspace.name})'
  location: location
  tags: tags
  plan: {
    name: 'Security(${workspace.name})'
    product: 'OMSGallery/Security'
    promotionCode: ''
    publisher: 'Microsoft'
  }
  properties: {
    workspaceResourceId: workspace.id
  }
}

// ============================================
// Outputs
// ============================================

output workspaceName string = workspace.name
output workspaceId string = workspace.id
output workspaceCustomerId string = workspace.properties.customerId
