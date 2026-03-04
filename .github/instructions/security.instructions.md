---
description: 'Security rules based on OWASP Top 10 and project-specific controls'
applyTo: '**'
---

# Security Instructions

## Authentication

Every backend handler must call `extractUserId()` and return `unauthorizedResponse()` before any business logic.

- `authLevel` is always `"anonymous"` — never rely on Azure Functions auth.
- `REQUIRE_AUTH` defaults to `true` (secure-by-default).
- UserId validation: trim → reject empty → reject > 128 chars → reject if fails `/^[a-zA-Z0-9@._-]+$/`.

## Input Validation

- Validation is **sequential** — first failure returns `400` immediately.
- **Reuse shared constants** — never hardcode new limits:

| Constant | Value |
|----------|-------|
| `MAX_NAME_LENGTH` | `100` |
| `MAX_CATEGORY_LENGTH` | `50` |
| `MAX_URL_LENGTH` | `2048` |
| `MAX_ID_LENGTH` | `256` |
| `MAX_BLOB_NAME_LENGTH` | `256` |
| `ALLOWED_CATEGORIES` | `dress, top, bottom, outerwear, shoes, accessory, other` |
| `ALLOWED_MIME_TYPES` | `image/jpeg, image/png, image/webp, image/heic, image/heif` |

- **Reuse safe-character regexes** — do not invent new ones:

| Regex | Purpose |
|-------|---------|
| `/^[a-zA-Z0-9@._-]+$/` | User IDs |
| `/^[a-zA-Z0-9_-]+$/` | Entity IDs |
| `/^[a-zA-Z0-9._/-]+$/` | Blob names |

## URL Validation (SSRF Prevention)

All user-supplied URLs must pass through `isValidImageUrl()`:
1. Parseable URL
2. Protocol: `https:` only
3. Hostname: must end with `.blob.core.windows.net`
4. If `BLOB_ACCOUNT_NAME` set → hostname must match exactly
5. Block all private IP ranges (RFC 1918, loopback, link-local, Azure IMDS)

## Blob Storage

- SAS via User Delegation Key only — never storage account keys.
- Upload SAS: `cw` permissions, 5 min TTL, MIME-type enforced.
- Read SAS: `r` permissions, 1 hour TTL.
- Path traversal defense: reject `..`, regex allowlist, user-scoped prefix.

## Telemetry

- Property deny-list: `/^(token|password|secret|authorization|cookie|key|credential)$/i`.
- Never log request bodies, headers, or tokens.
- Always use `trackEvent()` / `trackException()` from shared service — never call SDK directly.

## Error Responses

- Never return stack traces or internal error messages to clients.
- Error `jsonBody` always has shape `{ error: string }`.
- Log full errors with `context.log()` + `trackException()` server-side only.

## CSP & Headers

When adding new external dependencies (scripts, APIs, CDNs), update the CSP in `staticwebapp.config.json`. Keep allowlists as narrow as possible.

## OWASP Coverage

| Category | Controls |
|----------|----------|
| A01 Access Control | `extractUserId()`, user-scoped blobs, `/userId` partition key, IDOR checks |
| A02 Crypto | HTTPS-only, TLS 1.2+, SAS HTTPS protocol, no local auth keys |
| A03 Injection | Safe-character regex, `..` rejection, Cosmos SDK parameterized queries |
| A04 Insecure Design | Idempotency guards, user-delegation SAS, time-bounded tokens |
| A05 Misconfiguration | CSP, HSTS, X-Frame-Options, `allowBlobPublicAccess: false` |
| A06 Components | Key Vault references, 90-day rotation |
| A07 Auth | EasyAuth v2 + app-level double-check, secure-by-default |
| A08 Integrity | Telemetry deny-list, category allowlist, MIME restriction |
| A09 Logging | App Insights both ends, sanitized properties |
| A10 SSRF | `isValidImageUrl()`, private IP blocklist |
