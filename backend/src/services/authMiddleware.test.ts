import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpRequest } from "@azure/functions";

describe("authMiddleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── isAuthRequired ────────────────────────────────────────────────────

  it("returns true by default (secure default)", async () => {
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(true);
  });

  it("returns false when REQUIRE_AUTH=false", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(false);
  });

  it("returns true when REQUIRE_AUTH=true", async () => {
    vi.stubEnv("REQUIRE_AUTH", "true");
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(true);
  });

  // ── extractUserId ─────────────────────────────────────────────────────

  it("extracts userId from x-ms-client-principal-id header", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "user-abc" },
      body: { string: JSON.stringify({ userId: "user-body" }) },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    const userId = extractUserId(request);
    expect(userId).toBe("user-abc");
  });

  it("returns null when header is absent (body fallback removed)", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
    });

    const { extractUserId } = await import("./authMiddleware.js");
    const userId = extractUserId(request);
    expect(userId).toBeNull();
  });

  it("returns null when neither header nor body provides userId", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
    });

    const { extractUserId } = await import("./authMiddleware.js");
    const userId = extractUserId(request);
    expect(userId).toBeNull();
  });

  it("trims whitespace from header value", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "  user-abc  " },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("user-abc");
  });

  it("ignores empty header value", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "  " },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    const userId = extractUserId(request);
    expect(userId).toBeNull();
  });

  // ── unauthorizedResponse ──────────────────────────────────────────────

  it("returns 401 response", async () => {
    const { unauthorizedResponse } = await import("./authMiddleware.js");
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.jsonBody.error).toContain("Authentication required");
  });
});
