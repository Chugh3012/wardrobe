// Provisions the Azure Cosmos DB (NoSQL, serverless) account for the Wardrobe
// Tracker data layer.
//
// Resources created:
//   1. Cosmos DB Account   — NoSQL API, serverless capacity mode.
//   2. SQL Database        — "wardrobe"
//   3. SQL Containers      — "garments", "wearEvents", "predictionAudits"
//                            (all partitioned by /userId).
//   4. SQL Role Assignment — Function App Managed Identity receives the
//                            built-in "Cosmos DB Built-in Data Contributor"
//                            role for data-plane CRUD.

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Short environment name used in resource names.')
param environmentName string

@description('Resource tags.')
param tags object

@description('Object (principal) ID of the Function App Managed Identity.')
param functionAppPrincipalId string

// ── Cosmos DB Account (Serverless) ───────────────────────────────────────────

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
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    disableLocalAuth: false
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

// ── Cosmos DB Data-Plane RBAC ────────────────────────────────────────────────
// The built-in "Cosmos DB Built-in Data Contributor" role allows full
// data-plane CRUD (create, read, update, delete items & execute queries).
// Role ID: 00000000-0000-0000-0000-000000000002

resource dataContributorRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, functionAppPrincipalId, '00000000-0000-0000-0000-000000000002')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: functionAppPrincipalId
    scope: cosmosAccount.id
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

@description('Name of the provisioned Cosmos DB account.')
output cosmosAccountName string = cosmosAccount.name

@description('Cosmos DB account endpoint URI.')
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Name of the SQL database.')
output databaseName string = database.name
