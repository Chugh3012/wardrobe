// Grants the Function App Managed Identity the Key Vault Secrets User role
// on the Key Vault created by key-vault.bicep.
//
// Separated into its own module to avoid a circular dependency between
// the Functions and Key Vault modules.

targetScope = 'resourceGroup'

@description('Name of the Key Vault resource.')
param keyVaultName string

@description('Principal ID of the Function App System-assigned Managed Identity.')
param functionAppPrincipalId string

// ── Existing Key Vault reference ─────────────────────────────────────────────

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ── RBAC: Key Vault Secrets User ─────────────────────────────────────────────

// Built-in role: Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6)
resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppPrincipalId, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}
