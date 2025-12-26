// ============================================
// Virtual Network Module (for Private Endpoints)
// ============================================

@description('Location for resources')
param location string

@description('Environment name')
param environment string

@description('Resource tags')
param tags object

// ============================================
// Variables
// ============================================

var vnetName = 'order-processing-${environment}-vnet'
var vnetAddressPrefix = '10.0.0.0/16'

var subnets = [
  {
    name: 'private-endpoints'
    addressPrefix: '10.0.1.0/24'
    delegation: null
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    name: 'functions'
    addressPrefix: '10.0.2.0/24'
    delegation: 'Microsoft.Web/serverFarms'
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    name: 'container-apps'
    addressPrefix: '10.0.3.0/23'
    delegation: null
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
]

// ============================================
// Network Security Group
// ============================================

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: '${vnetName}-nsg'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: 'Internet'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowAzureLoadBalancer'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

// ============================================
// Virtual Network
// ============================================

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
        networkSecurityGroup: {
          id: nsg.id
        }
        delegations: subnet.delegation != null ? [
          {
            name: subnet.delegation
            properties: {
              serviceName: subnet.delegation
            }
          }
        ] : []
        privateEndpointNetworkPolicies: subnet.privateEndpointNetworkPolicies
        privateLinkServiceNetworkPolicies: subnet.privateLinkServiceNetworkPolicies
        serviceEndpoints: [
          {
            service: 'Microsoft.Storage'
          }
          {
            service: 'Microsoft.KeyVault'
          }
          {
            service: 'Microsoft.AzureCosmosDB'
          }
        ]
      }
    }]
  }
}

// ============================================
// Outputs
// ============================================

output vnetName string = vnet.name
output vnetId string = vnet.id
output privateEndpointSubnetId string = vnet.properties.subnets[0].id
output functionSubnetId string = vnet.properties.subnets[1].id
output containerAppsSubnetId string = vnet.properties.subnets[2].id
