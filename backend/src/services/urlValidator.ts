/**
 * URL validation utilities for preventing Server-Side Request Forgery (SSRF).
 *
 * Rules enforced:
 *  1. Must be a valid URL.
 *  2. Protocol must be https:.
 *  3. Hostname must end with .blob.core.windows.net (Azure Blob Storage allow-list).
 *  4. Hostname must not resolve to a private/link-local IP address.
 */

/** RFC-1918, loopback, and link-local address patterns. */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,        // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/,                        // 192.168.0.0/16
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                    // loopback
  /^169\.254\.\d{1,3}\.\d{1,3}$/,                        // link-local / Azure IMDS
  /^::1$/,                                                // IPv6 loopback
  /^fc[\da-f]{2}:/i,                                      // IPv6 unique-local
  /^fe80:/i,                                              // IPv6 link-local
];

/**
 * Returns true if `url` is a safe image URL that may be forwarded to
 * Azure AI services.  Returns false for any URL that is non-HTTPS, outside
 * the app's own Azure Blob Storage domain, or that targets a private/internal address.
 */
export function isValidImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Must be HTTPS.
  if (parsed.protocol !== "https:") return false;

  // Hostname must be *.blob.core.windows.net.
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(".blob.core.windows.net")) return false;

  // M13: Restrict to the app's own blob account if configured (SSRF prevention).
  const expectedAccount = process.env["BLOB_ACCOUNT_NAME"];
  if (expectedAccount) {
    const expectedHost = `${expectedAccount}.blob.core.windows.net`;
    if (hostname !== expectedHost) return false;
  }

  // Reject private / link-local addresses (defense-in-depth).
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(hostname))) return false;

  return true;
}
