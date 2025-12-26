// ============================================
// RBAC Assignments Module
// ============================================

@description('Storage account name')
param storageAccountName string

@description('Cosmos DB account name')
param cosmosAccountName string

@description('Key Vault name')
param keyVaultName string

@description('Function App Workflow principal ID')
param functionAppWorkflowPrincipalId string

@description('Function App Parser principal ID')
param functionAppParserPrincipalId string

@description('Function App Zoho principal ID')
param functionAppZohoPrincipalId string

@description('Container App principal ID (optional)')
param containerAppPrincipalId string = ''

// ============================================
// Built-in Role Definitions
// ============================================

var storageAccountContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '17d1049b-9a84-46fb-8f53-869881c3d3ab')
var storageBlobDataContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var storageQueueDataContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
var cosmosDBAccountContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5bd9cd88-fe45-4216-938b-f97437e15450')
var cosmosDBDataContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '00000000-0000-0000-0000-000000000002')
var keyVaultSecretsUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

// ============================================
// Resource References
// ============================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ============================================
// Storage RBAC - Workflow Function
// ============================================

resource storageWorkflowBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppWorkflowPrincipalId, storageBlobDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributor
    principalId: functionAppWorkflowPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storageWorkflowQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppWorkflowPrincipalId, storageQueueDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageQueueDataContributor
    principalId: functionAppWorkflowPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Storage RBAC - Parser Function
// ============================================

resource storageParserBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppParserPrincipalId, storageBlobDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributor
    principalId: functionAppParserPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storageParserQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppParserPrincipalId, storageQueueDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageQueueDataContributor
    principalId: functionAppParserPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Storage RBAC - Zoho Function
// ============================================

resource storageZohoBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppZohoPrincipalId, storageBlobDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributor
    principalId: functionAppZohoPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Cosmos DB RBAC - All Functions
// ============================================

resource cosmosWorkflowRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cosmosAccount.id, functionAppWorkflowPrincipalId, cosmosDBDataContributor)
  scope: cosmosAccount
  properties: {
    roleDefinitionId: cosmosDBDataContributor
    principalId: functionAppWorkflowPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource cosmosParserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cosmosAccount.id, functionAppParserPrincipalId, cosmosDBDataContributor)
  scope: cosmosAccount
  properties: {
    roleDefinitionId: cosmosDBDataContributor
    principalId: functionAppParserPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource cosmosZohoRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cosmosAccount.id, functionAppZohoPrincipalId, cosmosDBDataContributor)
  scope: cosmosAccount
  properties: {
    roleDefinitionId: cosmosDBDataContributor
    principalId: functionAppZohoPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Key Vault RBAC - All Functions
// ============================================

resource kvWorkflowRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppWorkflowPrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUser
    principalId: functionAppWorkflowPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource kvParserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppParserPrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUser
    principalId: functionAppParserPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource kvZohoRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppZohoPrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUser
    principalId: functionAppZohoPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Container App RBAC (if enabled)
// ============================================

resource storageContainerAppBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(containerAppPrincipalId)) {
  name: guid(storageAccount.id, containerAppPrincipalId, storageBlobDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributor
    principalId: containerAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource cosmosContainerAppRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(containerAppPrincipalId)) {
  name: guid(cosmosAccount.id, containerAppPrincipalId, cosmosDBDataContributor)
  scope: cosmosAccount
  properties: {
    roleDefinitionId: cosmosDBDataContributor
    principalId: containerAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource kvContainerAppRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(containerAppPrincipalId)) {
  name: guid(keyVault.id, containerAppPrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUser
    principalId: containerAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Outputs
// ============================================

output assignedRoles array = [
  'Storage Blob Data Contributor'
  'Storage Queue Data Contributor'
  'Cosmos DB Data Contributor'
  'Key Vault Secrets User'
]
