import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the applicationinsights module before importing the service
const mockTrackEvent = vi.fn();
const mockTrackMetric = vi.fn();
const mockTrackException = vi.fn();
const mockFlush = vi.fn().mockResolvedValue(undefined);

const mockClient = {
  trackEvent: mockTrackEvent,
  trackMetric: mockTrackMetric,
  trackException: mockTrackException,
  flush: mockFlush,
};

vi.mock("applicationinsights", () => ({
  default: {
    defaultClient: null,
    setup: vi.fn().mockReturnThis(),
    setAutoCollectRequests: vi.fn().mockReturnThis(),
    setAutoCollectDependencies: vi.fn().mockReturnThis(),
    setAutoCollectExceptions: vi.fn().mockReturnThis(),
    setAutoCollectPerformance: vi.fn().mockReturnThis(),
    setAutoCollectConsole: vi.fn().mockReturnThis(),
    setSendLiveMetrics: vi.fn().mockReturnThis(),
    start: vi.fn(),
  },
  defaultClient: null,
  setup: vi.fn().mockReturnThis(),
  setAutoCollectRequests: vi.fn().mockReturnThis(),
  setAutoCollectDependencies: vi.fn().mockReturnThis(),
  setAutoCollectExceptions: vi.fn().mockReturnThis(),
  setAutoCollectPerformance: vi.fn().mockReturnThis(),
  setAutoCollectConsole: vi.fn().mockReturnThis(),
  setSendLiveMetrics: vi.fn().mockReturnThis(),
  start: vi.fn(),
}));

describe("telemetryService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockTrackEvent.mockClear();
    mockTrackMetric.mockClear();
    mockTrackException.mockClear();
    mockFlush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getTelemetryClient", () => {
    it("returns null when APPLICATIONINSIGHTS_CONNECTION_STRING is not set", async () => {
      vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
      const { getTelemetryClient } = await import("./telemetryService.js");
      expect(getTelemetryClient()).toBeNull();
    });

    it("returns null when env var is undefined", async () => {
      delete process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"];
      const { getTelemetryClient } = await import("./telemetryService.js");
      expect(getTelemetryClient()).toBeNull();
    });

    it("returns the default client when it exists", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      // Patch the mock module to have a defaultClient
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { getTelemetryClient } = await import("./telemetryService.js");
      const client = getTelemetryClient();
      expect(client).toBe(mockClient);
    });

    it("returns null when setup().start() throws (malformed connection string)", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "bad-connection-string"
      );
      const appInsights = await import("applicationinsights");
      // No defaultClient — force the fallback path
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = null;
      // Make setup throw to simulate a malformed connection string
      (appInsights.setup as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error("Invalid connection string");
      });

      const { getTelemetryClient } = await import("./telemetryService.js");
      const result = getTelemetryClient();
      expect(result).toBeNull();
    });
  });

  describe("trackEvent (no connection string)", () => {
    it("is a no-op when App Insights is not configured", async () => {
      vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
      const { trackEvent } = await import("./telemetryService.js");
      // Should not throw
      trackEvent("TestEvent", { key: "value" }, { metric: 1 });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe("trackEvent (with connection string)", () => {
    it("delegates to the TelemetryClient", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { trackEvent } = await import("./telemetryService.js");
      trackEvent("WearConfirmed", { garmentId: "g1" }, { confidence: 0.9 });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "WearConfirmed",
        properties: { garmentId: "g1" },
        measurements: { confidence: 0.9 },
      });
    });

    it("sanitizes denied property keys before sending", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { trackEvent } = await import("./telemetryService.js");
      trackEvent("TestEvent", {
        userId: "u1",
        token: "should-be-stripped",
        password: "should-be-stripped",
        secret: "should-be-stripped",
        authorization: "should-be-stripped",
        cookie: "should-be-stripped",
        endpoint: "POST /garments",
      });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "TestEvent",
        properties: { userId: "u1", endpoint: "POST /garments" },
        measurements: undefined,
      });
    });
  });

  describe("trackMetric (no connection string)", () => {
    it("is a no-op when App Insights is not configured", async () => {
      vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
      const { trackMetric } = await import("./telemetryService.js");
      trackMetric("PredictionConfidence", 0.87);
      expect(mockTrackMetric).not.toHaveBeenCalled();
    });
  });

  describe("trackMetric (with connection string)", () => {
    it("delegates to the TelemetryClient", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { trackMetric } = await import("./telemetryService.js");
      trackMetric("PredictionConfidence", 0.87);

      expect(mockTrackMetric).toHaveBeenCalledWith({
        name: "PredictionConfidence",
        value: 0.87,
      });
    });
  });

  describe("trackException (no connection string)", () => {
    it("is a no-op when App Insights is not configured", async () => {
      vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
      const { trackException } = await import("./telemetryService.js");
      trackException(new Error("test"));
      expect(mockTrackException).not.toHaveBeenCalled();
    });
  });

  describe("trackException (with connection string)", () => {
    it("delegates to the TelemetryClient", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { trackException } = await import("./telemetryService.js");
      const error = new Error("Something failed");
      trackException(error, { endpoint: "POST /garments" });

      expect(mockTrackException).toHaveBeenCalledWith({
        exception: error,
        properties: { endpoint: "POST /garments" },
      });
    });

    it("sanitizes denied property keys in exception properties", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { trackException } = await import("./telemetryService.js");
      const error = new Error("Auth failed");
      trackException(error, {
        endpoint: "POST /garments",
        authorization: "Bearer xxx",
        credential: "should-be-stripped",
      });

      expect(mockTrackException).toHaveBeenCalledWith({
        exception: error,
        properties: { endpoint: "POST /garments" },
      });
    });
  });

  describe("flushTelemetry", () => {
    it("is a no-op when App Insights is not configured", async () => {
      vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
      const { flushTelemetry } = await import("./telemetryService.js");
      await flushTelemetry(); // should resolve without error
      expect(mockFlush).not.toHaveBeenCalled();
    });

    it("calls flush on the client when configured", async () => {
      vi.stubEnv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/"
      );
      const appInsights = await import("applicationinsights");
      (appInsights as unknown as { defaultClient: unknown }).defaultClient = mockClient;

      const { flushTelemetry } = await import("./telemetryService.js");
      await flushTelemetry();

      expect(mockFlush).toHaveBeenCalled();
    });
  });
});
