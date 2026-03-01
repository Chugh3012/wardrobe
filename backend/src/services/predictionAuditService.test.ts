import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetClient } from "./cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockFetchAll = vi.fn();
const mockQuery = vi.fn(() => ({ fetchAll: mockFetchAll }));

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("predictionAuditService", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("createPredictionAudit returns an audit with generated id and createdAt", async () => {
    const auditDoc = {
      id: "audit-1",
      userId: "user-1",
      inputImageUrl: "https://example.com/outfit.jpg",
      topKPredictions: [
        { garmentId: "garm-1", confidence: 0.92 },
        { garmentId: "garm-2", confidence: 0.75 },
      ],
      userFinalSelection: "garm-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: auditDoc });

    const { createPredictionAudit } = await import("./predictionAuditService.js");
    const result = await createPredictionAudit({
      userId: "user-1",
      inputImageUrl: "https://example.com/outfit.jpg",
      topKPredictions: [
        { garmentId: "garm-1", confidence: 0.92 },
        { garmentId: "garm-2", confidence: 0.75 },
      ],
      userFinalSelection: "garm-1",
    });

    expect(result).toEqual(auditDoc);
    expect(mockCreate).toHaveBeenCalledOnce();
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.userId).toBe("user-1");
    expect(arg.topKPredictions).toHaveLength(2);
    expect(arg.id).toBeTruthy();
    expect(arg.createdAt).toBeTruthy();
  });

  it("readPredictionAudit returns the audit when found", async () => {
    const auditDoc = { id: "audit-1", userId: "user-1" };
    mockRead.mockResolvedValue({ resource: auditDoc });

    const { readPredictionAudit } = await import("./predictionAuditService.js");
    const result = await readPredictionAudit("audit-1", "user-1");

    expect(result).toEqual(auditDoc);
  });

  it("readPredictionAudit returns undefined when not found (404)", async () => {
    mockRead.mockRejectedValue({ code: 404 });

    const { readPredictionAudit } = await import("./predictionAuditService.js");
    const result = await readPredictionAudit("nonexistent", "user-1");

    expect(result).toBeUndefined();
  });

  it("listPredictionAudits returns all audits for a userId", async () => {
    const audits = [{ id: "audit-1", userId: "user-1" }];
    mockFetchAll.mockResolvedValue({ resources: audits });

    const { listPredictionAudits } = await import("./predictionAuditService.js");
    const result = await listPredictionAudits("user-1");

    expect(result).toEqual(audits);
    expect(mockQuery).toHaveBeenCalledWith({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: "user-1" }],
    });
  });
});
