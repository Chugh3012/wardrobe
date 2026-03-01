// Provisions an Azure Static Web App (Free SKU).
// The deployment token is NOT stored here; it is read at deploy time via
//   az staticwebapp secrets list --name <name> --resource-group <rg>
// and written to the GitHub Actions secret AZURE_STATIC_WEB_APPS_API_TOKEN
// by the provision-infra.yml workflow.

targetScope = 'resourceGroup'

@description('Azure region for the Static Web App.')
param location string

@description('Short environment name used in the resource name.')
param environmentName string

@description('Resource tags.')
param tags object

// ── Static Web App ───────────────────────────────────────────────────────────

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'swa-wardrobe-${environmentName}'
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Deployment source is managed externally by the deploy-frontend.yml workflow.
    // Setting buildProperties to empty disables Azure's own build pipeline.
    buildProperties: {}
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Resource name of the Static Web App.')
output staticWebAppName string = staticWebApp.name

@description('Default hostname assigned by Azure.')
output defaultHostname string = staticWebApp.properties.defaultHostname
