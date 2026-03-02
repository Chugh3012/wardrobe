import { useState, useEffect, useCallback } from 'react';
import styles from './Catalog.module.css';
import { fetchGarments, type GarmentSummary } from '../api';

interface CatalogProps {
  onAddGarment: () => void;
}

export default function Catalog({ onAddGarment }: CatalogProps) {
  const [garments, setGarments] = useState<GarmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const loadGarments = useCallback(async (token?: string) => {
    try {
      const res = await fetchGarments(20, token);
      if (token) {
        setGarments((prev) => [...prev, ...res.garments]);
      } else {
        setGarments(res.garments);
      }
      setContinuationToken(res.continuationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load garments.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadGarments().finally(() => setLoading(false));
  }, [loadGarments]);

  const handleLoadMore = async () => {
    if (!continuationToken || loadingMore) return;
    setLoadingMore(true);
    await loadGarments(continuationToken);
    setLoadingMore(false);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Catalog</h1>
          <button className={styles.addButton} onClick={onAddGarment} aria-label="Add new garment">
            <span aria-hidden="true">+</span>
          </button>
        </header>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading your garments…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Catalog</h1>
          <button className={styles.addButton} onClick={onAddGarment} aria-label="Add new garment">
            <span aria-hidden="true">+</span>
          </button>
        </header>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.ctaButton} onClick={() => { setError(null); setLoading(true); loadGarments().finally(() => setLoading(false)); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (garments.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Catalog</h1>
          <button className={styles.addButton} onClick={onAddGarment} aria-label="Add new garment">
            <span aria-hidden="true">+</span>
          </button>
        </header>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🧺</span>
          <p className={styles.emptyText}>Your catalog is empty</p>
          <p className={styles.emptyHint}>
            Add your first garment to start tracking your outfit usage.
          </p>
          <button className={styles.ctaButton} onClick={onAddGarment}>
            Add First Garment
          </button>
        </div>
      </div>
    );
  }

  // ── Garment grid ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Catalog</h1>
        <button className={styles.addButton} onClick={onAddGarment} aria-label="Add new garment">
          <span aria-hidden="true">+</span>
        </button>
      </header>

      <ul className={styles.garmentGrid}>
        {garments.map((g) => (
          <li key={g.id} className={styles.garmentCard}>
            <div className={styles.garmentThumb}>
              {g.thumbnailUrl ? (
                <img
                  src={g.thumbnailUrl}
                  alt={g.name}
                  className={styles.garmentImage}
                  loading="lazy"
                />
              ) : (
                <span className={styles.garmentPlaceholder}>👗</span>
              )}
            </div>
            <div className={styles.garmentInfo}>
              <span className={styles.garmentName}>{g.name}</span>
              <span className={styles.garmentMeta}>
                {g.category} · {g.wearCount} wear{g.wearCount !== 1 ? 's' : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {continuationToken && (
        <div className={styles.loadMoreWrap}>
          <button
            className={styles.ctaButton}
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
