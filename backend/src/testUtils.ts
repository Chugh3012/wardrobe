/**
 * Shared test utilities for integration tests.
 *
 * Provides helpers to construct realistic Azure Functions HttpRequest
 * and InvocationContext objects for handler-level testing.
 */

import { HttpRequest, InvocationContext } from "@azure/functions";

/** Encode a userId into a base64 x-ms-client-principal header value (SWA format). */
export function encodeClientPrincipal(userId: string): string {
  return Buffer.from(JSON.stringify({ userId })).toString("base64");
}

/** Build headers object with optional auth. */
export function authHeaders(userId?: string): Record<string, string> {
  if (!userId) return {};
  return { "x-ms-client-principal": encodeClientPrincipal(userId) };
}

/** Create a GET HttpRequest with optional query params and auth. */
export function makeGetRequest(
  path: string,
  opts: { userId?: string; query?: Record<string, string> } = {},
): HttpRequest {
  const params = new URLSearchParams(opts.query ?? {});
  const qs = params.toString();
  return new HttpRequest({
    method: "GET",
    url: `http://localhost:7071${path}${qs ? `?${qs}` : ""}`,
    headers: authHeaders(opts.userId),
  });
}

/** Create a POST HttpRequest with a JSON body and optional auth. */
export function makePostRequest(
  path: string,
  body: unknown,
  opts: { userId?: string; headers?: Record<string, string> } = {},
): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: `http://localhost:7071${path}`,
    headers: {
      "content-type": "application/json",
      ...authHeaders(opts.userId),
      ...opts.headers,
    },
    body: { string: JSON.stringify(body) },
  });
}

/** Create a PATCH HttpRequest with a JSON body and optional auth. */
export function makePatchRequest(
  path: string,
  body: unknown,
  opts: { userId?: string; headers?: Record<string, string> } = {},
): HttpRequest {
  return new HttpRequest({
    method: "PATCH",
    url: `http://localhost:7071${path}`,
    headers: {
      "content-type": "application/json",
      ...authHeaders(opts.userId),
      ...opts.headers,
    },
    body: { string: JSON.stringify(body) },
  });
}

/** Create a DELETE HttpRequest with optional auth. */
export function makeDeleteRequest(
  path: string,
  opts: { userId?: string } = {},
): HttpRequest {
  return new HttpRequest({
    method: "DELETE",
    url: `http://localhost:7071${path}`,
    headers: authHeaders(opts.userId),
  });
}

/** Create a minimal InvocationContext for testing. */
export function makeContext(functionName: string): InvocationContext {
  return new InvocationContext({ functionName });
}

/**
 * Parse a JSON response body from an HttpResponseInit object.
 * Handles both jsonBody (object) and body (string/buffer) formats.
 */
export function parseResponseBody<T = unknown>(response: { jsonBody?: unknown; body?: unknown }): T {
  if (response.jsonBody !== undefined) {
    return response.jsonBody as T;
  }
  if (typeof response.body === "string") {
    return JSON.parse(response.body) as T;
  }
  throw new Error("Response has no parseable body");
}
