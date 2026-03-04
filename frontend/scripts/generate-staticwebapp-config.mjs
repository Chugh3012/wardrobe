/**
 * Generates dist/staticwebapp.config.json with environment-specific CSP headers.
 *
 * Runs automatically after `vite build` via the `postbuild` npm script.
 * The file in public/staticwebapp.config.json serves as the dev fallback and
 * is overwritten in dist/ by this script with locked-down, env-specific hostnames.
 *
 * Environment variables consumed (all VITE_ prefix so Vite exposes them):
 *   VITE_BLOB_ACCOUNT_NAME — Azure Storage account name (e.g. stwardrobeimgdev)
 *   VITE_API_BASE_URL      — Function App base URL (e.g. https://func-wardrobe-dev.azurewebsites.net)
 *   VITE_AAD_TENANT_ID     — Azure AD tenant ID for EasyAuth openIdIssuer
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

// ── Input validation ──────────────────────────────────────────────────────────

/**
 * Azure Storage account names must be 3-24 lowercase alphanumeric characters.
 * Validate before interpolating into the CSP to prevent header injection.
 */
const STORAGE_ACCOUNT_RE = /^[a-z0-9]{3,24}$/;

const rawBlobAccountName = process.env.VITE_BLOB_ACCOUNT_NAME?.trim() ?? '';
const rawApiBaseUrl = process.env.VITE_API_BASE_URL?.trim() ?? '';
const rawTenantId = process.env.VITE_AAD_TENANT_ID?.trim() ?? '';

// Validate blob account name against Azure naming rules.
const blobAccountName =
  rawBlobAccountName && STORAGE_ACCOUNT_RE.test(rawBlobAccountName)
    ? rawBlobAccountName
    : null;

if (rawBlobAccountName && !blobAccountName) {
  console.warn(
    `[generate-staticwebapp-config]   WARNING: VITE_BLOB_ACCOUNT_NAME "${rawBlobAccountName}" is not a valid storage account name — using wildcard fallback`,
  );
}

// Narrow to the specific blob storage account; fall back to wildcard if not set/invalid.
const blobHostname = blobAccountName
  ? `https://${blobAccountName}.blob.core.windows.net`
  : 'https://*.blob.core.windows.net';

// Extract the origin from the Function App URL; fall back to wildcard if not set.
let apiHostname = 'https://*.azurewebsites.net';
if (rawApiBaseUrl) {
  try {
    const parsed = new URL(rawApiBaseUrl);
    // Only accept https: URLs on azurewebsites.net to prevent mis-configuration.
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.azurewebsites.net')) {
      apiHostname = parsed.origin;
    } else {
      console.warn(
        `[generate-staticwebapp-config]   WARNING: VITE_API_BASE_URL "${rawApiBaseUrl}" is not a valid azurewebsites.net HTTPS URL — using wildcard fallback`,
      );
    }
  } catch {
    console.warn(
      `[generate-staticwebapp-config]   WARNING: VITE_API_BASE_URL "${rawApiBaseUrl}" could not be parsed — using wildcard fallback`,
    );
  }
}

// Fall back to the default tenant if not provided via env.
const tenantId = rawTenantId || '9a40715f-4db6-4dcd-8973-68db2b112fd8';

// ── Configuration ─────────────────────────────────────────────────────────────

const config = {
  auth: {
    identityProviders: {
      azureActiveDirectory: {
        registration: {
          openIdIssuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          clientIdSettingName: 'AAD_CLIENT_ID',
        },
      },
    },
  },
  routes: [
    { route: '/login', rewrite: '/.auth/login/aad' },
    { route: '/logout', redirect: '/.auth/logout' },
    { route: '/.auth/login/github', statusCode: 404 },
    { route: '/.auth/login/twitter', statusCode: 404 },
  ],
  responseOverrides: {
    401: { redirect: '/.auth/login/aad', statusCode: 302 },
  },
  navigationFallback: { rewrite: '/index.html' },
  globalHeaders: {
    // CSP directives:
    //   - connect-src and img-src are locked to the specific blob/API hostnames
    //     resolved from build-time env vars (SSRF / over-broad wildcard fix).
    //   - object-src, base-uri, form-action added to prevent plugin/injection attacks.
    //   - style-src 'self' — no unsafe-inline; Vite extracts all CSS to .css files
    //     in production so inline styles are not required.
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      `img-src 'self' data: ${blobHostname}`,
      `connect-src 'self' ${blobHostname} ${apiHostname} https://login.microsoftonline.com https://dc.services.visualstudio.com https://*.in.applicationinsights.azure.com`,
      'frame-src https://login.microsoftonline.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ') + ';',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Explicit deny for all sensitive browser features beyond camera.
    'Permissions-Policy':
      'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()',
  },
  mimeTypes: {
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
  },
};

// ── Write output ──────────────────────────────────────────────────────────────

const outputPath = join(distDir, 'staticwebapp.config.json');
writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');

console.log(`[generate-staticwebapp-config] Written → ${outputPath}`);
if (blobAccountName) {
  console.log(`[generate-staticwebapp-config]   img/connect blob: ${blobHostname}`);
} else {
  console.warn(
    '[generate-staticwebapp-config]   WARNING: VITE_BLOB_ACCOUNT_NAME not set — blob wildcard in use',
  );
}
if (rawApiBaseUrl && apiHostname !== 'https://*.azurewebsites.net') {
  console.log(`[generate-staticwebapp-config]   connect api:      ${apiHostname}`);
} else {
  console.warn(
    '[generate-staticwebapp-config]   WARNING: VITE_API_BASE_URL not set — API wildcard in use',
  );
}
