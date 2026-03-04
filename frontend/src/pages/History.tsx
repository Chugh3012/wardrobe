import { useState, useEffect, useCallback } from 'react';
import styles from './History.module.css';
import { fetchWearHistory, type WearHistoryEvent } from '../api';

export default function History() {
  const [events, setEvents] = useState<WearHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const loadHistory = useCallback(async (token?: string) => {
    try {
      const res = await fetchWearHistory(20, token);
      if (token) {
        setEvents((prev) => [...prev, ...res.events]);
      } else {
        setEvents(res.events);
      }
      setContinuationToken(res.continuationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  const handleLoadMore = async () => {
    if (!continuationToken || loadingMore) return;
    setLoadingMore(true);
    await loadHistory(continuationToken);
    setLoadingMore(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Outfit History</h1>
          <p className={styles.subtitle}>Your wear timeline</p>
        </header>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading history…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Outfit History</h1>
          <p className={styles.subtitle}>Your wear timeline</p>
        </header>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={() => { setError(null); setLoading(true); loadHistory().finally(() => setLoading(false)); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Outfit History</h1>
          <p className={styles.subtitle}>Your wear timeline</p>
        </header>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyText}>No outfit history yet</p>
          <p className={styles.emptyHint}>Start uploading daily outfits to build your timeline.</p>
        </div>
      </div>
    );
  }

  // Group events by date
  const grouped = new Map<string, WearHistoryEvent[]>();
  for (const event of events) {
    const dateKey = event.createdAt.slice(0, 10);
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(event);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Outfit History</h1>
        <p className={styles.subtitle}>Your wear timeline</p>
      </header>

      <div className={styles.timeline}>
        {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
          <div key={dateKey} className={styles.dayGroup}>
            <div className={styles.dayHeader}>
              <span className={styles.dayDate}>{formatDate(dayEvents[0].createdAt)}</span>
              <span className={styles.dayCount}>
                {dayEvents.length} outfit{dayEvents.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className={styles.eventList}>
              {dayEvents.map((event) => (
                <li key={event.id} className={styles.eventCard}>
                  <div className={styles.eventThumb}>
                    {event.outfitImageUrl ? (
                      <img
                        src={event.outfitImageUrl}
                        alt={`Outfit: ${event.garmentName}`}
                        className={styles.eventImage}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.eventPlaceholder}>📷</span>
                    )}
                  </div>
                  <div className={styles.eventInfo}>
                    <span className={styles.eventName}>{event.garmentName}</span>
                    <span className={styles.eventMeta}>
                      <span className={styles.categoryBadge}>{event.category}</span>
                      <span className={styles.confidenceText}>
                        {Math.round(event.confidence * 100)}% match
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {continuationToken && (
        <div className={styles.loadMoreWrap}>
          <button
            className={styles.retryButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
