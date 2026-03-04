import { useState, useEffect } from 'react';
import styles from './GarmentDetail.module.css';
import { fetchStatsSummary, type GarmentStat } from '../api';

interface GarmentDetailProps {
  garmentId: string;
  onBack: () => void;
}

export default function GarmentDetail({ garmentId, onBack }: GarmentDetailProps) {
  const [garment, setGarment] = useState<GarmentStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStatsSummary()
      .then((stats) => {
        if (cancelled) return;
        const found = stats.garments.find((g) => g.garmentId === garmentId);
        if (found) {
          setGarment(found);
          setError(null);
        } else {
          setError('Garment not found.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load garment.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [garmentId]);

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
            <span aria-hidden="true">‹</span>
          </button>
          <h1 className={styles.title}>Garment Details</h1>
          <div className={styles.headerSpacer} />
        </header>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !garment) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
            <span aria-hidden="true">‹</span>
          </button>
          <h1 className={styles.title}>Garment Details</h1>
          <div className={styles.headerSpacer} />
        </header>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error ?? 'Unable to load garment.'}</p>
          <button className={styles.actionButton} onClick={onBack}>Back to Catalog</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
          <span aria-hidden="true">‹</span>
        </button>
        <h1 className={styles.title}>{garment.name}</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* ── Category badge ────────────────────────────────────────── */}
      <div className={styles.categorySection}>
        <span className={styles.categoryBadge}>{garment.category}</span>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Wear Statistics</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{garment.wearCount}</span>
            <span className={styles.statLabel}>Total Wears</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValueSmall}>{formatDate(garment.lastWornDate)}</span>
            <span className={styles.statLabel}>Last Worn</span>
          </div>
        </div>
      </section>

      {/* ── Wear frequency insight ────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Insights</h2>
        <div className={styles.insightCard}>
          {garment.wearCount === 0 ? (
            <>
              <span className={styles.insightIcon}>🆕</span>
              <p className={styles.insightText}>This garment hasn't been worn yet. Upload a daily outfit to start tracking!</p>
            </>
          ) : garment.wearCount >= 10 ? (
            <>
              <span className={styles.insightIcon}>⭐</span>
              <p className={styles.insightText}>This is one of your favorites! You've worn it {garment.wearCount} times.</p>
            </>
          ) : (
            <>
              <span className={styles.insightIcon}>👍</span>
              <p className={styles.insightText}>You've worn this {garment.wearCount} time{garment.wearCount !== 1 ? 's' : ''}. Keep tracking to build your wardrobe insights!</p>
            </>
          )}
        </div>
      </section>

      {/* ── Back button ───────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={onBack}>
          ← Back to Catalog
        </button>
      </div>
    </div>
  );
}
