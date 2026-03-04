/**
 * Unit tests for App.tsx — authentication flow and page rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./telemetry', () => ({
  initTelemetry: vi.fn(),
  trackPageView: vi.fn(),
  trackCustomEvent: vi.fn(),
  trackError: vi.fn(),
}));

// Use vi.hoisted so mock fns are available inside vi.mock factories (hoisted above imports)
const {
  mockGetAllAccounts,
  mockInitialize,
  mockHandleRedirectPromise,
  mockLoginRedirect,
} = vi.hoisted(() => ({
  mockGetAllAccounts: vi.fn(),
  mockInitialize: vi.fn(),
  mockHandleRedirectPromise: vi.fn(),
  mockLoginRedirect: vi.fn(),
}));

vi.mock('./msalConfig', () => ({
  msalInstance: {
    getAllAccounts: mockGetAllAccounts,
    initialize: mockInitialize,
    handleRedirectPromise: mockHandleRedirectPromise,
    loginRedirect: mockLoginRedirect,
  },
  apiScopes: ['api://test/access_as_user'],
  apiBaseUrl: '',
}));

// Mock all page components — use React.createElement to avoid JSX in hoisted scope
vi.mock('./pages/Dashboard', () => ({ default: () => React.createElement('div', { 'data-testid': 'dashboard' }, 'Dashboard') }));
vi.mock('./pages/Catalog', () => ({ default: () => React.createElement('div', { 'data-testid': 'catalog' }, 'Catalog') }));
vi.mock('./pages/AddGarment', () => ({ default: () => React.createElement('div', { 'data-testid': 'add-garment' }, 'AddGarment') }));
vi.mock('./pages/DailyUpload', () => ({ default: () => React.createElement('div', { 'data-testid': 'daily-upload' }, 'DailyUpload') }));
vi.mock('./pages/History', () => ({ default: () => React.createElement('div', { 'data-testid': 'history' }, 'History') }));
vi.mock('./pages/GarmentDetail', () => ({ default: () => React.createElement('div', { 'data-testid': 'garment-detail' }, 'GarmentDetail') }));
vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'layout' }, children),
}));

// Ensure VITE_SKIP_AUTH is NOT set so the MSAL auth path runs in these tests
vi.stubEnv('VITE_SKIP_AUTH', '');

import App from './App';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('App (MSAL auth flow — default)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SKIP_AUTH', '');
  });

  it('shows signing-in state before MSAL resolves', () => {
    mockInitialize.mockReturnValue(new Promise(() => {}));
    render(React.createElement(App));
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
  });

  it('renders Dashboard after successful MSAL init', async () => {
    mockInitialize.mockResolvedValue(undefined);
    mockHandleRedirectPromise.mockResolvedValue(null);
    mockGetAllAccounts.mockReturnValue([{ username: 'user@test.com' }]);

    render(React.createElement(App));

    const dashboard = await screen.findByTestId('dashboard');
    expect(dashboard).toBeInTheDocument();
  });

  it('renders inside Layout wrapper after auth', async () => {
    mockInitialize.mockResolvedValue(undefined);
    mockHandleRedirectPromise.mockResolvedValue(null);
    mockGetAllAccounts.mockReturnValue([{ username: 'user@test.com' }]);

    render(React.createElement(App));

    const layout = await screen.findByTestId('layout');
    expect(layout).toBeInTheDocument();
  });

  it('shows error state on MSAL failure', async () => {
    mockInitialize.mockRejectedValue(new Error('MSAL init failed'));

    render(React.createElement(App));

    const error = await screen.findByText('Authentication error');
    expect(error).toBeInTheDocument();
  });
});
