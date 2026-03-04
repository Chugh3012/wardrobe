import { defineConfig } from "vitest/config";

/**
 * Integration test configuration.
 *
 * Runs tests matching `*.integration.test.ts` patterns.
 * These tests exercise the full HTTP handler pipeline with mocked
 * external services (Cosmos, Blob, Custom Vision, AI Vision).
 *
 * Unlike unit tests (which mock at the module level), integration tests
 * call the Azure Functions handler directly with realistic HttpRequest
 * objects and verify the full response — status, headers, body shape.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
  },
});
