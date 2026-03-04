// Provisions an Azure Key Vault for storing secrets used by the backend
// (Custom Vision API keys, AI Vision API keys, etc.).
//
// Secrets are auto-populated by key-vault-secrets.bicep using listKeys()
// from the Cognitive Services accounts. The Function App accesses secrets
// through Key Vault references in App Settings, authenticated by its
// System-assigned Managed Identity.
//
// ── Secret Rotation Schedule (S14) ──────────────────────────────────────────
// AI service API keys stored in this vault MUST be rotated on a regular
// cadence.  Because Cognitive Services keys are regenerated through the
// Azure control-plane (not Key Vault auto-rotate), rotation is manual:
//
//   Frequency : every 90 days (quarterly)
//   Procedure :
//     1. az cognitiveservices account keys regenerate \
//          --name <accountName> --resource-group <rg> --key-name key2
//     2. Update the Key Vault secret with the new key2 value:
//        az keyvault secret set --vault-name <vaultName> \
//          --name <secretName> --value <newKey2Value>
//     3. Wait for Function App Key Vault reference cache to refresh (~24 h)
//        or restart the Function App to pick up the new secret immediately.
//     4. Regenerate key1 (the previously active key) so it is invalidated:
//        az cognitiveservices account keys regenerate \
//          --name <accountName> --resource-group <rg> --key-name key1
//
//   Secrets to rotate:
//     • CustomVisionTrainingKey
//     • CustomVisionPredictionKey
//     • AIVisionKey
//
//   Owner   : platform / DevOps team
//   Tracking: set secret expiry (--expires) so Azure Policy / Defender for
//             Cloud alerts when a secret is about to expire.
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
    enablePurgeProtection: true
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Key Vault.')
output keyVaultName string = keyVault.name

@description('URI of the Key Vault (used for Key Vault references in App Settings).')
output keyVaultUri string = keyVault.properties.vaultUri
