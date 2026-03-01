// Provisions the Azure Functions backend API on the Consumption plan.
//
// Resources created:
//   1. Storage Account  — required by the Functions runtime for internal state,
//      trigger management, and logging.
//   2. App Service Plan  — Consumption (Y1 / Dynamic) SKU; pay-per-execution with
//      a generous free grant (1 million executions / 400 000 GB-s per month).
//   3. Function App      — Node.js 20 LTS runtime; CORS configured to allow
//      requests from the Static Web App origin.

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

@description('Default hostname of the Static Web App (used for CORS).')
param staticWebAppHostname string

// ── Storage Account (required by Functions runtime) ──────────────────────────

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stwardrobefn${environmentName}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// ── App Service Plan (Consumption / Dynamic) ─────────────────────────────────

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

// ── Function App ─────────────────────────────────────────────────────────────

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'functionapp'
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          'https://${staticWebAppHostname}'
          'http://localhost:5173' // Vite dev server for local development
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: 'func-wardrobe-${environmentName}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Function App.')
output functionAppName string = functionApp.name

@description('Default hostname of the Function App.')
output functionAppHostname string = functionApp.properties.defaultHostName
