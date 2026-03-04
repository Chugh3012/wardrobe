/**
 * Integration tests — API endpoint pipeline.
 *
 * These tests exercise each Azure Functions HTTP handler end-to-end
 * with mocked Azure services.  They verify:
 *   - Authentication enforcement (401 without auth headers)
 *   - Request validation (400 on bad input)
 *   - Happy-path response shape and status codes
 *   - Error handling (500 on service failures)
 *
 * External services (Cosmos, Blob, Custom Vision, AI Vision) are mocked
 * at the module boundary, same as unit tests but with the full handler
 * pipeline executing — auth middleware → validation → service calls → response.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetClient } from "../services/cosmosClient.js";
import {
  makeGetRequest,
  makePostRequest,
  makeDeleteRequest,
  makeContext,
  parseResponseBody,
} from "../testUtils.js";

// ── Module mocks ────────────────────────────────────────────────────────────

// Cosmos DB
const mockFetchNext = vi.fn();
const mockFetchAll = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchNext: mockFetchNext, fetchAll: mockFetchAll });
const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockReplace = vi.fn();
const mockDelete = vi.fn();

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            query: mockQuery,
            create: mockCreate,
          },
          item: () => ({
            read: mockRead,
            replace: mockReplace,
            delete: mockDelete,
          }),
        }),
      }),
    };
  }),
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// Blob SAS — pass through by default
const mockGenerateReadSasUrls = vi.fn();
vi.mock("../services/blobSasService.js", () => ({
  generateReadSasUrls: (...args: unknown[]) => mockGenerateReadSasUrls(...args),
  stripQueryParams: (url: string) => url.split("?")[0],
}));

// Custom Vision
vi.mock("../services/customVisionService.js", () => ({
  trainGarmentImage: vi.fn().mockResolvedValue(undefined),
  predictImage: vi.fn().mockResolvedValue([]),
}));

// Embedding service
vi.mock("../services/embeddingService.js", () => ({
  computeAndStoreEmbeddings: vi.fn().mockResolvedValue(undefined),
  findSimilarGarments: vi.fn().mockResolvedValue([]),
}));

// Telemetry
vi.mock("../services/telemetryService.js", () => ({
  trackEvent: vi.fn(),
  trackException: vi.fn(),
}));

// URL validator
vi.mock("../services/urlValidator.js", () => ({
  isValidImageUrl: (url: string) => url.startsWith("https://") && url.includes("blob.core.windows.net"),
}));

// ── Import handlers AFTER mocks ─────────────────────────────────────────────

const { health } = await import("../functions/health.js");
const { getGarments } = await import("../functions/getGarments.js");
const { getStatsSummary } = await import("../functions/getStatsSummary.js");

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-mock.documents.azure.com:443/");
  vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
  vi.stubEnv("REQUIRE_AUTH", "true");
  resetClient();
  vi.clearAllMocks();

  mockGenerateReadSasUrls.mockImplementation(async (urls: (string | null)[]) =>
    urls.map((u) => (u ? `${u}?sv=mock&sig=test` : null)),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: GET /api/health", () => {
  it("returns 200 ok without auth", async () => {
    const res = await health(
      makeGetRequest("/api/health"),
      makeContext("health"),
    );
    expect(res.status).toBe(200);
    expect(parseResponseBody(res)).toEqual({ status: "ok" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Get Garments endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: GET /api/garments", () => {
  it("returns 401 when no auth header is provided", async () => {
    const res = await getGarments(
      makeGetRequest("/api/garments"),
      makeContext("getGarments"),
    );
    expect(res.status).toBe(401);
    const body = parseResponseBody<{ error: string }>(res);
    expect(body.error).toContain("Authentication");
  });

  it("returns 200 with empty garments for a new user", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });
    mockGenerateReadSasUrls.mockResolvedValue([]);

    const res = await getGarments(
      makeGetRequest("/api/garments", { userId: "test-user" }),
      makeContext("getGarments"),
    );
    expect(res.status).toBe(200);
    const body = parseResponseBody<{ garments: unknown[] }>(res);
    expect(body.garments).toEqual([]);
  });

  it("returns 200 with paginated garments", async () => {
    const garments = [
      {
        id: "g1", userId: "test-user", name: "Blue Shirt", category: "top",
        catalogImageUrls: ["https://st.blob.core.windows.net/images/img1.jpg"],
        wearCount: 5, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockFetchNext.mockResolvedValue({ resources: garments, continuationToken: "next-page-token" });

    const res = await getGarments(
      makeGetRequest("/api/garments", { userId: "test-user", query: { pageSize: "10" } }),
      makeContext("getGarments"),
    );
    expect(res.status).toBe(200);
    const body = parseResponseBody<{ garments: unknown[]; continuationToken?: string }>(res);
    expect(body.garments).toHaveLength(1);
    expect(body.continuationToken).toBe("next-page-token");
    expect((body.garments[0] as Record<string, unknown>).thumbnailUrl).toContain("?sv=mock");
  });

  it("returns 400 for invalid pageSize", async () => {
    const res = await getGarments(
      makeGetRequest("/api/garments", { userId: "test-user", query: { pageSize: "abc" } }),
      makeContext("getGarments"),
    );
    expect(res.status).toBe(400);
  });

  it("handles Cosmos errors as 500", async () => {
    mockFetchNext.mockRejectedValue(new Error("Cosmos connection failed"));

    const res = await getGarments(
      makeGetRequest("/api/garments", { userId: "test-user" }),
      makeContext("getGarments"),
    );
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stats Summary endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: GET /api/stats/summary", () => {
  it("returns 401 without auth", async () => {
    const res = await getStatsSummary(
      makeGetRequest("/api/stats/summary"),
      makeContext("getStatsSummary"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats for authenticated user", async () => {
    // Mock garments list
    mockFetchAll.mockResolvedValueOnce({
      resources: [
        { id: "g1", userId: "test-user", name: "Shirt", category: "top", wearCount: 3,
          catalogImageUrls: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
      ],
    });
    // Mock wear event aggregations
    mockFetchAll.mockResolvedValueOnce({
      resources: [{ garmentId: "g1", lastWornDate: "2026-03-01T10:00:00Z", eventCount: 3 }],
    });
    // Mock wear dates
    mockFetchAll.mockResolvedValueOnce({
      resources: [{ date: "2026-03-01" }],
    });

    const res = await getStatsSummary(
      makeGetRequest("/api/stats/summary", { userId: "test-user" }),
      makeContext("getStatsSummary"),
    );
    expect(res.status).toBe(200);
    const body = parseResponseBody<{ totalGarments: number; totalWearEvents: number }>(res);
    expect(body.totalGarments).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Auth bypass — local dev mode
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: Auth bypass (REQUIRE_AUTH=false)", () => {
  beforeEach(() => {
    vi.stubEnv("REQUIRE_AUTH", "false");
  });

  it("accepts x-ms-client-principal-id fallback header", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });
    mockGenerateReadSasUrls.mockResolvedValue([]);

    const req = makeGetRequest("/api/garments");
    // Manually add the plain-text fallback header
    const reqWithHeader = new (await import("@azure/functions")).HttpRequest({
      method: "GET",
      url: "http://localhost:7071/api/garments",
      headers: { "x-ms-client-principal-id": "local-dev-user" },
    });

    const res = await getGarments(reqWithHeader, makeContext("getGarments"));
    expect(res.status).toBe(200);
  });
});
