/**
 * Unit tests for GarmentDetail.tsx — garment detail page rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./GarmentDetail.module.css', () => ({ default: {} }));

vi.mock('../api', () => ({
  fetchStatsSummary: vi.fn(),
}));

import GarmentDetail from './GarmentDetail';
import { fetchStatsSummary } from '../api';
import type { StatsSummary } from '../api';

const mockFetchStatsSummary = fetchStatsSummary as ReturnType<typeof vi.fn>;

// ── Shared fixture ──────────────────────────────────────────────────────────

const mockStats: StatsSummary = {
  totalGarments: 3,
  totalWearEvents: 15,
  garments: [
    { garmentId: 'g1', name: 'Blue Shirt', category: 'top', wearCount: 5, lastWornDate: '2025-06-01T12:00:00Z' },
    { garmentId: 'g2', name: 'New Dress', category: 'dress', wearCount: 0, lastWornDate: null },
    { garmentId: 'g3', name: 'Favorite Jacket', category: 'outerwear', wearCount: 15, lastWornDate: '2025-06-10T12:00:00Z' },
  ],
  mostWorn: [],
  leastWorn: [],
  forgotten: [],
  streaks: { current: 0, longest: 0 },
  calendar: [],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GarmentDetail', () => {
  let mockOnBack: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnBack = vi.fn<() => void>();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows "Loading…" while data is being fetched', () => {
    // Arrange — return a promise that never resolves
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows "Garment Details" title in loading state', () => {
    // Arrange
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    expect(screen.getByText('Garment Details')).toBeInTheDocument();
  });

  it('header back button calls onBack in loading state', () => {
    // Arrange
    mockFetchStatsSummary.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));
    fireEvent.click(screen.getByLabelText('Back to catalog'));

    // Assert
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it('shows the error message when fetchStatsSummary rejects', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('Network failure'));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const errorText = await screen.findByText('Network failure');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error text when rejection is not an Error instance', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue('string error');

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const errorText = await screen.findByText('Failed to load garment.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows the ⚠️ icon in error state', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('oops'));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const icon = await screen.findByText('⚠️');
    expect(icon).toBeInTheDocument();
  });

  // ── Not found state ──────────────────────────────────────────────────────

  it('shows "Garment not found." when garmentId does not match any garment', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'nonexistent', onBack: mockOnBack }));

    // Assert
    const notFound = await screen.findByText('Garment not found.');
    expect(notFound).toBeInTheDocument();
  });

  // ── Error / not-found action button ──────────────────────────────────────

  it('error state shows "Back to Catalog" button that calls onBack', async () => {
    // Arrange
    mockFetchStatsSummary.mockRejectedValue(new Error('fail'));

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const backBtn = await screen.findByText('Back to Catalog');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('not-found state shows "Back to Catalog" button that calls onBack', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'nonexistent', onBack: mockOnBack }));

    // Assert
    const backBtn = await screen.findByText('Back to Catalog');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  // ── Success state ────────────────────────────────────────────────────────

  it('shows garment name as title', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const title = await screen.findByText('Blue Shirt');
    expect(title).toBeInTheDocument();
  });

  it('shows category badge', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Blue Shirt');
    expect(screen.getByText('top')).toBeInTheDocument();
  });

  it('shows wear count in "Total Wears" stat', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Blue Shirt');
    expect(screen.getByText('Total Wears')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "Wear Statistics" section heading', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    expect(await screen.findByText('Wear Statistics')).toBeInTheDocument();
  });

  it('shows formatted last worn date', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Blue Shirt');
    expect(screen.getByText('Last Worn')).toBeInTheDocument();
    // The formatted date for '2025-06-01T12:00:00Z' — use a regex to match
    // locale-independent parts (Jun 1, 2025 or 1 Jun 2025, etc.)
    expect(screen.getByText(/Jun/)).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('shows "Never" when lastWornDate is null', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g2', onBack: mockOnBack }));

    // Assert
    await screen.findByText('New Dress');
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  // ── Insights section ─────────────────────────────────────────────────────

  it('shows "Insights" section heading', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    expect(await screen.findByText('Insights')).toBeInTheDocument();
  });

  it('shows unworn insight when wearCount is 0', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act — g2 has wearCount 0
    render(React.createElement(GarmentDetail, { garmentId: 'g2', onBack: mockOnBack }));

    // Assert
    await screen.findByText('New Dress');
    expect(
      screen.getByText(/This garment hasn't been worn yet/),
    ).toBeInTheDocument();
  });

  it('shows favorite insight when wearCount >= 10', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act — g3 has wearCount 15
    render(React.createElement(GarmentDetail, { garmentId: 'g3', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Favorite Jacket');
    expect(
      screen.getByText(/This is one of your favorites!/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/15 times/),
    ).toBeInTheDocument();
  });

  it('shows regular wear insight for wearCount between 1 and 9', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act — g1 has wearCount 5
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Blue Shirt');
    expect(
      screen.getByText(/You've worn this 5 times/),
    ).toBeInTheDocument();
  });

  it('uses singular "time" for wearCount of 1', async () => {
    // Arrange — override garments to include a wearCount-1 garment
    const singleWearStats: StatsSummary = {
      ...mockStats,
      garments: [
        { garmentId: 'g-single', name: 'Once Shirt', category: 'top', wearCount: 1, lastWornDate: '2025-06-01T12:00:00Z' },
      ],
    };
    mockFetchStatsSummary.mockResolvedValue(singleWearStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g-single', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Once Shirt');
    expect(
      screen.getByText(/You've worn this 1 time\./),
    ).toBeInTheDocument();
  });

  // ── Back button in actions section ───────────────────────────────────────

  it('"← Back to Catalog" button in actions section calls onBack', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    const backBtn = await screen.findByText('← Back to Catalog');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('header back button calls onBack in success state', async () => {
    // Arrange
    mockFetchStatsSummary.mockResolvedValue(mockStats);

    // Act
    render(React.createElement(GarmentDetail, { garmentId: 'g1', onBack: mockOnBack }));

    // Assert
    await screen.findByText('Blue Shirt');
    fireEvent.click(screen.getByLabelText('Back to catalog'));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});
