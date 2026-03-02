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
| RBAC scope | `Owner` scoped to `rg-wardrobe-<env>` only (needed for RBAC assignments) |
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

# ── First run: subscription-wide Owner ────────────────────────────────────
# The FIRST deployment needs subscription-scope Owner because it creates
# the resource group itself.  "Owner" (not just "Contributor") is required
# because the Bicep templates create RBAC role assignments.
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Owner \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

### 3a. Downscope to resource-group Owner after first deployment (SEC-P2)

After the first successful run the resource group exists. **Immediately** downscope
the role assignment to the resource group for least-privilege:

```bash
RG_NAME="rg-wardrobe-dev"

# 1. Grant Owner scoped to the resource group only
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Owner \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG_NAME"

# 2. Remove the broad subscription-scope Owner assignment
az role assignment delete \
  --assignee "$SP_OBJECT_ID" \
  --role Owner \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# 3. Verify only the RG-scoped assignment remains
az role assignment list \
  --assignee "$SP_OBJECT_ID" \
  --output table
```

> **Important:** The `provision-infra.yml` workflow uses a subscription-scoped
> deployment (`az deployment sub create`) with `--location`. This still works
> with RG-scoped Owner because the resource group already exists and the
> deployment merely updates resources inside it. If you ever need to
> **recreate** the resource group from scratch, temporarily re-grant
> subscription-scope Owner.

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

### 6. Configure SWA EasyAuth — Entra ID user authentication (Issue #13.7)

This creates a **separate** Entra app from the CI SP above. This app handles
end-user sign-in via SWA EasyAuth (Azure AD provider).

```bash
# 1. Create the app registration (single-tenant, SWA callback redirect)
SWA_HOSTNAME=$(az staticwebapp show -n swa-wardrobe-dev -g rg-wardrobe-dev --query defaultHostname -o tsv)

az ad app create \
  --display-name "wardrobe-swa-auth" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://$SWA_HOSTNAME/.auth/login/aad/callback"

SWA_AUTH_APP_ID=$(az ad app list --display-name "wardrobe-swa-auth" --query "[0].appId" -o tsv)
SWA_AUTH_OBJECT_ID=$(az ad app list --display-name "wardrobe-swa-auth" --query "[0].id" -o tsv)

# 2. Enable id_token implicit grant (required by SWA EasyAuth)
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$SWA_AUTH_OBJECT_ID" \
  --headers "Content-Type=application/json" \
  --body '{"web":{"implicitGrantSettings":{"enableIdTokenIssuance":true,"enableAccessTokenIssuance":false}}}'

# 3. Set the AAD_CLIENT_ID app setting on SWA
az staticwebapp appsettings set \
  -n swa-wardrobe-dev -g rg-wardrobe-dev \
  --setting-names "AAD_CLIENT_ID=$SWA_AUTH_APP_ID"

# 4. Update frontend/public/staticwebapp.config.json:
#    Replace {TENANT_ID} with your real tenant ID in the openIdIssuer URL.
#    The clientIdSettingName "AAD_CLIENT_ID" references the app setting above.
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Replace {TENANT_ID} in staticwebapp.config.json with: $TENANT_ID"
```

> **Note:** Only users in your Entra tenant can sign in (single-tenant). To
> invite external users, add them as guests: `az ad invitation create --invited-user-email-address <email>`.

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

## Post-deployment: populate Key Vault secrets (SEC-P4)

The Function App references three AI service keys via `@Microsoft.KeyVault(SecretUri=...)`.
After initial deployment, populate these secrets manually:

```bash
KV_NAME="kv-wardrobe-dev"   # adjust to match your environment

# Custom Vision Training key
az keyvault secret set --vault-name "$KV_NAME" \
  --name "custom-vision-training-key" \
  --value "$(az cognitiveservices account keys list -n cv-wardrobe-training-dev -g rg-wardrobe-dev --query key1 -o tsv)"

# Custom Vision Prediction key
az keyvault secret set --vault-name "$KV_NAME" \
  --name "custom-vision-prediction-key" \
  --value "$(az cognitiveservices account keys list -n cv-wardrobe-prediction-dev -g rg-wardrobe-dev --query key1 -o tsv)"

# AI Vision (Computer Vision) key
az keyvault secret set --vault-name "$KV_NAME" \
  --name "ai-vision-key" \
  --value "$(az cognitiveservices account keys list -n cv-wardrobe-dev -g rg-wardrobe-dev --query key1 -o tsv)"
```

> The Function App MI already has the **Key Vault Secrets User** role (assigned in `key-vault-rbac.bicep`),
> so it can read these secrets at runtime without additional configuration.

---

## Directory structure

```
infra/
├── main.bicep              # Subscription-scoped entry point
├── main.bicepparam         # Non-secret parameter values
├── README.md               # This file
└── modules/
    ├── static-web-app.bicep    # Issue #1  — Azure Static Web App (Free SKU)
    ├── functions.bicep         # Issue #2  — Azure Functions API (Consumption plan)
    ├── blob-storage.bicep      # Issue #3  — Blob Storage for images
    ├── cosmos-db.bicep         # Issue #4  — Cosmos DB NoSQL (serverless)
    ├── cosmos-db-rbac.bicep    # Issue #4  — Cosmos DB RBAC role assignments
    ├── ai-services.bicep       # Issue #10 — Cognitive Services (Custom Vision + AI Vision)
    ├── key-vault.bicep         # Issue #13 — Key Vault (RBAC, soft-delete, purge protection)
    ├── key-vault-rbac.bicep    # Issue #13 — Key Vault RBAC role assignments
    └── budget.bicep            # Issue #13.6 — Monthly budget alert ($5, 3 tiers)
```
