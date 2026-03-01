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

const BLOB_CONTAINER_NAME_DEFAULT = "images";

/** SAS token validity window in seconds. */
const UPLOAD_TTL_SECONDS = 5 * 60; // 5 minutes — tight window for upload
const READ_TTL_SECONDS = 60 * 60; // 1 hour  — enough time to view on phone

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
 *   "blobName": "some/path/image.jpg",
 *   "uploadUrl": "<SAS URL for PUT upload, valid 5 min>",
 *   "readUrl":   "<SAS URL for GET read,   valid 1 hr>"
 * }
 *
 * The caller uploads the image directly to `uploadUrl` (HTTP PUT), then
 * opens `readUrl` in a browser to verify the image is accessible.
 */
export async function generateSasUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
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

  let blobName: string;
  try {
    const body = (await request.json()) as { blobName?: unknown };
    if (!body.blobName || typeof body.blobName !== "string") {
      return {
        status: 400,
        jsonBody: { error: "Request body must include a non-empty 'blobName' string." },
      };
    }
    blobName = body.blobName.trim();
    if (!blobName) {
      return {
        status: 400,
        jsonBody: { error: "Request body must include a non-empty 'blobName' string." },
      };
    }
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  try {
    const client = getBlobServiceClient(blobAccountName);

    const now = new Date();
    const uploadExpiry = new Date(now.getTime() + UPLOAD_TTL_SECONDS * 1000);
    const readExpiry = new Date(now.getTime() + READ_TTL_SECONDS * 1000);

    // Obtain a user-delegation key — requires Storage Blob Delegator role on the MI.
    const delegationKey = await client.getUserDelegationKey(now, readExpiry);

    const uploadSas = generateBlobSASQueryParameters(
      {
        containerName: blobContainerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"), // create + write
        startsOn: now,
        expiresOn: uploadExpiry,
        protocol: SASProtocol.Https,
      },
      delegationKey,
      blobAccountName
    );

    const readSas = generateBlobSASQueryParameters(
      {
        containerName: blobContainerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"), // read
        startsOn: now,
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
