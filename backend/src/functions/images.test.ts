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

function makeRequest(body: unknown): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/images/sas-url",
    headers: { "Content-Type": "application/json" },
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

  it("returns 503 when BLOB_ACCOUNT_NAME is not set", async () => {
    vi.stubEnv("BLOB_ACCOUNT_NAME", "");
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: "test.jpg" }), makeContext());
    expect(res.status).toBe(503);
  });

  it("returns 400 when blobName is missing", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is not a string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: 42 }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when blobName is an empty string", async () => {
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: "   " }), makeContext());
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
    const res = await generateSasUrl(makeRequest({ blobName: "garments/test.jpg" }), makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { blobName: string; uploadUrl: string; readUrl: string };
    expect(body.blobName).toBe("garments/test.jpg");
    expect(body.uploadUrl).toContain("stwardrobeimgdev.blob.core.windows.net");
    expect(body.uploadUrl).toContain("garments/test.jpg");
    expect(body.readUrl).toContain("stwardrobeimgdev.blob.core.windows.net");
    expect(mockGetUserDelegationKey).toHaveBeenCalledOnce();
    expect(mockGenerateBlobSASQueryParameters).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when getUserDelegationKey throws", async () => {
    mockGetUserDelegationKey.mockRejectedValue(new Error("Auth failed"));
    const { generateSasUrl } = await import("./images.js");
    const res = await generateSasUrl(makeRequest({ blobName: "test.jpg" }), makeContext());
    expect(res.status).toBe(500);
  });
});
