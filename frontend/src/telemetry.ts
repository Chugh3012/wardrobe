/**
 * Frontend telemetry — Application Insights integration for the PWA.
 *
 * Initialises the Application Insights JavaScript SDK to send:
 *   - Page views (automatic)
 *   - Custom events (e.g. "GarmentAdded", "WearConfirmed")
 *   - Unhandled exceptions (automatic)
 *
 * The connection string is injected at build time via the
 * `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable.
 * When absent (local dev), all telemetry methods are safe no-ops.
 *
 * Security: the connection string is NOT a secret — it only allows
 * writing telemetry to the Application Insights resource, not reading.
 * It is safe to embed in client-side code.
 */

import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsights: ApplicationInsights | null = null;

/**
 * Initialise Application Insights. Call once at app startup (main.tsx).
 * Returns the AI instance for advanced use, or null if not configured.
 */
export function initTelemetry(): ApplicationInsights | null {
  const connectionString = import.meta.env
    .VITE_APPLICATIONINSIGHTS_CONNECTION_STRING as string | undefined;

  if (!connectionString) {
    // Local development — no telemetry
    return null;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      // Auto-collect page views and unhandled exceptions
      enableAutoRouteTracking: false, // we use a SPA with manual page tracking
      disableFetchTracking: false, // track fetch() calls to /api/*
      enableCorsCorrelation: true,
      disableExceptionTracking: false,
      // Sampling: send 100% at the client; server-side adaptive sampling
      // in host.json manages the actual ingestion rate.
      samplingPercentage: 100,
    },
  });

  try {
    appInsights.loadAppInsights();
  } catch {
    // Telemetry must never crash the application.
    appInsights = null;
    return null;
  }
  return appInsights;
}

/**
 * Track a page view with the given name.
 */
export function trackPageView(name: string): void {
  appInsights?.trackPageView({ name });
}

/**
 * Track a custom event with optional properties and measurements.
 */
export function trackCustomEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void {
  appInsights?.trackEvent({ name, properties, measurements });
}

/**
 * Track an exception.
 */
export function trackError(error: Error): void {
  appInsights?.trackException({ exception: error });
}
