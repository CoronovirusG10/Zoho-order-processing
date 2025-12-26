// ============================================
// Cosmos DB Module
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Throughput mode: serverless or provisioned')
@allowed(['serverless', 'provisioned'])
param throughputMode string = 'serverless'

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Enable private endpoint')
param enablePrivateEndpoint bool = false

@description('VNet ID for private endpoint')
param vnetId string = ''

@description('Subnet ID for private endpoint')
param privateEndpointSubnetId string = ''

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var accountName = 'order-processing-${environment}-cosmos'
var databaseName = 'order-processing'

// ============================================
// Cosmos DB Account
// ============================================

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: environment == 'prod'
      }
    ]
    capabilities: throughputMode == 'serverless' ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    enableAutomaticFailover: environment == 'prod'
    enableMultipleWriteLocations: false
    publicNetworkAccess: enablePrivateEndpoint ? 'Disabled' : 'Enabled'
    networkAclBypass: 'AzureServices'
    disableKeyBasedMetadataWriteAccess: false
    enableFreeTier: environment == 'dev'
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
  }
}

// ============================================
// Database
// ============================================

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// ============================================
// Containers
// ============================================

// Cases container - partitioned by tenantId
resource casesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'cases'
  properties: {
    resource: {
      id: 'cases'
      partitionKey: {
        paths: [
          '/tenantId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
        compositeIndexes: [
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/createdAt'
              order: 'descending'
            }
          ]
          [
            {
              path: '/userId'
              order: 'ascending'
            }
            {
              path: '/status'
              order: 'ascending'
            }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: [
              '/caseId'
            ]
          }
        ]
      }
      defaultTtl: -1
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// Fingerprints container - for idempotency
resource fingerprintsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'fingerprints'
  properties: {
    resource: {
      id: 'fingerprints'
      partitionKey: {
        paths: [
          '/fingerprint'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: [
              '/fingerprint'
            ]
          }
        ]
      }
      defaultTtl: -1
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// Events container - for audit trail
resource eventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'events'
  properties: {
    resource: {
      id: 'events'
      partitionKey: {
        paths: [
          '/caseId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        compositeIndexes: [
          [
            {
              path: '/caseId'
              order: 'ascending'
            }
            {
              path: '/timestamp'
              order: 'descending'
            }
          ]
        ]
      }
      defaultTtl: -1
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// Agent threads container - for Foundry agent state
resource agentThreadsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'agentThreads'
  properties: {
    resource: {
      id: 'agentThreads'
      partitionKey: {
        paths: [
          '/threadId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
      defaultTtl: 2592000 // 30 days TTL for agent threads
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// Committee votes container - for ML committee results
resource committeeVotesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'committeeVotes'
  properties: {
    resource: {
      id: 'committeeVotes'
      partitionKey: {
        paths: [
          '/caseId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
      }
      defaultTtl: -1 // Keep forever for audit
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// Cache container - for Zoho API responses, item lookups, etc.
resource cacheContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'cache'
  properties: {
    resource: {
      id: 'cache'
      partitionKey: {
        paths: [
          '/cacheKey'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/cacheKey/?'
          }
          {
            path: '/cacheType/?'
          }
          {
            path: '/expiresAt/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
        ]
      }
      // Cache items expire after 24 hours by default (can be overridden per-item)
      defaultTtl: 86400
    }
    options: throughputMode == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}

// ============================================
// Diagnostic Settings
// ============================================

resource cosmosDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'cosmos-diagnostics'
  scope: cosmosAccount
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'DataPlaneRequests'
        enabled: true
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
      }
      {
        category: 'PartitionKeyStatistics'
        enabled: true
      }
      {
        category: 'ControlPlaneRequests'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Requests'
        enabled: true
      }
    ]
  }
}

// ============================================
// Private Endpoint (if enabled)
// ============================================

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = if (enablePrivateEndpoint) {
  name: '${accountName}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${accountName}-plsc'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: [
            'Sql'
          ]
        }
      }
    ]
  }
}

// ============================================
// Outputs
// ============================================

output accountName string = cosmosAccount.name
output accountId string = cosmosAccount.id
output databaseName string = databaseName
output endpoint string = cosmosAccount.properties.documentEndpoint
output connectionString string = 'AccountEndpoint=${cosmosAccount.properties.documentEndpoint};AccountKey=${cosmosAccount.listKeys().primaryMasterKey}'
