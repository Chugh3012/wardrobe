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

@description('Key Vault name for constructing Key Vault reference URIs (SEC-P4).')
param keyVaultName string = ''

@description('Custom Vision Training endpoint.')
param cvTrainingEndpoint string = ''

@description('Custom Vision Prediction endpoint.')
param cvPredictionEndpoint string = ''

@description('AI Vision endpoint for image embeddings.')
param aiVisionEndpoint string = ''

@description('Include http://localhost:5173 CORS origin (dev only, S11).')
param includeCorsLocalhost bool = false

@description('Application Insights connection string (Issue #14).')
param appInsightsConnectionString string = ''

@description('Azure AD tenant ID for EasyAuth token validation.')
param aadTenantId string = ''

@description('Azure AD client (application) ID for EasyAuth.')
param aadClientId string = ''

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
      // ── CORS (SEC-P1) ────────────────────────────────────────────────────────
      // Allow requests from the SWA frontend origin. supportCredentials must be
      // true for MSAL to send Authorization headers cross-origin.
      cors: {
        allowedOrigins: union(
          [ 'https://${staticWebAppHostname}' ],
          includeCorsLocalhost ? [ 'http://localhost:5173' ] : []
        )
        supportCredentials: true
      }
      appSettings: [
        // Identity-based connection — no storage account keys in app settings (S13).
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccount.name
        }
        // Consumption plan requires a connection string for the content file share.
        // Identity-based content share auth is not supported on Consumption (Y1) plans.
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
        // ── AI service API keys via Key Vault references (SEC-P4) ─────────────
        // The Function App MI has "Key Vault Secrets User" role (key-vault-rbac.bicep).
        // Secrets must be populated manually:
        //   az keyvault secret set --vault-name <vaultName> --name CustomVisionTrainingKey --value <key>
        //   az keyvault secret set --vault-name <vaultName> --name CustomVisionPredictionKey --value <key>
        //   az keyvault secret set --vault-name <vaultName> --name AIVisionKey --value <key>
        {
          name: 'CUSTOM_VISION_TRAINING_KEY'
          value: !empty(keyVaultName) ? '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/CustomVisionTrainingKey)' : ''
        }
        {
          name: 'CUSTOM_VISION_PREDICTION_KEY'
          value: !empty(keyVaultName) ? '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/CustomVisionPredictionKey)' : ''
        }
        {
          name: 'AI_VISION_KEY'
          value: !empty(keyVaultName) ? '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/AIVisionKey)' : ''
        }
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
        // ── Observability (Issue #14) ───────────────────────────────────────────
        // Application Insights connection string enables automatic request
        // tracing, dependency tracking, and custom telemetry via the
        // Node.js Application Insights SDK.
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
  }
}

// ── RBAC: Function App MI → Functions runtime storage account (S13) ──────────
// Identity-based AzureWebJobsStorage requires these roles on the runtime
// storage account so the Functions host can manage triggers, state, and the
// Consumption-plan content file share without embedded account keys.

var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageAccountContributorRoleId = '17d1049b-9a84-46fb-8f53-869881c3d3ab'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'

resource blobDataOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageBlobDataOwnerRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageBlobDataOwnerRoleId
    )
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageAccountContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageAccountContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageAccountContributorRoleId
    )
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource queueDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageQueueDataContributorRoleId
    )
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── EasyAuth v2 (Azure AD token validation) ──────────────────────────────────
// Protects all /api/* endpoints by requiring a valid Azure AD Bearer token.
// The frontend acquires tokens via MSAL and sends them in the Authorization
// header.  EasyAuth validates the token signature, audience, and issuer
// before the request reaches the Function handler.  This replaces the
// SWA-managed-function auth flow that relied on x-ms-client-principal.

resource authSettingsV2 'Microsoft.Web/sites/config@2023-12-01' = if (!empty(aadTenantId) && !empty(aadClientId)) {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: aadClientId
          openIdIssuer: 'https://login.microsoftonline.com/${aadTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${aadClientId}'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
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
