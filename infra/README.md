# Infrastructure — One-Time Setup Guide

This directory contains Bicep templates that provision all Azure resources for the Wardrobe Tracker.
The GitHub Actions workflow `provision-infra.yml` runs these templates automatically on push to `main`
(when `infra/**` files change) or manually via `workflow_dispatch`.

---

## Security model

| Concern | Approach |
|---|---|
| GitHub → Azure auth | **OIDC Workload Identity Federation** — no long-lived client secret ever stored |
| Service-to-service auth | Managed Identity (added per-resource as issues #2–#13 are implemented) |
| Secrets at runtime | Azure Key Vault — referenced via `getSecret()` in Bicep modules |
| RBAC scope | `Owner` on `rg-wardrobe-<env>` (needed for RBAC assignments); downscope after initial setup |
| Bicep parameter files | Zero secrets — only non-sensitive configuration values |

---

## One-time setup (do this once before the first workflow run)

### 1. Create the Entra app registration

```bash
# Create a service principal for GitHub Actions CI
az ad app create --display-name "wardrobe-github-actions"

# Note the appId (client ID) from the output
APP_ID=$(az ad app list --display-name "wardrobe-github-actions" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"
```

### 2. Add a federated credential (OIDC — no secret needed)

```bash
# Allow the main branch to authenticate
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "wardrobe-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:Chugh3012/wardrobe:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Also allow workflow_dispatch from any branch (optional but recommended for manual runs)
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "wardrobe-dispatch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:Chugh3012/wardrobe:workflow_dispatch",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### 3. Grant the minimum RBAC roles

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

# Owner on the subscription is needed for the first run only
# (to create the resource group). After the resource group exists you can
# downscope this to Owner on rg-wardrobe-dev only.
#
# NOTE: "Owner" (not just "Contributor") is required because the Bicep
# templates create RBAC role assignments (e.g. granting the Function App
# Managed Identity access to Blob Storage and Cosmos DB). The
# Microsoft.Authorization/roleAssignments/write permission is only
# available to Owner or User Access Administrator roles.
#
# Alternative least-privilege approach: assign Contributor + User Access
# Administrator on the resource group instead of Owner.
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Owner \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

> **Tip:** After the first successful run the resource group exists. Downscope the role
> assignment to `/subscriptions/<id>/resourceGroups/rg-wardrobe-dev` for least privilege.

### 4. Store the three non-secret identifiers as GitHub Actions secrets

```bash
# These are identifiers, not secrets, but stored in GitHub secrets for flexibility.
gh secret set AZURE_CLIENT_ID       --repo Chugh3012/wardrobe --body "$APP_ID"
gh secret set AZURE_TENANT_ID       --repo Chugh3012/wardrobe --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --repo Chugh3012/wardrobe --body "$SUBSCRIPTION_ID"
```

### 5. Store a GitHub fine-grained PAT for secret sync

The workflow writes the SWA deployment token back to GitHub secrets automatically.
This requires a PAT with `secrets: write` on this repository.

```bash
# Create a fine-grained PAT at https://github.com/settings/tokens
# Scopes needed: Repository → Secrets (read & write)
gh secret set ACTIONS_TOKEN --repo Chugh3012/wardrobe --body "<your-pat>"
```

---

## Running the workflow

**Manual (recommended for first run):**

```bash
gh workflow run provision-infra.yml --field environment=dev
```

**Automatic:** Push any change to a file under `infra/` on the `main` branch.

---

## Adding new resources

Each subsequent issue (#2 Functions, #3 Blob, #4 Cosmos DB, …) adds a new module under
`infra/modules/`. The pattern is:

1. Create `infra/modules/<resource>.bicep` scoped to `resourceGroup`.
2. Add a `module` block in `main.bicep` referencing it.
3. All sensitive outputs (connection strings, keys) must **not** be in Bicep outputs —
   store them directly in Key Vault inside the module using a `Microsoft.KeyVault/vaults/secrets`
   resource, or read them post-deploy via `az` CLI.

---

## Directory structure

```
infra/
├── main.bicep          # Subscription-scoped entry point
├── main.bicepparam     # Non-secret parameter values
├── README.md           # This file
└── modules/
    ├── static-web-app.bicep   # Issue #1 — Azure Static Web App (Free SKU)
    ├── functions.bicep        # Issue #2 — Azure Functions API (Consumption plan)
    ├── blob-storage.bicep     # Issue #3 — Blob Storage for images
    ├── cosmos-db.bicep        # Issue #4 — Cosmos DB NoSQL (serverless)
    # future modules added per issue:
    # └── key-vault.bicep       # Issue #13
    # └── app-insights.bicep    # Issue #14
```
