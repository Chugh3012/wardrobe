// Parameter values for main.bicep.
// NO secrets belong here. All sensitive values (connection strings, API keys)
// must be stored in Azure Key Vault and referenced via getSecret() in modules.

using 'main.bicep'

param location = 'eastus'
param environmentName = 'dev'
param tags = {
  project: 'wardrobe'
  environment: 'dev'
  managedBy: 'bicep'
}
