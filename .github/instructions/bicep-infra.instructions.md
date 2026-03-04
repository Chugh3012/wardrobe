---
description: 'Bicep IaC best practices for Azure infrastructure'
applyTo: '**/*.bicep, **/*.bicepparam'
---

# Bicep Infrastructure Conventions

## Naming

- Use `lowerCamelCase` for all names (variables, parameters, resources).
- Use resource-type descriptive symbolic names: `storageAccount` not `storageAccountName`.
- Avoid 'name' in symbolic names — they represent the resource, not its name.

## Structure

- Declare parameters at the top of files with `@description` decorators.
- Use latest stable API versions for all resources.
- Set default values that are safe for test environments (low-cost tiers).
- Use `@allowed` decorator sparingly to avoid blocking valid deployments.

## Resource References

- Use symbolic names for references: `storageAccount.id` instead of `reference()` or `resourceId()`.
- Use `existing` keyword to reference resources instead of passing values through outputs.
- Let dependencies be inferred through symbolic references — avoid explicit `dependsOn`.

## Security (always follow)

- **Never** include secrets or keys in outputs.
- Use Managed Identity for all service-to-service auth.
- Set `disableLocalAuth: true` on Cosmos DB.
- Set `allowBlobPublicAccess: false` on storage accounts.
- Set `httpsOnly: true`, `ftpsState: 'Disabled'`, `minTlsVersion: '1.2'` on function apps.
- Use Key Vault references for secret app settings: `@Microsoft.KeyVault(SecretUri=...)`.
- Set `enableRbacAuthorization: true` on Key Vault — no access policies.

## Project-Specific Resources

| Resource | Key Security Config |
|----------|-------------------|
| Function App | System MI, EasyAuth v2 (AAD only), HTTPS-only, identity-based storage |
| Cosmos DB | `disableLocalAuth: true`, `/userId` partition key, `Cosmos DB Built-in Data Contributor` role |
| Key Vault | RBAC-only, soft delete + purge protection, `Key Vault Secrets User` role |
| Blob Storage | No public access, HTTPS-only, TLS 1.2+, User Delegation SAS |
| Budget | Alert at $5/month (80%, 100%, 120%) |

## Documentation

- Include `// comments` within Bicep files for readability.
- Use `@description` on all parameters.
