import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

/** SAS token validity for read access — 1 hour. */
const READ_TTL_SECONDS = 60 * 60;

/**
 * Returns a BlobServiceClient authenticated via Managed Identity.
 */
function getBlobServiceClient(accountName: string): BlobServiceClient {
  const accountUrl = `https://${accountName}.blob.core.windows.net`;
  return new BlobServiceClient(accountUrl, new DefaultAzureCredential());
}

/**
 * Strips any existing query parameters (e.g. expired SAS tokens) from a URL,
 * returning only the origin + pathname.
 */
export function stripQueryParams(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Generates fresh read-only SAS URLs for an array of blob base URLs.
 *
 * Uses a single user-delegation key for the entire batch, keeping the
 * round-trip to Azure AD to one request per call.
 *
 * Any URL that is `null`, not a `*.blob.core.windows.net` URL, or
 * otherwise unparseable is returned as-is.  When `BLOB_ACCOUNT_NAME`
 * is not configured the input array is returned unchanged.
 */
export async function generateReadSasUrls(
  urls: (string | null)[],
): Promise<(string | null)[]> {
  const blobAccountName = process.env["BLOB_ACCOUNT_NAME"] ?? "";
  if (!blobAccountName) return urls;
  if (urls.length === 0 || urls.every((u) => !u)) return urls;

  const client = getBlobServiceClient(blobAccountName);
  const now = new Date();
  const expiry = new Date(now.getTime() + READ_TTL_SECONDS * 1000);
  const delegationKey = await client.getUserDelegationKey(now, expiry);

  return urls.map((url) => {
    if (!url) return null;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return url;
    }

    if (!parsed.hostname.endsWith(".blob.core.windows.net")) return url;

    const cleanUrl = `${parsed.origin}${parsed.pathname}`;
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length < 2) return url;

    const containerName = pathParts[0];
    const blobName = pathParts.slice(1).join("/");

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: now,
        expiresOn: expiry,
        protocol: SASProtocol.Https,
      },
      delegationKey,
      blobAccountName,
    );

    return `${cleanUrl}?${sas.toString()}`;
  });
}
