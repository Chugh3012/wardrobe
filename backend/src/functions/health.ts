import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Health check requested");

  return {
    status: 200,
    jsonBody: { status: "ok" },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health,
});
