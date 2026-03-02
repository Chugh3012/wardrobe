// Provisions the Azure Cosmos DB (NoSQL, provisioned free tier) account for the
// Wardrobe Tracker data layer.
//
// Resources created:
//   1. Cosmos DB Account   — NoSQL API, provisioned throughput, free tier
//                            (1,000 RU/s + 25 GB storage at no cost).
//   2. SQL Database        — "wardrobe" (shared 1,000 RU/s throughput)
//   3. SQL Containers      — "garments", "wearEvents", "predictionAudits"
//                            (all partitioned by /userId, share database RU/s).
//
// NOTE: The Cosmos DB data-plane RBAC assignment for the Function App Managed
// Identity is created via a separate module (cosmos-db-rbac.bicep) to avoid a
// circular dependency between the Functions and Cosmos DB modules.

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

// ── Cosmos DB Account (Provisioned Free Tier) ────────────────────────────────

var accountName = 'cosmos-wardrobe-${environmentName}'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    enableFreeTier: true
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    disableLocalAuth: true
  }
}

// ── SQL Database ─────────────────────────────────────────────────────────────

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'wardrobe'
  properties: {
    resource: {
      id: 'wardrobe'
    }
    options: {
      throughput: 1000
    }
  }
}

// ── Containers ───────────────────────────────────────────────────────────────

resource garmentsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'garments'
  properties: {
    resource: {
      id: 'garments'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
    }
  }
}

resource wearEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'wearEvents'
  properties: {
    resource: {
      id: 'wearEvents'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
    }
  }
}

resource predictionAuditsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'predictionAudits'
  properties: {
    resource: {
      id: 'predictionAudits'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Cosmos DB account.')
output cosmosAccountName string = cosmosAccount.name

@description('Cosmos DB account endpoint URI.')
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Name of the SQL database.')
output databaseName string = database.name
