import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("blobSasService", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_ACCOUNT_NAME", "stwardrobeimgdev");
    mockGetUserDelegationKey.mockResolvedValue({ signedObjectId: "oid" });
    mockGenerateBlobSASQueryParameters.mockReturnValue({
      toString: () => "sv=2023&sig=fresh",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("stripQueryParams", () => {
    it("removes query string from a valid URL", async () => {
      const { stripQueryParams } = await import("./blobSasService.js");
      const result = stripQueryParams(
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/garments/test.jpg?sv=2023&sig=expired"
      );
      expect(result).toBe(
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/garments/test.jpg"
      );
    });

    it("returns the same URL when there are no query params", async () => {
      const { stripQueryParams } = await import("./blobSasService.js");
      const url = "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/garments/test.jpg";
      expect(stripQueryParams(url)).toBe(url);
    });

    it("returns the input unchanged for invalid URLs", async () => {
      const { stripQueryParams } = await import("./blobSasService.js");
      expect(stripQueryParams("not-a-url")).toBe("not-a-url");
    });
  });

  describe("generateReadSasUrls", () => {
    it("returns fresh SAS URLs for blob storage URLs", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/test.jpg",
      ]);
      expect(result).toEqual([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/test.jpg?sv=2023&sig=fresh",
      ]);
      expect(mockGetUserDelegationKey).toHaveBeenCalledOnce();
      expect(mockGenerateBlobSASQueryParameters).toHaveBeenCalledOnce();
    });

    it("strips old SAS tokens before generating fresh ones", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/test.jpg?sv=old&sig=expired",
      ]);
      expect(result).toEqual([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/test.jpg?sv=2023&sig=fresh",
      ]);
    });

    it("passes null through unchanged", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([null]);
      expect(result).toEqual([null]);
    });

    it("returns input unchanged when BLOB_ACCOUNT_NAME is not configured", async () => {
      vi.stubEnv("BLOB_ACCOUNT_NAME", "");
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const urls = ["https://stwardrobeimgdev.blob.core.windows.net/images/user-1/test.jpg"];
      const result = await generateReadSasUrls(urls);
      expect(result).toEqual(urls);
      expect(mockGetUserDelegationKey).not.toHaveBeenCalled();
    });

    it("returns empty array for empty input", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([]);
      expect(result).toEqual([]);
      expect(mockGetUserDelegationKey).not.toHaveBeenCalled();
    });

    it("skips all-null arrays without calling Azure", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([null, null]);
      expect(result).toEqual([null, null]);
      expect(mockGetUserDelegationKey).not.toHaveBeenCalled();
    });

    it("passes through non-blob URLs unchanged", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([
        "https://example.com/image.jpg",
      ]);
      expect(result).toEqual(["https://example.com/image.jpg"]);
    });

    it("handles mixed null and blob URLs", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      const result = await generateReadSasUrls([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/a.jpg",
        null,
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/b.jpg",
      ]);
      expect(result).toEqual([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/a.jpg?sv=2023&sig=fresh",
        null,
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/b.jpg?sv=2023&sig=fresh",
      ]);
    });

    it("uses a single delegation key for the entire batch", async () => {
      const { generateReadSasUrls } = await import("./blobSasService.js");
      await generateReadSasUrls([
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/a.jpg",
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/b.jpg",
        "https://stwardrobeimgdev.blob.core.windows.net/images/user-1/c.jpg",
      ]);
      expect(mockGetUserDelegationKey).toHaveBeenCalledOnce();
      expect(mockGenerateBlobSASQueryParameters).toHaveBeenCalledTimes(3);
    });
  });
});
