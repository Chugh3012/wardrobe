import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockReplace = vi.fn();
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
          item: () => ({
            read: mockRead,
            replace: mockReplace,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/wear/confirm",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-ms-client-principal-id": userId } : {}),
    },
    body: { string: JSON.stringify(body) },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "postWearConfirm" });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    predictionAuditId: "audit-1",
    confirmedGarmentId: "g1",
    confirmed: true,
    ...overrides,
  };
}

/** Minimal PredictionAudit document returned by readPredictionAudit. */
function sampleAudit() {
  return {
    id: "audit-1",
    userId: "user-1",
    inputImageUrl: "https://blob.example.com/outfits/photo1.jpg",
    topKPredictions: [
      { garmentId: "g1", confidence: 0.95 },
      { garmentId: "g2", confidence: 0.85 },
    ],
    userFinalSelection: "",
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

/** Minimal Garment document returned by read for incrementWearCount. */
function sampleGarment() {
  return {
    id: "g1",
    userId: "user-1",
    name: "Blue Shirt",
    category: "top",
    catalogImageUrls: ["https://blob.example.com/img1.jpg"],
    wearCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Minimal WearEvent document returned by createWearEvent. */
function sampleWearEvent() {
  return {
    id: "evt-1",
    userId: "user-1",
    garmentId: "g1",
    outfitImageUrl: "https://blob.example.com/outfits/photo1.jpg",
    predictedGarmentId: "g1",
    confidence: 0.95,
    confirmed: true,
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/wear/confirm", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Happy path (confirmed = true) ────────────────────────────────────────

  it("returns 200 with the created WearEvent when confirmed = true", async () => {
    // readPredictionAudit
    mockRead.mockResolvedValueOnce({ resource: sampleAudit() });
    // readGarment (ownership check)
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    // createWearEvent
    mockCreate.mockResolvedValueOnce({ resource: sampleWearEvent() });
    // incrementWearCount: read garment
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    // incrementWearCount: replace garment
    mockReplace.mockResolvedValueOnce({ resource: { ...sampleGarment(), wearCount: 4 } });

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual(sampleWearEvent());
  });

  it("creates a WearEvent and increments wearCount on confirmed = true", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleAudit() });
    // readGarment (ownership check)
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockCreate.mockResolvedValueOnce({ resource: sampleWearEvent() });
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockReplace.mockResolvedValueOnce({ resource: { ...sampleGarment(), wearCount: 4 } });

    const { postWearConfirm } = await import("./postWearConfirm.js");
    await postWearConfirm(makeRequest(validBody(), "user-1"), makeContext());
    expect(mockCreate).toHaveBeenCalledOnce();
    const wearEvt = mockCreate.mock.calls[0][0];
    expect(wearEvt.userId).toBe("user-1");
    expect(wearEvt.garmentId).toBe("g1");
    expect(wearEvt.confirmed).toBe(true);

    // Garment wearCount was read then replaced
    expect(mockReplace).toHaveBeenCalledOnce();
    const replaced = mockReplace.mock.calls[0][0];
    expect(replaced.wearCount).toBe(4);
  });

  // ── Happy path (confirmed = false / correction) ──────────────────────────

  it("updates userFinalSelection and creates a WearEvent when confirmed = false", async () => {
    const audit = sampleAudit();
    // readPredictionAudit (for the function)
    mockRead.mockResolvedValueOnce({ resource: audit });
    // readGarment (ownership check)
    mockRead.mockResolvedValueOnce({ resource: { ...sampleGarment(), id: "g2" } });
    // updatePredictionAudit: read audit
    mockRead.mockResolvedValueOnce({ resource: audit });
    // updatePredictionAudit: replace audit
    mockReplace.mockResolvedValueOnce({ resource: { ...audit, userFinalSelection: "g2" } });
    // createWearEvent
    mockCreate.mockResolvedValueOnce({
      resource: { ...sampleWearEvent(), garmentId: "g2", confirmed: false },
    });
    // incrementWearCount: read garment
    mockRead.mockResolvedValueOnce({ resource: { ...sampleGarment(), id: "g2" } });
    // incrementWearCount: replace garment
    mockReplace.mockResolvedValueOnce({ resource: { ...sampleGarment(), id: "g2", wearCount: 4 } });

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody({ confirmedGarmentId: "g2", confirmed: false }), "user-1"),
      makeContext()
    );

    expect(res.status).toBe(200);

    // PredictionAudit was updated (replace called for audit first)
    expect(mockReplace).toHaveBeenCalledTimes(2);
    const auditReplaced = mockReplace.mock.calls[0][0];
    expect(auditReplaced.userFinalSelection).toBe("g2");

    // WearEvent was created for the corrected garment
    const wearEvt = mockCreate.mock.calls[0][0];
    expect(wearEvt.garmentId).toBe("g2");
    expect(wearEvt.confirmed).toBe(false);
  });

  // ── Invalid JSON ──────────────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const { postWearConfirm } = await import("./postWearConfirm.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/wear/confirm",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await postWearConfirm(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid JSON");
  });

  // ── Missing required fields ───────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody()),
      makeContext()
    );
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 400 when predictionAuditId is missing", async () => {
    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody({ predictionAuditId: "" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("predictionAuditId");
  });

  it("returns 400 when confirmedGarmentId is missing", async () => {
    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody({ confirmedGarmentId: "" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("confirmedGarmentId");
  });

  it("returns 400 when confirmed is not a boolean", async () => {
    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody({ confirmed: "yes" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("confirmed");
  });

  // ── PredictionAudit not found ─────────────────────────────────────────────

  it("returns 404 when PredictionAudit is not found", async () => {
    mockRead.mockResolvedValueOnce({ resource: undefined });

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("PredictionAudit not found");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when readPredictionAudit throws", async () => {
    mockRead.mockRejectedValueOnce(new Error("Cosmos DB unavailable"));

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to confirm");
  });

  it("returns 500 when createWearEvent throws", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleAudit() });
    // readGarment (ownership check)
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockCreate.mockRejectedValueOnce(new Error("Cosmos DB write failed"));

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to confirm");
  });

  // ── S3: IDOR — garment ownership check ───────────────────────────────────

  it("returns 404 when confirmedGarmentId does not belong to the authenticated user", async () => {
    // readPredictionAudit succeeds (audit belongs to user-1)
    mockRead.mockResolvedValueOnce({ resource: sampleAudit() });
    // readGarment returns undefined — garment belongs to a different user
    mockRead.mockResolvedValueOnce({ resource: undefined });

    const { postWearConfirm } = await import("./postWearConfirm.js");
    const res = await postWearConfirm(
      makeRequest(validBody({ confirmedGarmentId: "other-users-garment" }), "user-1"),
      makeContext()
    );

    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("Garment not found");
  });
});
