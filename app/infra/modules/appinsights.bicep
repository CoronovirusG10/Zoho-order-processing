// ============================================
// Application Insights Module
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var appInsightsName = 'order-processing-${environment}-ai'

// ============================================
// Application Insights
// ============================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 90
    DisableIpMasking: false
  }
}

// ============================================
// Outputs
// ============================================

output appInsightsName string = appInsights.name
output appInsightsId string = appInsights.id
output instrumentationKey string = appInsights.properties.InstrumentationKey
output connectionString string = appInsights.properties.ConnectionString
