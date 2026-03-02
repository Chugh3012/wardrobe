// Provisions Azure AI Services resources for garment classification.
//
// Resources created:
//   1. Cognitive Services account (kind: CustomVision.Training)
//   2. Cognitive Services account (kind: CustomVision.Prediction)
//   3. Cognitive Services account (kind: ComputerVision) — for image embeddings
//
// API keys should be stored in Key Vault. The Function App accesses them via
// Key Vault references in App Settings.
//
// NOTE (S10): publicNetworkAccess is set to 'Disabled' on all three accounts.
// The Function App must reach these services via Private Endpoints or VNet
// integration. Configure the Function App with VNet integration and create
// private endpoints for each Cognitive Services account to allow access.

targetScope = 'resourceGroup'

@description('Azure region for the AI resources.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

// ── Custom Vision — Training ─────────────────────────────────────────────────

resource cvTraining 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'cv-train-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'CustomVision.Training'
  sku: {
    name: 'F0' // Free tier
  }
  properties: {
    customSubDomainName: 'cv-train-wardrobe-${environmentName}'
    publicNetworkAccess: 'Disabled'
    restore: true
  }
}

// ── Custom Vision — Prediction ───────────────────────────────────────────────

resource cvPrediction 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'cv-pred-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'CustomVision.Prediction'
  sku: {
    name: 'F0' // Free tier
  }
  properties: {
    customSubDomainName: 'cv-pred-wardrobe-${environmentName}'
    publicNetworkAccess: 'Disabled'
    restore: true
  }
}

// ── Computer Vision (AI Vision 4.0 — image embeddings) ───────────────────────

resource computerVision 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'cv-vision-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'ComputerVision'
  sku: {
    name: 'F0' // Free tier
  }
  properties: {
    customSubDomainName: 'cv-vision-wardrobe-${environmentName}'
    publicNetworkAccess: 'Disabled'
    restore: true
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Custom Vision Training endpoint.')
output cvTrainingEndpoint string = cvTraining.properties.endpoint

@description('Custom Vision Prediction endpoint.')
output cvPredictionEndpoint string = cvPrediction.properties.endpoint

@description('Computer Vision (AI Vision) endpoint for image embeddings.')
output aiVisionEndpoint string = computerVision.properties.endpoint

@description('Custom Vision Training account name.')
output cvTrainingAccountName string = cvTraining.name

@description('Custom Vision Prediction account name.')
output cvPredictionAccountName string = cvPrediction.name

@description('Computer Vision account name.')
output aiVisionAccountName string = computerVision.name
