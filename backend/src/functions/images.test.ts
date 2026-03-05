import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest } from "@azure/functions";
import { encodeClientPrincipal, makePostRequest, makeContext as makeBaseContext } from "../testUtils.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockGetUserDelegationKey = vi.fn();
const mockGenerateBlobSASQueryParameters = vi.fn();

vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: vi.fn().mockImplementation(function () {
    return { getUserDelegationKey: mockGetUserDelegationKey };
  }),
  BlobSASPermissions: {
    parse: vi.fn().mockReturnValue({}),
  },
  generateBlobSASQueryParameters: mockGenerateBlobSASQueryParameters,
  SASProtocol: { Https: "https" },
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shorthand: create a request with auth via base64 client principal. */
function makeAuthRequest(body: unknown, userId: string = "user-1") {
  return makePostRequest("/api/images/sas-url", body, { userId });
}

function makeContext() {
  return makeBaseContext("generateSasUrl");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/images/sas-url", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_ACCOUNT_NAME", "stwardrobeimgdev");
    vi.stubEnv("BLOB_CONTAINER_NAME", "images");

    mockGetUserDelegationKey.mockResolvedValue({ signedObjectId: "oid" });
    mockGenerateBlobSASQueryParameters.mockReturnValue({
      toString: () => "sv=2023&sig=fake",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ── S1: Authentication ──────────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makePostRequest("/api/images/sas-url", { blobName: "test.jpg" }), makeContext());
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("accepts userId from base64 x-ms-client-principal header", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  // ── S2: Blob-name validation & per-user scoping ─────────────────────────

  it("returns 400 when blobName contains '..' path traversal", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "../../secret/file.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("..");
  });

  it("returns 400 when blobName contains invalid characters", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "blob name with spaces.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("invalid characters");
  });

  it("returns 400 when blobName exceeds 256 characters", async () => {
    const { generateSasUrl } = await import("./images.js");
    const longName = "a".repeat(257) + ".jpg";
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: longName }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("256");
  });

  it("prefixes blobName with userId for per-user scoping", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "garments/test.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { blobName: string };
    expect(body.blobName).toBe("user-1/garments/test.jpg");
  });

  // ── Existing behaviour ──────────────────────────────────────────────────

  it("returns 503 when BLOB_ACCOUNT_NAME is not set", async () => {
    vi.stubEnv("BLOB_ACCOUNT_NAME", "");
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 when blobName is missing", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeAuthRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is not a string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeAuthRequest({ blobName: 42 }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is an empty string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "   " }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { generateSasUrl } = await import("./images.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/images/sas-url",
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-principal": encodeClientPrincipal("user-1"),
      },
      body: { string: "not-json{{" },
    });
    const res = await generateSasUrl(request, makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 401 before parsing body when auth header is missing (even with invalid JSON)", async () => {
    const { generateSasUrl } = await import("./images.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/images/sas-url",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await generateSasUrl(request, makeContext());
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 200 with uploadUrl and readUrl on success", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "garments/test.jpg" }),
      makeContext()
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { blobName: string; uploadUrl: string; readUrl: string };
    expect(body.blobName).toBe("user-1/garments/test.jpg");
    expect(body.uploadUrl).toContain("stwardrobeimgdev.blob.core.windows.net");
    expect(body.uploadUrl).toContain("user-1/garments/test.jpg");
    expect(body.readUrl).toContain("stwardrobeimgdev.blob.core.windows.net");
    expect(mockGetUserDelegationKey).toHaveBeenCalledOnce();
    expect(mockGenerateBlobSASQueryParameters).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when getUserDelegationKey throws", async () => {
    mockGetUserDelegationKey.mockRejectedValue(new Error("Auth failed"));
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(500);
  });

  // ── SEC-P6: Content-type restrictions ─────────────────────────────────────

  it("defaults to image/jpeg when contentType is not provided", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.jpg" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  it("accepts image/png content type", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.png", contentType: "image/png" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  it("accepts image/webp content type", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.webp", contentType: "image/webp" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  it("rejects disallowed content type", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.txt", contentType: "text/plain" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("not allowed");
  });

  it("rejects application/octet-stream content type", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeAuthRequest({ blobName: "test.bin", contentType: "application/octet-stream" }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });
});
