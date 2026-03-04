// Parameter values for main.bicep.
// NO secrets belong here. All sensitive values (connection strings, API keys)
// must be stored in Azure Key Vault and referenced via getSecret() in modules.

using 'main.bicep'

param location = 'westeurope'
param cosmosDbLocation = 'northeurope'
param environmentName = 'dev'
param tags = {
  project: 'wardrobe'
  environment: 'dev'
  managedBy: 'bicep'
}
param budgetAlertEmails = ['saurabh.chugh3012@gmail.com']

// EasyAuth identity — each environment must declare its own AAD tenant and
// client IDs. These are not secrets but are environment-specific, so they
// belong here rather than as default values in main.bicep.
param aadTenantId = '9a40715f-4db6-4dcd-8973-68db2b112fd8'
param aadClientId = '51fbad72-f951-47c6-b1be-bf5f6c01c476'
