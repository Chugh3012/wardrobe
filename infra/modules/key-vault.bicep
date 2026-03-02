// Provisions an Azure Key Vault for storing secrets used by the backend
// (Custom Vision API keys, AI Vision API keys, etc.).
//
// Secrets are managed via the Azure Portal or `az keyvault secret set`.
// The Function App accesses secrets through Key Vault references in App
// Settings, authenticated by its System-assigned Managed Identity.
//
// NOTE: The RBAC role assignment for the Function App MI is created in a
// separate module (key-vault-rbac.bicep) to avoid circular dependencies.

targetScope = 'resourceGroup'

@description('Azure region for the Key Vault resource.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

// ── Key Vault ────────────────────────────────────────────────────────────────

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-wardrobe-${environmentName}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Key Vault.')
output keyVaultName string = keyVault.name

@description('URI of the Key Vault (used for Key Vault references in App Settings).')
output keyVaultUri string = keyVault.properties.vaultUri
