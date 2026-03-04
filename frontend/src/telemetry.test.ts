/**
 * Unit tests for the frontend telemetry module.
 *
 * Verifies that:
 *   - trackCustomEvent strips denied property keys (defense-in-depth sanitization)
 *   - trackCustomEvent passes safe properties through unchanged
 *   - All functions are safe no-ops when App Insights is not configured
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @microsoft/applicationinsights-web before importing telemetry ────────
// vi.hoisted ensures these refs are available inside the hoisted vi.mock factory.

const { mockTrackEvent, mockTrackPageView, mockTrackException, mockLoadAppInsights } = vi.hoisted(
  () => ({
    mockTrackEvent: vi.fn(),
    mockTrackPageView: vi.fn(),
    mockTrackException: vi.fn(),
    mockLoadAppInsights: vi.fn(),
  })
);

vi.mock('@microsoft/applicationinsights-web', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ApplicationInsights: vi.fn(function (this: any) {
    this.loadAppInsights = mockLoadAppInsights;
    this.trackEvent = mockTrackEvent;
    this.trackPageView = mockTrackPageView;
    this.trackException = mockTrackException;
  }),
}));

describe('telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    mockTrackEvent.mockClear();
    mockTrackPageView.mockClear();
    mockTrackException.mockClear();
    mockLoadAppInsights.mockClear();
  });

  describe('trackCustomEvent (App Insights not configured)', () => {
    it('is a no-op when connection string is absent', async () => {
      // No VITE_APPLICATIONINSIGHTS_CONNECTION_STRING set
      const { trackCustomEvent } = await import('./telemetry');
      trackCustomEvent('TestEvent', { userId: 'u1' });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('trackCustomEvent (App Insights configured)', () => {
    async function setupWithAppInsights() {
      vi.stubEnv('VITE_APPLICATIONINSIGHTS_CONNECTION_STRING', 'InstrumentationKey=test-key;IngestionEndpoint=https://test.in.ai.azure.com/');
      const { initTelemetry, trackCustomEvent } = await import('./telemetry');
      initTelemetry();
      return { trackCustomEvent };
    }

    it('passes safe properties through unchanged', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('GarmentAdded', { garmentId: 'g1', page: 'AddGarment' }, { count: 1 });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'GarmentAdded',
        properties: { garmentId: 'g1', page: 'AddGarment' },
        measurements: { count: 1 },
      });
    });

    it('strips "token" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { token: 'secret-value', page: 'Dashboard' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { page: 'Dashboard' },
        measurements: undefined,
      });
    });

    it('strips "password" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { password: 'hunter2', userId: 'u1' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { userId: 'u1' },
        measurements: undefined,
      });
    });

    it('strips "secret" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { secret: 'shhh', action: 'login' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { action: 'login' },
        measurements: undefined,
      });
    });

    it('strips "authorization" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { authorization: 'Bearer xxx', action: 'upload' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { action: 'upload' },
        measurements: undefined,
      });
    });

    it('strips "cookie" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { cookie: 'session=abc', page: 'History' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { page: 'History' },
        measurements: undefined,
      });
    });

    it('strips "key" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { key: 'api-key-value', page: 'Catalog' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { page: 'Catalog' },
        measurements: undefined,
      });
    });

    it('strips "credential" from properties', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', { credential: 'some-cred', event: 'WearConfirmed' });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { event: 'WearConfirmed' },
        measurements: undefined,
      });
    });

    it('strips all denied keys case-insensitively', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent', {
        Token: 'should-strip',
        PASSWORD: 'should-strip',
        Secret: 'should-strip',
        Authorization: 'should-strip',
        Cookie: 'should-strip',
        Key: 'should-strip',
        Credential: 'should-strip',
        safeProperty: 'keep-this',
      });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: { safeProperty: 'keep-this' },
        measurements: undefined,
      });
    });

    it('passes through undefined properties as-is', async () => {
      const { trackCustomEvent } = await setupWithAppInsights();
      trackCustomEvent('TestEvent');

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'TestEvent',
        properties: undefined,
        measurements: undefined,
      });
    });
  });

  describe('trackPageView', () => {
    it('is a no-op when not configured', async () => {
      const { trackPageView } = await import('./telemetry');
      trackPageView('Dashboard');
      expect(mockTrackPageView).not.toHaveBeenCalled();
    });
  });

  describe('trackError', () => {
    it('is a no-op when not configured', async () => {
      const { trackError } = await import('./telemetry');
      trackError(new Error('test error'));
      expect(mockTrackException).not.toHaveBeenCalled();
    });
  });
});
