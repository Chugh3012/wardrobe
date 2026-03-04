/**
 * Unit tests for Dashboard.tsx — stats dashboard rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./Dashboard.module.css', () => ({ default: {} }));

vi.mock('../telemetry', () => ({
  trackPageView: vi.fn(),
  trackCustomEvent: vi.fn(),
  trackError: vi.fn(),
  initTelemetry: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchStatsSummary: vi.fn(),
}));

import Dashboard from './Dashboard';
import { fetchStatsSummary } from '../api';
import type { StatsSummary } from '../api';

const mockFetchStatsSummary = fetchStatsSummary as ReturnType<typeof vi.fn>;

// ── Shared fixture ──────────────────────────────────────────────────────────

const mockStats: StatsSummary = {
  totalGarments: 5,
  totalWearEvents: 20,
  garments: [],
  mostWorn: [{ garmentId: 'g1', name: 'Blue Shirt', wearCount: 10 }],
  leastWorn: [{ garmentId: 'g2', name: 'Red Pants', wearCount: 1 }],
  forgotten: [
    {
      garmentId: 'g3',
      name: 'Old Hat',
      category: 'accessory',
      lastWornDate: '2025-01-01',
      daysSinceWorn: 60,
    },
  ],
  streaks: { current: 3, longest: 7 },
  calendar: [{ date: '2025-06-01', count: 2 }],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows "Loading stats…" while data is being fetched', () => {
    // Arrange — return a promise that never resolves
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(screen.getByText('Loading stats…')).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it('shows the error message when fetchStatsSummary rejects', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('Network failure'));

    // Act
    render(React.createElement(Dashboard));

    // Assert
    const errorText = await screen.findByText('Network failure');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error text when rejection is not an Error instance', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue('string error');

    // Act
    render(React.createElement(Dashboard));

    // Assert
    const errorText = await screen.findByText('Failed to load stats.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows the ⚠️ icon in error state', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('oops'));

    // Act
    render(React.createElement(Dashboard));

    // Assert
    const icon = await screen.findByText('⚠️');
    expect(icon).toBeInTheDocument();
  });

  // ── Title in all states ──────────────────────────────────────────────────

  it('shows "My Wardrobe" title in loading state', () => {
    // Arrange
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(screen.getByText('My Wardrobe')).toBeInTheDocument();
  });

  it('shows "My Wardrobe" title in error state', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('fail'));

    // Act
    render(React.createElement(Dashboard));

    // Assert
    await screen.findByText('fail');
    expect(screen.getByText('My Wardrobe')).toBeInTheDocument();
  });

  it('shows "My Wardrobe" title in success state', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    const title = await screen.findByText('My Wardrobe');
    expect(title).toBeInTheDocument();
  });

  // ── Streaks section ──────────────────────────────────────────────────────

  it('renders streaks section with current and longest streak values', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('🔥 Wear Streaks')).toBeInTheDocument();
    expect(screen.getByText('Current Streak')).toBeInTheDocument();
    expect(screen.getByText('Longest Streak')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  // ── Overview section ─────────────────────────────────────────────────────

  it('renders overview with total items and total wears counts', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Total Wears')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  // ── Most Worn section ────────────────────────────────────────────────────

  it('renders "Most Worn" section with garment names and wear counts', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('Most Worn')).toBeInTheDocument();
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('10 wears')).toBeInTheDocument();
  });

  it('shows "No wear data yet." when mostWorn is empty', async () => {
    // Arrange
    const emptyMostWorn: StatsSummary = { ...mockStats, mostWorn: [] };
    mockFetchStatsSummary.mockResolvedValue(emptyMostWorn);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('No wear data yet.')).toBeInTheDocument();
  });

  it('renders singular "wear" for a garment with wearCount of 1 in mostWorn', async () => {
    // Arrange — override both mostWorn and leastWorn to avoid duplicate "1 wear" text
    const singleWear: StatsSummary = {
      ...mockStats,
      mostWorn: [{ garmentId: 'g9', name: 'Solo Shirt', wearCount: 1 }],
      leastWorn: [],
    };
    mockFetchStatsSummary.mockResolvedValue(singleWear);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('Solo Shirt')).toBeInTheDocument();
    expect(screen.getByText('1 wear')).toBeInTheDocument();
  });

  // ── Least Worn section ───────────────────────────────────────────────────

  it('renders "Least Worn" section with garment names when leastWorn is non-empty', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('Least Worn')).toBeInTheDocument();
    expect(screen.getByText('Red Pants')).toBeInTheDocument();
    expect(screen.getByText('1 wear')).toBeInTheDocument();
  });

  it('shows empty-state message when leastWorn is empty', async () => {
    // Arrange
    const emptyLeastWorn: StatsSummary = { ...mockStats, leastWorn: [] };
    mockFetchStatsSummary.mockResolvedValue(emptyLeastWorn);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(
      await screen.findByText('Add garments and track outfits to see insights here.'),
    ).toBeInTheDocument();
  });

  // ── Forgotten Garments section ───────────────────────────────────────────

  it('renders "Forgotten Garments" section when forgotten array has items', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('💤 Forgotten Garments')).toBeInTheDocument();
    expect(screen.getByText('Items not worn in 30+ days')).toBeInTheDocument();
    expect(screen.getByText('Old Hat')).toBeInTheDocument();
    expect(screen.getByText('accessory')).toBeInTheDocument();
    expect(screen.getByText('60 days ago')).toBeInTheDocument();
  });

  it('does NOT render forgotten section when forgotten array is empty', async () => {
    // Arrange
    const noForgotten: StatsSummary = { ...mockStats, forgotten: [] };
    mockFetchStatsSummary.mockResolvedValue(noForgotten);

    // Act
    render(React.createElement(Dashboard));

    // Assert — wait for the page to settle by checking a known success-state element
    await screen.findByText('Overview');
    expect(screen.queryByText('💤 Forgotten Garments')).not.toBeInTheDocument();
  });

  it('shows "Never worn" for a forgotten garment with null daysSinceWorn', async () => {
    // Arrange
    const neverWorn: StatsSummary = {
      ...mockStats,
      forgotten: [
        {
          garmentId: 'g4',
          name: 'Unworn Scarf',
          category: 'accessory',
          lastWornDate: null,
          daysSinceWorn: null,
        },
      ],
    };
    mockFetchStatsSummary.mockResolvedValue(neverWorn);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('Never worn')).toBeInTheDocument();
    expect(screen.getByText('Unworn Scarf')).toBeInTheDocument();
  });

  // ── Activity Calendar section ────────────────────────────────────────────

  it('renders activity calendar section when calendar data is present', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(Dashboard));

    // Assert
    expect(await screen.findByText('📅 Activity (90 days)')).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('does NOT render activity calendar when calendar array is empty', async () => {
    // Arrange
    const noCalendar: StatsSummary = { ...mockStats, calendar: [] };
    mockFetchStatsSummary.mockResolvedValue(noCalendar);

    // Act
    render(React.createElement(Dashboard));

    // Assert — wait for success state
    await screen.findByText('Overview');
    expect(screen.queryByText('📅 Activity (90 days)')).not.toBeInTheDocument();
  });
});
