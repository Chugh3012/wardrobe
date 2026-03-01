// Provisions the Azure Blob Storage account for garment and outfit images.
//
// Resources created:
//   1. Storage Account  — dedicated image store (separate from the Functions
//      runtime storage), private access only.
//   2. Blob container   — "images", no anonymous public read.
//   3. Lifecycle policy — move to cool tier after 90 days, archive after 365.
//   4. RBAC assignments — Function App Managed Identity receives:
//        • Storage Blob Data Contributor  (upload / read / delete blobs)
//        • Storage Blob Delegator         (generate user-delegation SAS tokens)

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Resource tags.')
param tags object

@description('Name of the storage account to create.')
param storageAccountName string

@description('Name of the blob container to create.')
param containerName string

@description('Object (principal) ID of the Function App Managed Identity.')
param functionAppPrincipalId string

// ── Storage Account ───────────────────────────────────────────────────────────

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
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

// ── Blob Service ──────────────────────────────────────────────────────────────

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// ── Images Container (private) ────────────────────────────────────────────────

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

// ── Lifecycle Management ──────────────────────────────────────────────────────

resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'images-tiering'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 90
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }
      ]
    }
  }
}

// ── RBAC: Storage Blob Data Contributor ──────────────────────────────────────
// Allows the Function App MI to upload, read, and delete blobs.

var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource blobDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageBlobDataContributorRoleId
    )
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ── RBAC: Storage Blob Delegator ──────────────────────────────────────────────
// Allows the Function App MI to generate user-delegation SAS tokens.

var storageBlobDelegatorRoleId = 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'

resource blobDelegatorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppPrincipalId, storageBlobDelegatorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageBlobDelegatorRoleId
    )
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned image storage account.')
output storageAccountName string = storageAccount.name

@description('Name of the blob container for images.')
output containerName string = imagesContainer.name
