// Provisions the observability stack: Log Analytics Workspace + Application Insights.
//
// Resources created:
//   1. Log Analytics Workspace — centralized log aggregation for advanced KQL queries.
//   2. Application Insights     — workspace-based; connected to the Log Analytics workspace
//      for request tracing, custom metrics, and error diagnostics.
//
// Sampling is configured via the backend host.json; this module provisions the
// resources and outputs the connection string for the Function App.

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

// ── Log Analytics Workspace ──────────────────────────────────────────────────

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-wardrobe-${environmentName}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    // Consumption plan apps generate minimal data — 30-day retention + low
    // daily cap keeps costs near-zero for personal/dev usage.
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

// ── Application Insights (workspace-based) ───────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-wardrobe-${environmentName}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    // Adaptive sampling is configured server-side in host.json.
    // Ingestion sampling at the resource level is left at default (100%)
    // to avoid double-sampling with the SDK-side configuration.
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 30
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Application Insights connection string for the Function App.')
output appInsightsConnectionString string = appInsights.properties.ConnectionString

@description('Name of the Application Insights resource.')
output appInsightsName string = appInsights.name

@description('Name of the Log Analytics Workspace.')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
