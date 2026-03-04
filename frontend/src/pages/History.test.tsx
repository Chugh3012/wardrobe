/**
 * Unit tests for History.tsx — wear history page rendering and interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./History.module.css', () => ({ default: {} }));

vi.mock('../api', () => ({
  fetchWearHistory: vi.fn(),
}));

import History from './History';
import { fetchWearHistory } from '../api';
import type { WearHistoryEvent, WearHistoryResponse } from '../api';

const mockFetchWearHistory = fetchWearHistory as ReturnType<typeof vi.fn>;

// ── Shared fixtures ─────────────────────────────────────────────────────────

const today = new Date().toISOString();

const mockEvents: WearHistoryEvent[] = [
  {
    id: 'e1',
    garmentId: 'g1',
    garmentName: 'Blue Shirt',
    category: 'top',
    outfitImageUrl: 'https://example.com/img1.jpg',
    confidence: 0.95,
    createdAt: today,
  },
  {
    id: 'e2',
    garmentId: 'g2',
    garmentName: 'Red Dress',
    category: 'dress',
    outfitImageUrl: '',
    confidence: 0.7,
    createdAt: today,
  },
];

const mockResponse: WearHistoryResponse = {
  events: mockEvents,
  continuationToken: undefined,
};

const mockResponseWithToken: WearHistoryResponse = {
  events: mockEvents,
  continuationToken: 'next-page-token',
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ───────────────────────────────────────────────────────

  it('shows "Loading history…" while data is being fetched', () => {
    // Arrange — return a promise that never resolves
    mockFetchWearHistory.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(History));

    // Assert
    expect(screen.getByText('Loading history…')).toBeInTheDocument();
  });

  // ── Title in all states ─────────────────────────────────────────────────

  it('shows "Outfit History" title in loading state', () => {
    // Arrange
    mockFetchWearHistory.mockReturnValue(new Promise(() => {}));

    // Act
    render(React.createElement(History));

    // Assert
    expect(screen.getByText('Outfit History')).toBeInTheDocument();
  });

  it('shows "Outfit History" title in error state', async () => {
    // Arrange
    mockFetchWearHistory.mockRejectedValue(new Error('fail'));

    // Act
    render(React.createElement(History));

    // Assert
    await screen.findByText('fail');
    expect(screen.getByText('Outfit History')).toBeInTheDocument();
  });

  it('shows "Outfit History" title in empty state', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue({ events: [], continuationToken: undefined });

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('No outfit history yet')).toBeInTheDocument();
    expect(screen.getByText('Outfit History')).toBeInTheDocument();
  });

  it('shows "Outfit History" title in success state', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert
    const title = await screen.findByText('Outfit History');
    expect(title).toBeInTheDocument();
  });

  // ── Error state ─────────────────────────────────────────────────────────

  it('shows the error message when fetchWearHistory rejects with an Error', async () => {
    // Arrange
    mockFetchWearHistory.mockRejectedValue(new Error('Network failure'));

    // Act
    render(React.createElement(History));

    // Assert
    const errorText = await screen.findByText('Network failure');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error text when rejection is not an Error instance', async () => {
    // Arrange
    mockFetchWearHistory.mockRejectedValue('string error');

    // Act
    render(React.createElement(History));

    // Assert
    const errorText = await screen.findByText('Failed to load history.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows the ⚠️ icon in error state', async () => {
    // Arrange
    mockFetchWearHistory.mockRejectedValue(new Error('oops'));

    // Act
    render(React.createElement(History));

    // Assert
    const icon = await screen.findByText('⚠️');
    expect(icon).toBeInTheDocument();
  });

  it('clicking "Retry" re-calls fetchWearHistory', async () => {
    // Arrange — first call fails, second call succeeds
    mockFetchWearHistory
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce(mockResponse);

    // Act
    render(React.createElement(History));

    // Wait for error state to appear
    const retryButton = await screen.findByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Act — click Retry
    fireEvent.click(retryButton);

    // Assert — fetchWearHistory was called again and the page recovers
    await waitFor(() => {
      expect(mockFetchWearHistory).toHaveBeenCalledTimes(2);
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows "No outfit history yet" when events array is empty', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue({ events: [], continuationToken: undefined });

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('No outfit history yet')).toBeInTheDocument();
  });

  it('shows hint text "Start uploading daily outfits to build your timeline."', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue({ events: [], continuationToken: undefined });

    // Act
    render(React.createElement(History));

    // Assert
    expect(
      await screen.findByText('Start uploading daily outfits to build your timeline.'),
    ).toBeInTheDocument();
  });

  // ── Success state — garment rendering ─────────────────────────────────

  it('renders garment names in the event list', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
  });

  it('renders category badges', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('top')).toBeInTheDocument();
    expect(screen.getByText('dress')).toBeInTheDocument();
  });

  it('renders confidence percentages', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert — 0.95 → "95% match", 0.7 → "70% match"
    expect(await screen.findByText('95% match')).toBeInTheDocument();
    expect(screen.getByText('70% match')).toBeInTheDocument();
  });

  it('shows outfit images when outfitImageUrl is present', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert — Blue Shirt has an image URL
    const img = await screen.findByAltText('Outfit: Blue Shirt');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/img1.jpg');
  });

  it('shows placeholder when outfitImageUrl is empty', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert — Red Dress has empty outfitImageUrl → shows 📷 placeholder
    await screen.findByText('Blue Shirt');
    expect(screen.getByText('📷')).toBeInTheDocument();
  });

  // ── Load More ─────────────────────────────────────────────────────────

  it('shows "Load More" button when continuationToken exists', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponseWithToken);

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('Load More')).toBeInTheDocument();
  });

  it('does NOT show "Load More" when continuationToken is undefined', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Wait for success state
    await screen.findByText('Blue Shirt');

    // Assert
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('clicking "Load More" calls fetchWearHistory with the continuation token', async () => {
    // Arrange — first page has a token, second page has no more
    mockFetchWearHistory
      .mockResolvedValueOnce(mockResponseWithToken)
      .mockResolvedValueOnce({
        events: [
          {
            id: 'e3',
            garmentId: 'g3',
            garmentName: 'Green Hat',
            category: 'accessory',
            outfitImageUrl: '',
            confidence: 0.85,
            createdAt: today,
          },
        ],
        continuationToken: undefined,
      });

    // Act
    render(React.createElement(History));

    const loadMoreButton = await screen.findByText('Load More');
    fireEvent.click(loadMoreButton);

    // Assert — second call uses the continuation token
    await waitFor(() => {
      expect(mockFetchWearHistory).toHaveBeenCalledTimes(2);
    });
    expect(mockFetchWearHistory).toHaveBeenNthCalledWith(2, 20, 'next-page-token');
  });

  it('"Load More" appends new events to the existing list', async () => {
    // Arrange
    mockFetchWearHistory
      .mockResolvedValueOnce(mockResponseWithToken)
      .mockResolvedValueOnce({
        events: [
          {
            id: 'e3',
            garmentId: 'g3',
            garmentName: 'Green Hat',
            category: 'accessory',
            outfitImageUrl: '',
            confidence: 0.85,
            createdAt: today,
          },
        ],
        continuationToken: undefined,
      });

    // Act
    render(React.createElement(History));

    await screen.findByText('Blue Shirt');
    fireEvent.click(screen.getByText('Load More'));

    // Assert — all events (original + new) are rendered
    expect(await screen.findByText('Green Hat')).toBeInTheDocument();
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
  });

  // ── Date grouping ─────────────────────────────────────────────────────

  it('groups events by date showing "Today" for events created today', async () => {
    // Arrange
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert — both events have today's date, so "Today" should appear
    expect(await screen.findByText('Today')).toBeInTheDocument();
  });

  it('shows "Yesterday" for events created one day ago', async () => {
    // Arrange — create events dated yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString();

    const yesterdayEvents: WearHistoryEvent[] = [
      {
        id: 'e10',
        garmentId: 'g10',
        garmentName: 'Yesterday Shirt',
        category: 'top',
        outfitImageUrl: '',
        confidence: 0.8,
        createdAt: yesterdayIso,
      },
    ];

    mockFetchWearHistory.mockResolvedValue({
      events: yesterdayEvents,
      continuationToken: undefined,
    });

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('Yesterday')).toBeInTheDocument();
  });

  it('shows "N days ago" for events created 2–6 days ago', async () => {
    // Arrange — create an event dated 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoIso = threeDaysAgo.toISOString();

    const oldEvents: WearHistoryEvent[] = [
      {
        id: 'e11',
        garmentId: 'g11',
        garmentName: 'Old Jacket',
        category: 'outerwear',
        outfitImageUrl: '',
        confidence: 0.6,
        createdAt: threeDaysAgoIso,
      },
    ];

    mockFetchWearHistory.mockResolvedValue({
      events: oldEvents,
      continuationToken: undefined,
    });

    // Act
    render(React.createElement(History));

    // Assert
    expect(await screen.findByText('3 days ago')).toBeInTheDocument();
  });

  it('shows formatted date for events older than 7 days', async () => {
    // Arrange — create an event dated 30 days ago
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldDateIso = oldDate.toISOString();

    const oldEvents: WearHistoryEvent[] = [
      {
        id: 'e12',
        garmentId: 'g12',
        garmentName: 'Vintage Coat',
        category: 'outerwear',
        outfitImageUrl: '',
        confidence: 0.5,
        createdAt: oldDateIso,
      },
    ];

    mockFetchWearHistory.mockResolvedValue({
      events: oldEvents,
      continuationToken: undefined,
    });

    // Act
    render(React.createElement(History));

    // Assert — the date should be formatted via toLocaleDateString
    // Compute the expected formatted string the same way the component does
    const expectedDate = oldDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    expect(await screen.findByText('Vintage Coat')).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    // Verify relative labels are NOT shown
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
    expect(screen.queryByText(/days ago/)).not.toBeInTheDocument();
  });

  it('shows outfit count per day group', async () => {
    // Arrange — 2 events in the same day
    mockFetchWearHistory.mockResolvedValue(mockResponse);

    // Act
    render(React.createElement(History));

    // Assert — "2 outfits" for the group
    expect(await screen.findByText('2 outfits')).toBeInTheDocument();
  });

  it('shows singular "outfit" when a day group has exactly 1 event', async () => {
    // Arrange — single event
    const singleEvent: WearHistoryResponse = {
      events: [mockEvents[0]],
      continuationToken: undefined,
    };
    mockFetchWearHistory.mockResolvedValue(singleEvent);

    // Act
    render(React.createElement(History));

    // Assert — "1 outfit" (singular)
    expect(await screen.findByText('1 outfit')).toBeInTheDocument();
  });
});
