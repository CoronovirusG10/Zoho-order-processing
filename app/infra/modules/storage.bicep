// ============================================
// Storage Account Module
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Unique suffix for storage account name')
param uniqueSuffix string

@description('Retention in days for blob lifecycle')
param retentionDays int = 1825

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

var storageAccountName = 'orderstor${uniqueSuffix}'

// ============================================
// Storage Account
// ============================================

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: tags
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: enablePrivateEndpoint ? 'Deny' : 'Allow'
    }
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
        file: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// ============================================
// Blob Service
// ============================================

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    changeFeed: {
      enabled: true
      retentionInDays: 90
    }
    isVersioningEnabled: true
  }
}

// ============================================
// Blob Containers
// ============================================

resource incomingContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'orders-incoming'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Raw uploaded Excel files'
    }
  }
}

resource auditContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'orders-audit'
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: true
    }
    metadata: {
      description: 'Immutable audit bundles (canonical JSON, evidence, committee votes)'
    }
  }
}

resource logsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'logs-archive'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Archived diagnostic logs and traces'
    }
  }
}

resource committeeContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'committee-evidence'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Committee model evidence packs and voting results'
    }
  }
}

// ============================================
// Queue Service
// ============================================

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource caseProcessingQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'case-processing'
  properties: {
    metadata: {
      description: 'Queue for case processing workflow'
    }
  }
}

resource zohoRetryQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'zoho-retry'
  properties: {
    metadata: {
      description: 'Queue for Zoho API retry operations'
    }
  }
}

// ============================================
// Lifecycle Management Policy
// ============================================

resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'tierToCool'
          enabled: true
          type: 'Lifecycle'
          definition: {
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 30
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
                delete: {
                  daysAfterModificationGreaterThan: retentionDays
                }
              }
              snapshot: {
                delete: {
                  daysAfterCreationGreaterThan: retentionDays
                }
              }
              version: {
                delete: {
                  daysAfterCreationGreaterThan: retentionDays
                }
              }
            }
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                'orders-audit/'
                'orders-incoming/'
                'logs-archive/'
              ]
            }
          }
        }
      ]
    }
  }
}

// ============================================
// Diagnostic Settings
// ============================================

resource storageDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'storage-diagnostics'
  scope: storage
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

resource blobDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'blob-diagnostics'
  scope: blobService
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'StorageRead'
        enabled: true
      }
      {
        category: 'StorageWrite'
        enabled: true
      }
      {
        category: 'StorageDelete'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

// ============================================
// Private Endpoint (if enabled)
// ============================================

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = if (enablePrivateEndpoint) {
  name: '${storageAccountName}-blob-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${storageAccountName}-blob-plsc'
        properties: {
          privateLinkServiceId: storage.id
          groupIds: [
            'blob'
          ]
        }
      }
    ]
  }
}

// ============================================
// Outputs
// ============================================

output storageAccountName string = storage.name
output storageAccountId string = storage.id
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
output blobEndpoint string = storage.properties.primaryEndpoints.blob
output queueEndpoint string = storage.properties.primaryEndpoints.queue
