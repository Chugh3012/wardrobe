// Subscription-scoped deployment.
// Creates the shared resource group and delegates to resource modules.
// Deploy with:
//   az deployment sub create \
//     --location <location> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam

targetScope = 'subscription'

@description('Azure region for all resources.')
param location string = 'westeurope'

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
  }
}

// ── Blob Storage for Images ───────────────────────────────────────────────────

module blobStorage 'modules/blob-storage.bicep' = {
  name: 'blob-storage-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
    storageAccountName: blobStorageAccountName
    containerName: blobContainerName
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
