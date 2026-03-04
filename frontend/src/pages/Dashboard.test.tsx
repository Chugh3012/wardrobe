/**
 * Unit tests for Dashboard.tsx — error state retry button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('../telemetry', () => ({
  initTelemetry: vi.fn(),
  trackPageView: vi.fn(),
  trackCustomEvent: vi.fn(),
  trackError: vi.fn(),
}));

const { mockFetchStatsSummary } = vi.hoisted(() => ({
  mockFetchStatsSummary: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchStatsSummary: mockFetchStatsSummary,
}));

import Dashboard from './Dashboard';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));
    render(React.createElement(Dashboard));
    expect(screen.getByText('Loading stats…')).toBeInTheDocument();
  });

  it('shows error state with Retry button when fetch fails', async () => {
    mockFetchStatsSummary.mockRejectedValue(new Error('Network error'));
    render(React.createElement(Dashboard));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('re-fetches stats when Retry button is clicked', async () => {
    // First call fails
    mockFetchStatsSummary.mockRejectedValueOnce(new Error('Network error'));

    render(React.createElement(Dashboard));

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Set up success for retry
    mockFetchStatsSummary.mockResolvedValueOnce({
      totalGarments: 5,
      totalWearEvents: 10,
      garments: [],
      mostWorn: [],
      leastWorn: [],
      forgotten: [],
      streaks: { current: 1, longest: 3 },
      calendar: [],
    });

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Should show stats after successful retry
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(mockFetchStatsSummary).toHaveBeenCalledTimes(2);
  });

  it('shows loading state during retry attempt', async () => {
    // First call fails
    mockFetchStatsSummary.mockRejectedValueOnce(new Error('Network error'));

    render(React.createElement(Dashboard));

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Set up a pending promise for retry to keep loading state visible
    mockFetchStatsSummary.mockReturnValueOnce(new Promise(() => {}));

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Loading stats…')).toBeInTheDocument();
    });
  });
});
