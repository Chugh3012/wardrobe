import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";

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

function makeRequest(body: unknown, headers?: Record<string, string>): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/images/sas-url",
    headers: { "Content-Type": "application/json", ...headers },
    body: { string: JSON.stringify(body) },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "generateSasUrl" });
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

  it("returns 400 when userId is missing", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: "test.jpg" }), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("userId");
  });

  it("returns 401 when REQUIRE_AUTH is enabled and no auth header is present", async () => {
    vi.stubEnv("REQUIRE_AUTH", "true");
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: "test.jpg" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("accepts userId from x-ms-client-principal-id header", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "test.jpg" }, { "x-ms-client-principal-id": "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  it("accepts userId from body (backward compat)", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "test.jpg", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(200);
  });

  // ── S2: Blob-name validation & per-user scoping ─────────────────────────

  it("returns 400 when blobName contains '..' path traversal", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "../../secret/file.jpg", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("..");
  });

  it("returns 400 when blobName contains invalid characters", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "blob name with spaces.jpg", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("invalid characters");
  });

  it("returns 400 when blobName exceeds 256 characters", async () => {
    const { generateSasUrl } = await import("./images.js");
    const longName = "a".repeat(257) + ".jpg";
    const res = await generateSasUrl(
      makeRequest({ blobName: longName, userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("256");
  });

  it("prefixes blobName with userId for per-user scoping", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "garments/test.jpg", userId: "user-1" }),
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
      makeRequest({ blobName: "test.jpg", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 when blobName is missing", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ userId: "user-1" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is not a string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: 42, userId: "user-1" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is an empty string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "   ", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { generateSasUrl } = await import("./images.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/images/sas-url",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await generateSasUrl(request, makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 200 with uploadUrl and readUrl on success", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(
      makeRequest({ blobName: "garments/test.jpg", userId: "user-1" }),
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
      makeRequest({ blobName: "test.jpg", userId: "user-1" }),
      makeContext()
    );
    expect(res.status).toBe(500);
  });
});
