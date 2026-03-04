import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackException } from "../services/telemetryService.js";

const BLOB_CONTAINER_NAME_DEFAULT = "images";

/** SAS token validity window in seconds. */
const UPLOAD_TTL_SECONDS = 5 * 60; // 5 minutes — tight window for upload
const READ_TTL_SECONDS = 60 * 60; // 1 hour  — enough time to view on phone

/** Maximum allowed length for the caller-supplied blobName segment. */
const MAX_BLOB_NAME_LENGTH = 256;

/** Only safe characters are allowed in the caller-supplied blobName. */
const SAFE_BLOB_NAME_RE = /^[a-zA-Z0-9._/-]+$/;

/** Allowed MIME content types for image uploads (SEC-P6). */
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * Returns a BlobServiceClient authenticated via Managed Identity (DefaultAzureCredential).
 * Locally, set AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET or use `az login`.
 */
function getBlobServiceClient(accountName: string): BlobServiceClient {
  const accountUrl = `https://${accountName}.blob.core.windows.net`;
  return new BlobServiceClient(accountUrl, new DefaultAzureCredential());
}

/**
 * POST /api/images/sas-url
 *
 * Body (JSON): { "blobName": "some/path/image.jpg" }
 *
 * Returns:
 * {
 *   "blobName": "{userId}/some/path/image.jpg",
 *   "uploadUrl": "<SAS URL for PUT upload, valid 5 min>",
 *   "readUrl":   "<SAS URL for GET read,   valid 1 hr>"
 * }
 *
 * The caller uploads the image directly to `uploadUrl` (HTTP PUT), then
 * opens `readUrl` in a browser to verify the image is accessible.
 *
 * Security:
 * - Requires authentication (S1).
 * - Validates blobName and prefixes it with the userId to prevent path
 *   traversal and cross-user access (S2).
 * - Restricts upload content-type to image MIME types only (SEC-P6).
 */
export async function generateSasUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // ── Parse JSON body ───────────────────────────────────────────────────────
  let body: { blobName?: unknown; contentType?: unknown };
  try {
    body = (await request.json()) as { blobName?: unknown; contentType?: unknown };
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  // ── Authenticate (S1) ────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // Read env vars at call time so tests can stub them per-test.
  const blobAccountName = process.env["BLOB_ACCOUNT_NAME"] ?? "";
  const blobContainerName = process.env["BLOB_CONTAINER_NAME"] ?? BLOB_CONTAINER_NAME_DEFAULT;

  if (!blobAccountName) {
    context.log("BLOB_ACCOUNT_NAME is not configured");
    return {
      status: 503,
      jsonBody: { error: "Blob storage is not configured on this server." },
    };
  }

  // ── Validate blobName (S2) ───────────────────────────────────────────────
  if (!body.blobName || typeof body.blobName !== "string") {
    return {
      status: 400,
      jsonBody: { error: "Request body must include a non-empty 'blobName' string." },
    };
  }
  const rawBlobName = body.blobName.trim();
  if (!rawBlobName) {
    return {
      status: 400,
      jsonBody: { error: "Request body must include a non-empty 'blobName' string." },
    };
  }

  if (rawBlobName.length > MAX_BLOB_NAME_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'blobName' must be at most ${MAX_BLOB_NAME_LENGTH} characters.` },
    };
  }

  // Defense-in-depth: reject traversal before the regex check.
  if (rawBlobName.includes("..")) {
    return {
      status: 400,
      jsonBody: { error: "'blobName' must not contain '..' path traversal sequences." },
    };
  }

  if (!SAFE_BLOB_NAME_RE.test(rawBlobName)) {
    return {
      status: 400,
      jsonBody: { error: "'blobName' contains invalid characters." },
    };
  }

  // Prefix with userId so each user is scoped to their own directory.
  const blobName = `${userId}/${rawBlobName}`;

  // Guard against exceeding Azure Blob Storage's 1024-character path limit.
  if (blobName.length > 1024) {
    return {
      status: 400,
      jsonBody: { error: "Resulting blob path is too long." },
    };
  }

  // ── Validate content type (SEC-P6) ──────────────────────────────────────
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "image/jpeg";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return {
      status: 400,
      jsonBody: {
        error: `Content type '${contentType}' is not allowed. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
      },
    };
  }

  try {
    const client = getBlobServiceClient(blobAccountName);

    const now = new Date();
    // Start 5 minutes in the past to account for clock skew between
    // the local machine and Azure Storage servers.
    const start = new Date(now.getTime() - 5 * 60 * 1000);
    const uploadExpiry = new Date(now.getTime() + UPLOAD_TTL_SECONDS * 1000);
    const readExpiry = new Date(now.getTime() + READ_TTL_SECONDS * 1000);

    // Obtain a user-delegation key — requires Storage Blob Delegator role on the MI.
    const delegationKey = await client.getUserDelegationKey(start, readExpiry);

    const uploadSas = generateBlobSASQueryParameters(
      {
        containerName: blobContainerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"), // create + write
        startsOn: start,
        expiresOn: uploadExpiry,
        protocol: SASProtocol.Https,
        contentType, // SEC-P6: restrict upload to declared MIME type
      },
      delegationKey,
      blobAccountName
    );

    const readSas = generateBlobSASQueryParameters(
      {
        containerName: blobContainerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"), // read
        startsOn: start,
        expiresOn: readExpiry,
        protocol: SASProtocol.Https,
      },
      delegationKey,
      blobAccountName
    );

    const baseUrl = `https://${blobAccountName}.blob.core.windows.net/${blobContainerName}/${blobName}`;

    context.log(`Generated SAS URLs for blob: ${blobName}`);

    return {
      status: 200,
      jsonBody: {
        blobName,
        uploadUrl: `${baseUrl}?${uploadSas.toString()}`,
        readUrl: `${baseUrl}?${readSas.toString()}`,
      },
    };
  } catch (err) {
    context.log(`Error generating SAS URL: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "POST /images/sas-url", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to generate SAS URL. Check server logs." },
    };
  }
}

app.http("generateSasUrl", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "images/sas-url",
  handler: generateSasUrl,
});
