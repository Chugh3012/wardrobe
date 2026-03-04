/**
 * MSAL (Microsoft Authentication Library) configuration.
 *
 * The frontend acquires AAD tokens via MSAL and sends them as Bearer
 * tokens to the standalone Azure Function App, which validates them
 * via EasyAuth v2.
 *
 * Environment variables (Vite):
 *   VITE_AAD_CLIENT_ID   – AAD app-registration client ID
 *   VITE_AAD_TENANT_ID   – AAD tenant ID
 *   VITE_API_BASE_URL    – Function App base URL (e.g. https://func-wardrobe-dev.azurewebsites.net)
 */

import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

/**
 * AAD Client ID and Tenant ID MUST be provided via environment variables.
 * No hardcoded fallbacks — prevents accidental exposure of real IDs in source.
 * In local dev with VITE_SKIP_AUTH=true, these are not used at all.
 */
const clientId = import.meta.env.VITE_AAD_CLIENT_ID ?? '';
const tenantId = import.meta.env.VITE_AAD_TENANT_ID ?? '';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

/** Scopes required when calling the backend Function App API. */
export const apiScopes = [`api://${clientId}/access_as_user`];

/** Base URL for the backend Function App. Empty string = same origin (Vite proxy). */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

/** Singleton MSAL instance — initialised once, used everywhere. */
export const msalInstance = new PublicClientApplication(msalConfig);
