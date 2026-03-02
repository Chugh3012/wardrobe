// Subscription-scoped deployment.
// Creates the shared resource group and delegates to resource modules.
// Deploy with:
//   az deployment sub create \
//     --location <location> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam

targetScope = 'subscription'

@description('Azure region for all resources.')
param location string = 'northeurope'

@description('Short environment name used in resource names (e.g. dev, prod).')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Resource tags applied to every resource.')
param tags object = {
  project: 'wardrobe'
  environment: environmentName
  managedBy: 'bicep'
}

// ── Resource group ───────────────────────────────────────────────────────────

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-wardrobe-${environmentName}'
  location: location
  tags: tags
}

// ── Static Web App ───────────────────────────────────────────────────────────

module swa 'modules/static-web-app.bicep' = {
  name: 'swa-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}

// ── Cosmos DB ─────────────────────────────────────────────────────────────────

module cosmosDb 'modules/cosmos-db.bicep' = {
  name: 'cosmos-db-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}

// ── Key Vault (no RBAC here — see key-vault-rbac below) ──────────────────────

module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}

// ── AI Services (Custom Vision + Computer Vision) ────────────────────────────

module aiServices 'modules/ai-services.bicep' = {
  name: 'ai-services-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}

// ── Azure Functions Backend API ───────────────────────────────────────────────

var blobStorageAccountName = 'stwardrobeimg${environmentName}'
var blobContainerName = 'images'

module functions 'modules/functions.bicep' = {
  name: 'functions-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
    staticWebAppHostname: swa.outputs.defaultHostname
    blobStorageAccountName: blobStorageAccountName
    blobContainerName: blobContainerName
    cosmosDbEndpoint: cosmosDb.outputs.cosmosEndpoint
    cosmosDbDatabaseName: cosmosDb.outputs.databaseName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cvTrainingEndpoint: aiServices.outputs.cvTrainingEndpoint
    cvPredictionEndpoint: aiServices.outputs.cvPredictionEndpoint
    aiVisionEndpoint: aiServices.outputs.aiVisionEndpoint
    includeCorsLocalhost: environmentName == 'dev' // S11: only allow localhost CORS in dev
  }
}

// ── Blob Storage for Images ───────────────────────────────────────────────────

module blobStorage 'modules/blob-storage.bicep' = {
  name: 'blob-storage-${environmentName}'
  scope: rg
  params: {
    location: location
    tags: tags
    storageAccountName: blobStorageAccountName
    containerName: blobContainerName
    functionAppPrincipalId: functions.outputs.functionAppPrincipalId
  }
}

// ── Cosmos DB RBAC (depends on both Cosmos DB and Functions) ──────────────────

module cosmosDbRbac 'modules/cosmos-db-rbac.bicep' = {
  name: 'cosmos-db-rbac-${environmentName}'
  scope: rg
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    functionAppPrincipalId: functions.outputs.functionAppPrincipalId
  }
}

// ── Key Vault RBAC (depends on both Key Vault and Functions) ─────────────────

module keyVaultRbac 'modules/key-vault-rbac.bicep' = {
  name: 'key-vault-rbac-${environmentName}'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    functionAppPrincipalId: functions.outputs.functionAppPrincipalId
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Static Web App resource.')
output staticWebAppName string = swa.outputs.staticWebAppName

@description('Default hostname of the Static Web App.')
output staticWebAppHostname string = swa.outputs.defaultHostname

@description('Name of the provisioned Function App.')
output functionAppName string = functions.outputs.functionAppName

@description('Default hostname of the Function App.')
output functionAppHostname string = functions.outputs.functionAppHostname

@description('Name of the Blob Storage account for images.')
output blobStorageAccountName string = blobStorage.outputs.storageAccountName

@description('Name of the blob container for images.')
output blobContainerName string = blobStorage.outputs.containerName

@description('Name of the Cosmos DB account.')
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName

@description('Cosmos DB account endpoint URI.')
output cosmosEndpoint string = cosmosDb.outputs.cosmosEndpoint

@description('Name of the Key Vault.')
output keyVaultName string = keyVault.outputs.keyVaultName

@description('URI of the Key Vault.')
output keyVaultUri string = keyVault.outputs.keyVaultUri

@description('Custom Vision Training endpoint.')
output cvTrainingEndpoint string = aiServices.outputs.cvTrainingEndpoint

@description('Custom Vision Prediction endpoint.')
output cvPredictionEndpoint string = aiServices.outputs.cvPredictionEndpoint

@description('AI Vision endpoint for image embeddings.')
output aiVisionEndpoint string = aiServices.outputs.aiVisionEndpoint
