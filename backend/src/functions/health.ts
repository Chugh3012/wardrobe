import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Health check requested");

  // ── Temporary diagnostic: decode x-ms-client-principal ──────────────
  const principalHeader = request.headers.get("x-ms-client-principal");
  let decodedPrincipal: unknown = null;
  if (principalHeader) {
    try {
      const json = Buffer.from(principalHeader, "base64").toString("utf8");
      decodedPrincipal = JSON.parse(json);
    } catch {
      decodedPrincipal = "DECODE_ERROR";
    }
  }

  return {
    status: 200,
    jsonBody: {
      status: "ok",
      _diag: {
        hasPrincipalHeader: !!principalHeader,
        hasPrincipalIdHeader: !!request.headers.get("x-ms-client-principal-id"),
        decodedPrincipal,
      },
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health,
});
