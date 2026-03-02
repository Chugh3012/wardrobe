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

@description('Name of the Blob Storage account used for garment/outfit images.')
param blobStorageAccountName string

@description('Name of the blob container used for images.')
param blobContainerName string

@description('Cosmos DB account endpoint URI.')
param cosmosDbEndpoint string

@description('Name of the Cosmos DB SQL database.')
param cosmosDbDatabaseName string

@description('Key Vault URI for secret references.')
param keyVaultUri string = ''

@description('Custom Vision Training endpoint.')
param cvTrainingEndpoint string = ''

@description('Custom Vision Prediction endpoint.')
param cvPredictionEndpoint string = ''

@description('AI Vision endpoint for image embeddings.')
param aiVisionEndpoint string = ''

@description('Include http://localhost:5173 CORS origin (dev only, S11).')
param includeCorsLocalhost bool = false

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
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: union(
          [ 'https://${staticWebAppHostname}' ],
          includeCorsLocalhost ? [ 'http://localhost:5173' ] : []
        )
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
        {
          name: 'BLOB_ACCOUNT_NAME'
          value: blobStorageAccountName
        }
        {
          name: 'BLOB_CONTAINER_NAME'
          value: blobContainerName
        }
        {
          name: 'COSMOS_DB_ENDPOINT'
          value: cosmosDbEndpoint
        }
        {
          name: 'COSMOS_DB_DATABASE_NAME'
          value: cosmosDbDatabaseName
        }
        // ── AI / ML service endpoints (non-secret; keys are stored in Key Vault) ──
        {
          name: 'CUSTOM_VISION_TRAINING_ENDPOINT'
          value: cvTrainingEndpoint
        }
        {
          name: 'CUSTOM_VISION_PREDICTION_ENDPOINT'
          value: cvPredictionEndpoint
        }
        {
          name: 'AI_VISION_ENDPOINT'
          value: aiVisionEndpoint
        }
        // API keys are stored as Key Vault references. Populate the secrets
        // in Key Vault via: az keyvault secret set --vault-name <vaultName> --name <secretName> --value <secretValue>
        // Then set these app settings to: @Microsoft.KeyVault(SecretUri=<secretUri>)
        // Example: @Microsoft.KeyVault(SecretUri=https://kv-wardrobe-dev.vault.azure.net/secrets/CustomVisionTrainingKey)
        {
          name: 'KEY_VAULT_URI'
          value: keyVaultUri
        }
        // ── Auth enforcement (S4 / S5) ──────────────────────────────────────────
        // Ensures the x-ms-client-principal-id header is always required,
        // even when the Function App is accessed directly (bypassing SWA).
        {
          name: 'REQUIRE_AUTH'
          value: 'true'
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

@description('Principal ID of the Function App System-assigned Managed Identity.')
output functionAppPrincipalId string = functionApp.identity.principalId
