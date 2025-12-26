// ============================================
// Key Vault Secrets Module
// ============================================

@description('Key Vault name')
param keyVaultName string

@secure()
@description('Zoho OAuth Client ID')
param zohoClientId string

@secure()
@description('Zoho OAuth Client Secret')
param zohoClientSecret string

@secure()
@description('Zoho Refresh Token')
param zohoRefreshToken string

@secure()
@description('Storage connection string')
param storageConnectionString string

@secure()
@description('Cosmos DB connection string')
param cosmosConnectionString string

@secure()
@description('Application Insights connection string')
param appInsightsConnectionString string

@secure()
@description('OpenAI API Key (for GPT models)')
param openAiApiKey string = ''

@secure()
@description('Anthropic API Key (for Claude models)')
param anthropicApiKey string = ''

@secure()
@description('Google AI API Key (for Gemini models)')
param googleAiApiKey string = ''

@secure()
@description('DeepSeek API Key')
param deepSeekApiKey string = ''

@secure()
@description('xAI API Key (for Grok models)')
param xAiApiKey string = ''

// ============================================
// Key Vault Reference
// ============================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ============================================
// Zoho Secrets
// ============================================

resource zohoClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(zohoClientId)) {
  parent: keyVault
  name: 'ZohoClientId'
  properties: {
    value: zohoClientId
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource zohoClientSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(zohoClientSecret)) {
  parent: keyVault
  name: 'ZohoClientSecret'
  properties: {
    value: zohoClientSecret
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource zohoRefreshTokenSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(zohoRefreshToken)) {
  parent: keyVault
  name: 'ZohoRefreshToken'
  properties: {
    value: zohoRefreshToken
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ============================================
// Azure Service Connection Strings
// ============================================

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'StorageConnectionString'
  properties: {
    value: storageConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CosmosConnectionString'
  properties: {
    value: cosmosConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource appInsightsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AppInsightsConnectionString'
  properties: {
    value: appInsightsConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ============================================
// Placeholder Secrets (to be updated later)
// ============================================

resource teamsAppPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'TeamsAppPassword'
  properties: {
    value: 'PLACEHOLDER-UPDATE-AFTER-TEAMS-APP-REGISTRATION'
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ============================================
// Model API Keys (for Committee)
// ============================================

resource openAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openAiApiKey)) {
  parent: keyVault
  name: 'OpenAiApiKey'
  properties: {
    value: openAiApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource anthropicApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(anthropicApiKey)) {
  parent: keyVault
  name: 'AnthropicApiKey'
  properties: {
    value: anthropicApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource googleAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(googleAiApiKey)) {
  parent: keyVault
  name: 'GoogleAiApiKey'
  properties: {
    value: googleAiApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource deepSeekApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(deepSeekApiKey)) {
  parent: keyVault
  name: 'DeepSeekApiKey'
  properties: {
    value: deepSeekApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource xAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(xAiApiKey)) {
  parent: keyVault
  name: 'XAiApiKey'
  properties: {
    value: xAiApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ============================================
// Outputs
// ============================================

output secretNames array = [
  'ZohoClientId'
  'ZohoClientSecret'
  'ZohoRefreshToken'
  'StorageConnectionString'
  'CosmosConnectionString'
  'AppInsightsConnectionString'
  'TeamsAppPassword'
  'OpenAiApiKey'
  'AnthropicApiKey'
  'GoogleAiApiKey'
  'DeepSeekApiKey'
  'XAiApiKey'
]
