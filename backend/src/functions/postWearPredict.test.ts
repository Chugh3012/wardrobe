import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockFetchAll = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll });

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            create: mockCreate,
            query: mockQuery,
          },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/wear/predict",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-ms-client-principal-id": userId } : {}),
    },
    body: { string: JSON.stringify(body) },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "postWearPredict" });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    outfitImageUrl: "https://storageaccount.blob.core.windows.net/outfits/photo1.jpg",
    ...overrides,
  };
}

/** Minimal Garment documents returned by listGarments. */
function sampleGarments() {
  return [
    {
      id: "g1",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://storageaccount.blob.core.windows.net/images/img1.jpg"],
      wearCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "g2",
      userId: "user-1",
      name: "Red Dress",
      category: "dress",
      catalogImageUrls: ["https://storageaccount.blob.core.windows.net/images/img2.jpg"],
      wearCount: 1,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/wear/predict", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns 200 with predictions and a predictionAuditId", async () => {
    mockFetchAll.mockResolvedValue({ resources: sampleGarments() });

    const auditDoc = {
      id: "audit-1",
      userId: "user-1",
      inputImageUrl: "https://storageaccount.blob.core.windows.net/outfits/photo1.jpg",
      topKPredictions: [
        { garmentId: "g1", confidence: 0.95 },
        { garmentId: "g2", confidence: 0.85 },
      ],
      source: "stub",
      userFinalSelection: "",
      createdAt: "2026-03-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: auditDoc });

    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(200);

    const json = res.jsonBody as {
      predictionAuditId: string;
      source: string;
      confidenceLevel: string;
      predictions: Array<{
        garmentId: string;
        garmentName: string;
        confidence: number;
      }>;
    };

    expect(json.predictionAuditId).toBe("audit-1");
    expect(json.source).toBe("stub");
    expect(json.confidenceLevel).toBe("high");
    expect(json.predictions).toHaveLength(2);
    expect(json.predictions[0]).toEqual({
      garmentId: "g1",
      garmentName: "Blue Shirt",
      confidence: 0.95,
    });
    expect(json.predictions[1]).toEqual({
      garmentId: "g2",
      garmentName: "Red Dress",
      confidence: 0.85,
    });
  });

  it("creates a PredictionAudit document in Cosmos DB", async () => {
    mockFetchAll.mockResolvedValue({ resources: sampleGarments() });
    mockCreate.mockResolvedValue({
      resource: {
        id: "audit-2",
        userId: "user-1",
        inputImageUrl: "https://storageaccount.blob.core.windows.net/outfits/photo1.jpg",
        topKPredictions: [],
        source: "stub",
        userFinalSelection: "",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    });

    const { postWearPredict } = await import("./postWearPredict.js");
    await postWearPredict(makeRequest(validBody(), "user-1"), makeContext());

    expect(mockCreate).toHaveBeenCalledOnce();
    const created = mockCreate.mock.calls[0][0];
    expect(created.userId).toBe("user-1");
    expect(created.inputImageUrl).toBe("https://storageaccount.blob.core.windows.net/outfits/photo1.jpg");
    expect(created.source).toBe("stub");
    expect(created.userFinalSelection).toBe("");
    expect(created.topKPredictions).toHaveLength(2);
  });

  // ── Invalid JSON ──────────────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/wear/predict",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await postWearPredict(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid JSON");
  });

  // ── Missing required fields ───────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody()),
      makeContext()
    );
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 400 when outfitImageUrl is missing", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: "" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("outfitImageUrl");
  });

  it("returns 400 when outfitImageUrl is not a string", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: 123 }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("outfitImageUrl");
  });

  // ── No garments ───────────────────────────────────────────────────────────

  it("returns 404 when user has no garments", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("No garments");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when listGarments throws", async () => {
    mockFetchAll.mockRejectedValue(new Error("Cosmos DB unavailable"));

    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain(
      "Failed to predict garments"
    );
  });

  it("returns 500 when createPredictionAudit throws", async () => {
    mockFetchAll.mockResolvedValue({ resources: sampleGarments() });
    mockCreate.mockRejectedValue(new Error("Cosmos DB write failed"));

    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain(
      "Failed to predict garments"
    );
  });

  // ── S12: field length limits ────────────────────────────────────────────────

  it("returns 400 when outfitImageUrl exceeds 2048 characters", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const longUrl = "https://storageaccount.blob.core.windows.net/" + "a".repeat(2048);
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: longUrl }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 2048");
  });

  // ── S7: SSRF — outfitImageUrl validation ──────────────────────────────────

  it("returns 400 when outfitImageUrl uses http instead of https", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: "http://storageaccount.blob.core.windows.net/outfits/photo1.jpg" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  it("returns 400 when outfitImageUrl is not from blob.core.windows.net", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: "https://evil.example.com/outfit.jpg" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  it("returns 400 when outfitImageUrl targets the Azure IMDS endpoint (SSRF)", async () => {
    const { postWearPredict } = await import("./postWearPredict.js");
    const res = await postWearPredict(
      makeRequest(validBody({ outfitImageUrl: "https://169.254.169.254/metadata/instance" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });
});
