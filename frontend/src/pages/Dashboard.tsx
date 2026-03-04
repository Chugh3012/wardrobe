import { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { fetchStatsSummary, type StatsSummary } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = () => {
    setError(null);
    setLoading(true);
    fetchStatsSummary()
      .then((data) => { setStats(data); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats.'))
      .finally(() => setLoading(false));
  };

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
          <button className={styles.retryButton} onClick={loadStats}>Retry</button>
        </div>
      </div>
    );
  }

  // Build calendar grid for last 90 days
  const calendarMap = new Map((stats.calendar ?? []).map((d) => [d.date, d.count]));
  const calendarDays: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    calendarDays.push({ date: dateStr, count: calendarMap.get(dateStr) ?? 0 });
  }

  const getCalendarLevel = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    return 3;
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Wardrobe</h1>
        <p className={styles.subtitle}>Your outfit wear stats</p>
      </header>

      {/* ── Streaks ────────────────────────────────────────────────── */}
      {stats.streaks && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🔥 Wear Streaks</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.streaks.current}</span>
              <span className={styles.statLabel}>Current Streak</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.streaks.longest}</span>
              <span className={styles.statLabel}>Longest Streak</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Overview ───────────────────────────────────────────────── */}
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

      {/* ── Activity Calendar ──────────────────────────────────────── */}
      {stats.calendar && stats.calendar.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>📅 Activity (90 days)</h2>
          <div className={styles.calendarCard}>
            <div className={styles.calendarGrid}>
              {calendarDays.map((d) => (
                <div
                  key={d.date}
                  className={styles.calendarCell}
                  data-level={getCalendarLevel(d.count)}
                  title={`${d.date}: ${d.count} wear${d.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
            <div className={styles.calendarLegend}>
              <span className={styles.calendarLegendLabel}>Less</span>
              <div className={styles.calendarCell} data-level="0" />
              <div className={styles.calendarCell} data-level="1" />
              <div className={styles.calendarCell} data-level="2" />
              <div className={styles.calendarCell} data-level="3" />
              <span className={styles.calendarLegendLabel}>More</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Most Worn ──────────────────────────────────────────────── */}
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

      {/* ── Least Worn ─────────────────────────────────────────────── */}
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

      {/* ── Forgotten Garments ─────────────────────────────────────── */}
      {stats.forgotten && stats.forgotten.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>💤 Forgotten Garments</h2>
          <p className={styles.sectionHint}>Items not worn in 30+ days</p>
          <ul className={styles.garmentList}>
            {stats.forgotten.map((g) => (
              <li key={g.garmentId} className={styles.forgottenItem}>
                <div className={styles.forgottenInfo}>
                  <span className={styles.garmentListName}>{g.name}</span>
                  <span className={styles.forgottenCategory}>{g.category}</span>
                </div>
                <span className={styles.forgottenBadge}>
                  {g.daysSinceWorn !== null ? `${g.daysSinceWorn} days ago` : 'Never worn'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
