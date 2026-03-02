import { describe, it, expect, vi } from "vitest";
import { health } from "./health.js";
import { HttpRequest, InvocationContext } from "@azure/functions";

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const request = new HttpRequest({
      method: "GET",
      url: "http://localhost:7071/api/health",
    });

    const context = new InvocationContext({ functionName: "health" });

    const response = await health(request, context);

    expect(response.status).toBe(200);
    expect((response.jsonBody as Record<string, unknown>).status).toBe("ok");
  });
});
