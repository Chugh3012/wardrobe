import { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { fetchStatsSummary, type StatsSummary } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStatsSummary()
      .then((data) => { if (!cancelled) { setStats(data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Wardrobe</h1>
          <p className={styles.subtitle}>Your outfit wear stats</p>
        </header>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading stats…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Wardrobe</h1>
          <p className={styles.subtitle}>Your outfit wear stats</p>
        </header>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error ?? 'Unable to load stats.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Wardrobe</h1>
        <p className={styles.subtitle}>Your outfit wear stats</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalGarments}</span>
            <span className={styles.statLabel}>Total Items</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalWearEvents}</span>
            <span className={styles.statLabel}>Total Wears</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Most Worn</h2>
        {stats.mostWorn && stats.mostWorn.length > 0 ? (
          <ul className={styles.garmentList}>
            {stats.mostWorn.map((g) => (
              <li key={g.garmentId} className={styles.garmentListItem}>
                <span className={styles.garmentListName}>{g.name}</span>
                <span className={styles.garmentListMeta}>
                  {g.wearCount} wear{g.wearCount !== 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>👗</span>
            <p>No wear data yet.</p>
            <p className={styles.emptyHint}>Start by adding garments to your catalog.</p>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Least Worn</h2>
        {stats.leastWorn && stats.leastWorn.length > 0 ? (
          <ul className={styles.garmentList}>
            {stats.leastWorn.map((g) => (
              <li key={g.garmentId} className={styles.garmentListItem}>
                <span className={styles.garmentListName}>{g.name}</span>
                <span className={styles.garmentListMeta}>
                  {g.wearCount} wear{g.wearCount !== 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <p>Add garments and track outfits to see insights here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
