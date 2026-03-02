/**
 * Telemetry service — lightweight wrapper around Application Insights SDK.
 *
 * The Azure Functions runtime auto-initialises Application Insights when
 * `APPLICATIONINSIGHTS_CONNECTION_STRING` is set, providing automatic request
 * tracing, dependency tracking, and exception logging out of the box.
 *
 * This module provides helpers for **custom** telemetry:
 *   - Custom events  (e.g. "WearConfirmed", "PredictionFallback")
 *   - Custom metrics (e.g. prediction confidence, wear counts)
 *
 * When the environment variable is absent (local dev without App Insights),
 * all methods are safe no-ops.
 */

import * as appInsights from "applicationinsights";

let client: appInsights.TelemetryClient | null = null;

/**
 * Returns the shared TelemetryClient, initialising on first call.
 *
 * Returns `null` when `APPLICATIONINSIGHTS_CONNECTION_STRING` is not set
 * (e.g. local development) — callers must handle the null case.
 */
export function getTelemetryClient(): appInsights.TelemetryClient | null {
  if (client) return client;

  const connectionString = process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"];
  if (!connectionString) return null;

  // The Functions runtime may already have started the default client.
  // Check if there's an existing default client before creating a new one.
  if (appInsights.defaultClient) {
    client = appInsights.defaultClient;
    return client;
  }

  // Otherwise, initialise a new client (shouldn't normally happen in Functions).
  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectConsole(true, true)
      .setSendLiveMetrics(true)
      .start();

    client = appInsights.defaultClient;
  } catch {
    // Telemetry must never crash the application. If setup fails
    // (e.g. malformed connection string), we silently degrade.
    return null;
  }
  return client;
}

// ── Custom Events ────────────────────────────────────────────────────────────

export interface TelemetryEventProperties {
  [key: string]: string;
}

export interface TelemetryEventMeasurements {
  [key: string]: number;
}

/**
 * Property keys that must never be sent to telemetry to prevent
 * accidental secret/credential leakage.
 */
const DENIED_PROPERTY_KEYS = /^(token|password|secret|authorization|cookie|key|credential)$/i;

/** Strip denied keys from a properties bag before sending to App Insights. */
function sanitizeProperties(
  props?: TelemetryEventProperties
): TelemetryEventProperties | undefined {
  if (!props) return props;
  const clean: TelemetryEventProperties = {};
  for (const [k, v] of Object.entries(props)) {
    if (!DENIED_PROPERTY_KEYS.test(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Track a named custom event with optional string properties and numeric
 * measurements.
 *
 * Example:
 *   trackEvent("WearConfirmed", { garmentId, userId }, { confidence: 0.92 })
 */
export function trackEvent(
  name: string,
  properties?: TelemetryEventProperties,
  measurements?: TelemetryEventMeasurements
): void {
  const c = getTelemetryClient();
  if (!c) return;
  c.trackEvent({ name, properties: sanitizeProperties(properties), measurements });
}

// ── Custom Metrics ───────────────────────────────────────────────────────────

/**
 * Track a single numeric metric value.
 *
 * Example:
 *   trackMetric("PredictionConfidence", 0.87)
 */
export function trackMetric(name: string, value: number): void {
  const c = getTelemetryClient();
  if (!c) return;
  c.trackMetric({ name, value });
}

// ── Exception Tracking ───────────────────────────────────────────────────────

/**
 * Track an exception with optional custom properties.
 *
 * The Functions runtime already auto-captures unhandled exceptions, but this
 * helper is useful for caught exceptions where you want additional context.
 */
export function trackException(
  error: Error,
  properties?: TelemetryEventProperties
): void {
  const c = getTelemetryClient();
  if (!c) return;
  c.trackException({ exception: error, properties: sanitizeProperties(properties) });
}

// ── Flush ────────────────────────────────────────────────────────────────────

/**
 * Flush all pending telemetry. Useful before a function invocation completes
 * to ensure data is sent to Application Insights.
 */
export async function flushTelemetry(): Promise<void> {
  const c = getTelemetryClient();
  if (!c) return;
  await c.flush();
}
