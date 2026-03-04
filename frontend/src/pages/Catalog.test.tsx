/**
 * Unit tests for Catalog.tsx — garment catalog page rendering and interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./Catalog.module.css', () => ({ default: {} }));

vi.mock('../api', () => ({
  fetchGarments: vi.fn(),
}));

import Catalog from './Catalog';
import { fetchGarments } from '../api';
import type { GarmentSummary, GarmentListResponse } from '../api';

const mockFetchGarments = fetchGarments as ReturnType<typeof vi.fn>;

// ── Shared fixtures ─────────────────────────────────────────────────────────

const mockGarments: GarmentSummary[] = [
  { id: 'g1', name: 'Blue Shirt', category: 'top', wearCount: 5, thumbnailUrl: null },
  { id: 'g2', name: 'Red Dress', category: 'dress', wearCount: 3, thumbnailUrl: 'https://example.com/img.jpg' },
];

const mockResponse: GarmentListResponse = {
  garments: mockGarments,
  continuationToken: undefined,
};

const mockResponseWithToken: GarmentListResponse = {
  garments: mockGarments,
  continuationToken: 'next-page-token',
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Catalog', () => {
  let mockOnAdd: ReturnType<typeof vi.fn>;
  let mockOnSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd = vi.fn();
    mockOnSelect = vi.fn();
  });

  // ── Loading state ───────────────────────────────────────────────────────

  it('shows "Loading your garments…" while data is being fetched', () => {
    // Arrange — return a promise that never resolves
    mockFetchGarments.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(screen.getByText('Loading your garments…')).toBeInTheDocument();
  });

  // ── Error state ─────────────────────────────────────────────────────────

  it('shows the error message when fetchGarments rejects with an Error', async () => {
    // Arrange
    mockFetchGarments.mockRejectedValue(new Error('Network failure'));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    const errorText = await screen.findByText('Network failure');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error text when rejection is not an Error instance', async () => {
    // Arrange
    mockFetchGarments.mockRejectedValue('string error');

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    const errorText = await screen.findByText('Failed to load garments.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows the ⚠️ icon in error state', async () => {
    // Arrange
    mockFetchGarments.mockRejectedValue(new Error('oops'));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    const icon = await screen.findByText('⚠️');
    expect(icon).toBeInTheDocument();
  });

  it('clicking "Retry" re-calls fetchGarments', async () => {
    // Arrange — first call fails, second call succeeds
    mockFetchGarments
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Wait for error state to appear
    const retryButton = await screen.findByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Act — click Retry
    fireEvent.click(retryButton);

    // Assert — fetchGarments was called again and the page recovers
    await waitFor(() => {
      expect(mockFetchGarments).toHaveBeenCalledTimes(2);
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows empty state with "Your catalog is empty" when garments array is empty', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue({ garments: [], continuationToken: undefined });

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(await screen.findByText('Your catalog is empty')).toBeInTheDocument();
  });

  it('shows "Add First Garment" button in empty state', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue({ garments: [], continuationToken: undefined });

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(await screen.findByText('Add First Garment')).toBeInTheDocument();
  });

  it('clicking "Add First Garment" calls onAddGarment', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue({ garments: [], continuationToken: undefined });

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    const addButton = await screen.findByText('Add First Garment');
    fireEvent.click(addButton);

    // Assert
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  // ── Add ("+") button ────────────────────────────────────────────────────

  it('clicking the "+" button calls onAddGarment in loading state', () => {
    // Arrange
    mockFetchGarments.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    const addButton = screen.getByRole('button', { name: 'Add new garment' });
    fireEvent.click(addButton);

    // Assert
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  it('clicking the "+" button calls onAddGarment in normal state', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Wait for garments to load
    await screen.findByText('Blue Shirt');

    const addButton = screen.getByRole('button', { name: 'Add new garment' });
    fireEvent.click(addButton);

    // Assert
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  // ── Garment grid rendering ──────────────────────────────────────────────

  it('renders garment cards with name, category, and wear count', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(await screen.findByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
    // category · wearCount wears
    expect(screen.getByText('top · 5 wears')).toBeInTheDocument();
    expect(screen.getByText('dress · 3 wears')).toBeInTheDocument();
  });

  it('renders singular "wear" for a garment with wearCount of 1', async () => {
    // Arrange
    const singleWearGarment: GarmentListResponse = {
      garments: [
        { id: 'g3', name: 'Green Hat', category: 'accessory', wearCount: 1, thumbnailUrl: null },
      ],
      continuationToken: undefined,
    };
    mockFetchGarments.mockResolvedValue(singleWearGarment);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(await screen.findByText('Green Hat')).toBeInTheDocument();
    expect(screen.getByText('accessory · 1 wear')).toBeInTheDocument();
  });

  it('renders an img element when thumbnailUrl is present', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert — Red Dress has a thumbnailUrl
    const img = await screen.findByAltText('Red Dress');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('renders placeholder icon when thumbnailUrl is null', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert — Blue Shirt has thumbnailUrl: null → shows 👗 placeholder
    await screen.findByText('Blue Shirt');
    expect(screen.getByText('👗')).toBeInTheDocument();
  });

  // ── Garment card click ──────────────────────────────────────────────────

  it('clicking a garment card calls onSelectGarment with the garment ID', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Click the garment card (the <li> is the button role element)
    const cards = screen.getAllByRole('button', { name: /./i }).filter(
      (el) => el.tagName === 'LI',
    );

    // Click the first card (Blue Shirt)
    fireEvent.click(cards[0]);

    // Assert
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('g1');
  });

  it('clicking the second garment card calls onSelectGarment with its ID', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Red Dress');

    const cards = screen.getAllByRole('button', { name: /./i }).filter(
      (el) => el.tagName === 'LI',
    );

    // Click the second card (Red Dress)
    fireEvent.click(cards[1]);

    // Assert
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('g2');
  });

  // ── Search bar ──────────────────────────────────────────────────────────

  it('search bar filters garments by name', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Type in the search input
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Blue' } });

    // Assert — Blue Shirt should be visible, Red Dress should not
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Red Dress')).not.toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'blue' } });

    // Assert
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Red Dress')).not.toBeInTheDocument();
  });

  // ── Category filter chips ───────────────────────────────────────────────

  it('renders category filter chips', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Assert — all filter categories are rendered
    const categories = ['All', 'Dress', 'Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];
    for (const cat of categories) {
      expect(screen.getByText(cat)).toBeInTheDocument();
    }
  });

  it('"All" filter chip is active by default (aria-pressed="true")', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Assert
    const allChip = screen.getByText('All');
    expect(allChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a category filter chip filters garments by category', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Click "Top" filter chip
    fireEvent.click(screen.getByText('Top'));

    // Assert — Blue Shirt (category: top) is visible, Red Dress (category: dress) is not
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Red Dress')).not.toBeInTheDocument();
  });

  it('clicking "Dress" filter shows only dress category garments', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Click "Dress" filter chip
    fireEvent.click(screen.getByText('Dress'));

    // Assert — Red Dress is visible, Blue Shirt is not
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
    expect(screen.queryByText('Blue Shirt')).not.toBeInTheDocument();
  });

  it('clicking "All" after a category filter shows all garments again', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Filter to Top only
    fireEvent.click(screen.getByText('Top'));
    expect(screen.queryByText('Red Dress')).not.toBeInTheDocument();

    // Switch back to All
    fireEvent.click(screen.getByText('All'));

    // Assert — both garments are visible again
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
  });

  // ── No matches found ────────────────────────────────────────────────────

  it('shows "No matches found" when search produces no results', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Garment' } });

    // Assert
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('shows "No matches found" when category filter produces no results', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Click "Bottom" — neither garment is a bottom
    fireEvent.click(screen.getByText('Bottom'));

    // Assert
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  // ── Load More ───────────────────────────────────────────────────────────

  it('shows "Load More" button when continuationToken exists', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponseWithToken);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(await screen.findByText('Load More')).toBeInTheDocument();
  });

  it('does NOT show "Load More" when continuationToken is undefined', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');

    // Assert
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('clicking "Load More" calls fetchGarments with the continuationToken', async () => {
    // Arrange — first page has a token, second page has no more
    mockFetchGarments
      .mockResolvedValueOnce(mockResponseWithToken)
      .mockResolvedValueOnce({
        garments: [{ id: 'g3', name: 'Green Hat', category: 'accessory', wearCount: 1, thumbnailUrl: null }],
        continuationToken: undefined,
      });

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    const loadMoreButton = await screen.findByText('Load More');
    fireEvent.click(loadMoreButton);

    // Assert — second call uses the continuation token
    await waitFor(() => {
      expect(mockFetchGarments).toHaveBeenCalledTimes(2);
    });
    expect(mockFetchGarments).toHaveBeenNthCalledWith(2, 20, 'next-page-token');
  });

  it('"Load More" appends new garments to the existing list', async () => {
    // Arrange
    mockFetchGarments
      .mockResolvedValueOnce(mockResponseWithToken)
      .mockResolvedValueOnce({
        garments: [{ id: 'g3', name: 'Green Hat', category: 'accessory', wearCount: 1, thumbnailUrl: null }],
        continuationToken: undefined,
      });

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');
    fireEvent.click(screen.getByText('Load More'));

    // Assert — all garments (original + new) are rendered
    expect(await screen.findByText('Green Hat')).toBeInTheDocument();
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
  });

  // ── Title in all states ─────────────────────────────────────────────────

  it('shows "My Catalog" title in loading state', () => {
    // Arrange
    mockFetchGarments.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    // Assert
    expect(screen.getByText('My Catalog')).toBeInTheDocument();
  });

  it('shows "My Catalog" title in error state', async () => {
    // Arrange
    mockFetchGarments.mockRejectedValue(new Error('fail'));

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('fail');
    expect(screen.getByText('My Catalog')).toBeInTheDocument();
  });

  it('shows "My Catalog" title in normal state', async () => {
    // Arrange
    mockFetchGarments.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(Catalog, { onAddGarment: mockOnAdd, onSelectGarment: mockOnSelect }));

    await screen.findByText('Blue Shirt');
    expect(screen.getByText('My Catalog')).toBeInTheDocument();
  });
});
