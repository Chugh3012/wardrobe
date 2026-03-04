// Populates Key Vault secrets with AI service API keys.
//
// This module reads API keys from the Cognitive Services accounts using
// listKeys() and stores them as secrets in Key Vault. This eliminates the
// need for manual secret population after infrastructure provisioning.
//
// The Function App references these secrets via @Microsoft.KeyVault(SecretUri=...)
// app settings (see functions.bicep). The MI has "Key Vault Secrets User" role
// (key-vault-rbac.bicep) for runtime read access.
//
// ── Secret Expiry & Rotation (SEC-P14) ──────────────────────────────────────
// Each secret is created with a 90-day expiry. Azure Policy / Defender for
// Cloud will alert when secrets approach expiration. See key-vault.bicep for
// the full rotation procedure.

targetScope = 'resourceGroup'

@description('Name of the Key Vault to populate secrets into.')
param keyVaultName string

@description('Name of the Custom Vision Training Cognitive Services account.')
param cvTrainingAccountName string

@description('Name of the Custom Vision Prediction Cognitive Services account.')
param cvPredictionAccountName string

@description('Name of the Computer Vision (AI Vision) Cognitive Services account.')
param aiVisionAccountName string

@description('Current UTC time (used to calculate 90-day secret expiry). Do not override.')
param currentTime string = utcNow()

// ── Existing resource references ─────────────────────────────────────────────

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource cvTraining 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: cvTrainingAccountName
}

resource cvPrediction 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: cvPredictionAccountName
}

resource computerVision 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: aiVisionAccountName
}

// ── 90-day expiry for rotation tracking ──────────────────────────────────────
// dateTimeAdd is evaluated at deployment time; each re-deployment refreshes
// the expiry window, which is the desired behaviour for rotation tracking.

var secretExpiry = dateTimeAdd(currentTime, 'P90D')

// ── Key Vault Secrets ────────────────────────────────────────────────────────

resource cvTrainingSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CustomVisionTrainingKey'
  properties: {
    value: cvTraining.listKeys().key1
    attributes: {
      enabled: true
      exp: dateTimeToEpoch(secretExpiry)
    }
    contentType: 'Cognitive Services API key — Custom Vision Training'
  }
}

resource cvPredictionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CustomVisionPredictionKey'
  properties: {
    value: cvPrediction.listKeys().key1
    attributes: {
      enabled: true
      exp: dateTimeToEpoch(secretExpiry)
    }
    contentType: 'Cognitive Services API key — Custom Vision Prediction'
  }
}

resource aiVisionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AIVisionKey'
  properties: {
    value: computerVision.listKeys().key1
    attributes: {
      enabled: true
      exp: dateTimeToEpoch(secretExpiry)
    }
    contentType: 'Cognitive Services API key — Computer Vision (AI Vision)'
  }
}
