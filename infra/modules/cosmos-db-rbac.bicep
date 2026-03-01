// Assigns the Cosmos DB "Built-in Data Contributor" role to the Function App
// Managed Identity. This is separated from cosmos-db.bicep so that the Cosmos
// DB account can be deployed before the Functions app (breaking the circular
// dependency between the two modules).
//
// The built-in "Cosmos DB Built-in Data Contributor" role allows full
// data-plane CRUD (create, read, update, delete items & execute queries).
// Role ID: 00000000-0000-0000-0000-000000000002

targetScope = 'resourceGroup'

@description('Name of the existing Cosmos DB account.')
param cosmosAccountName string

@description('Object (principal) ID of the Function App Managed Identity.')
param functionAppPrincipalId string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource dataContributorRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, functionAppPrincipalId, '00000000-0000-0000-0000-000000000002')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: functionAppPrincipalId
    scope: cosmosAccount.id
  }
}
