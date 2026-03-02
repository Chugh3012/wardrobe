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

const clientId = import.meta.env.VITE_AAD_CLIENT_ID ?? '51fbad72-f951-47c6-b1be-bf5f6c01c476';
const tenantId = import.meta.env.VITE_AAD_TENANT_ID ?? '9a40715f-4db6-4dcd-8973-68db2b112fd8';

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

/** Base URL for the backend Function App. */
export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'https://func-wardrobe-dev.azurewebsites.net';

/** Singleton MSAL instance — initialised once, used everywhere. */
export const msalInstance = new PublicClientApplication(msalConfig);
