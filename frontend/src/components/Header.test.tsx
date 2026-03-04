/**
 * Unit tests for Header.tsx — sign-out button interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

const { mockLogoutRedirect } = vi.hoisted(() => ({
  mockLogoutRedirect: vi.fn(),
}));

const { mockClearApiCache } = vi.hoisted(() => ({
  mockClearApiCache: vi.fn(),
}));

const { mockTrackError } = vi.hoisted(() => ({
  mockTrackError: vi.fn(),
}));

vi.mock('../msalConfig', () => ({
  msalInstance: {
    logoutRedirect: mockLogoutRedirect,
  },
  apiScopes: ['api://test/access_as_user'],
  apiBaseUrl: '',
}));

vi.mock('../api', () => ({
  clearApiCache: mockClearApiCache,
}));

vi.mock('../telemetry', () => ({
  trackError: mockTrackError,
}));

import Header from './Header';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogoutRedirect.mockResolvedValue(undefined);
  });

  it('renders the Sign Out button', () => {
    render(React.createElement(Header));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('renders the app title', () => {
    render(React.createElement(Header));
    expect(screen.getByText('Wardrobe Tracker')).toBeInTheDocument();
  });

  it('clears API cache and calls logoutRedirect on click', async () => {
    render(React.createElement(Header));

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockClearApiCache).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(mockLogoutRedirect).toHaveBeenCalledOnce();
    });
  });

  it('clears cache before calling logoutRedirect', async () => {
    const callOrder: string[] = [];
    mockClearApiCache.mockImplementation(() => callOrder.push('clearCache'));
    mockLogoutRedirect.mockImplementation(() => {
      callOrder.push('logout');
      return Promise.resolve();
    });

    render(React.createElement(Header));

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => {
      expect(callOrder).toEqual(['clearCache', 'logout']);
    });
  });

  it('Sign Out button is keyboard accessible', () => {
    render(React.createElement(Header));

    const button = screen.getByRole('button', { name: 'Sign out' });
    button.focus();
    expect(button).toHaveFocus();
  });

  it('calls trackError when logoutRedirect fails', async () => {
    const logoutError = new Error('Logout failed');
    mockLogoutRedirect.mockRejectedValue(logoutError);

    render(React.createElement(Header));

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(logoutError);
    });
  });
});
